---
name: triage
description: Unified inbox processor - handles ALL content types (clippings, transcriptions, VTT files, attachments) with parallel subagents and single-table review. Routes to appropriate creator based on proposed_template.
argument-hint: "[all|clippings|voice|attachments|filename]"
user-invocable: true
disable-model-invocation: true
context: fork
allowed-tools: Task, Read, Bash, TaskCreate, TaskUpdate, TaskList, TaskGet, AskUserQuestion, mcp__plugin_para-obsidian_para-obsidian__para_list, mcp__plugin_para-obsidian_para-obsidian__para_create, mcp__plugin_para-obsidian_para-obsidian__para_delete, mcp__plugin_para-obsidian_para-obsidian__para_rename, mcp__plugin_para-obsidian_para-obsidian__para_replace_section, mcp__plugin_para-obsidian_para-obsidian__para_fm_get, mcp__plugin_para-obsidian_para-obsidian__para_fm_set, mcp__plugin_para-obsidian_para-obsidian__para_list_areas, mcp__plugin_para-obsidian_para-obsidian__para_list_projects
---

# Triage Coordinator

**Unified inbox processor** - handles ALL content dumped into inbox with parallel subagents and single-table review.

**Key design:** Subagents persist proposals immediately via TaskUpdate. If session crashes at item 23 of 50, items 1-22 are saved and resumable.

## Scope

**Single-session workflow.** Creates quick resource/meeting notes with `distilled: false`. Use `/para-obsidian:distill-resource` for progressive summarization.

---

## Skill Architecture

This orchestrator coordinates a three-tier skill system:

```
┌─────────────────────────────────────────────────────────────┐
│  Tier 1: REFERENCE SKILLS (Knowledge)                       │
│  - para-classifier (PARA philosophy, emoji mapping)         │
│  - content-sourcing (URL routing, tool selection)           │
└─────────────────────────────────────────────────────────────┘
                            ↓ loaded by
┌─────────────────────────────────────────────────────────────┐
│  Tier 2: WORKER SKILLS (Leaf nodes - do ONE thing)          │
│  - analyze-web         (analyze web content → proposal)     │
│  - analyze-voice       (analyze transcription → proposal)   │
│  - analyze-attachment  (analyze PDF/DOCX → proposal)        │
│  - create-resource     (create resource note from proposal) │
│  - create-meeting      (create meeting from proposal)       │
└─────────────────────────────────────────────────────────────┘
                            ↓ orchestrated by
┌─────────────────────────────────────────────────────────────┐
│  Tier 3: ORCHESTRATOR (This skill)                          │
│  - triage              (unified inbox processing)           │
└─────────────────────────────────────────────────────────────┘
```

---

## Architecture Overview

```
Phase 1: Initialize (coordinator)
├── Scan inbox, detect VTT files, create tasks
└── Load vault context (areas, projects)

Phase 2: Enrich + Analyze + Create (subagents)
├── Route to correct analyzer based on item type
├── Parallel for YouTube, articles (batches of 5)
├── Sequential for X/Twitter (single browser)
├── CREATE notes AND inject Layer 1 content (but DO NOT delete originals)
└── Enriched content stays in subagent context

Phase 3: Present & Collaborate (coordinator) ← CHECKPOINT
├── Render table with all proposals
├── **ASK USER** - accept/edit/delete?
└── User reviews and can modify area/project/title

Phase 4: Edit (only if requested)
└── Apply edits via para_fm_set or re-create

Phase 5: Execute (coordinator) ← AFTER APPROVAL
├── Delete/archive originals (only now!)
├── Apply any remaining edits
└── Cleanup tasks + report
```

**Key insight:** Subagents create notes but originals stay until user approves. This enables collaborative review while keeping content isolated.

**See:** [architecture.md](references/architecture.md) for diagrams.

---

## CRITICAL: Context Isolation

**The orchestrator MUST NOT read content.** All content reading happens in subagents. Never call `para_read` from the coordinator — spawn a subagent instead.

See [context-isolation.md](references/context-isolation.md) for rules, token math, and common mistakes.

---

## Input Routing

Check `$ARGUMENTS`:

| Input | Action |
|-------|--------|
| Empty or `all` | Full inbox processing |
| `clippings` / `voice` / `attachments` | Filter by type |
| `"filename.md"` | Single file mode (skip batching) |
| `"filename.vtt"` | Convert VTT first, then process |

---

## Pre-flight: Sync Voice Memos (automatic)

Voice memo sync runs automatically via dynamic context injection before the skill reaches the agent. This ensures freshly recorded memos are in the inbox before Phase 1 scans it.

**Result:** !`cd ${CLAUDE_PLUGIN_ROOT} && bun src/cli.ts voice 2>&1 | tail -5`

If the output shows failures (e.g., `parakeet-mlx` not installed), log a warning and continue — existing transcriptions in the inbox will still be processed.

---

## Phase 0: Check for Resume

```typescript
TaskList()
```

Filter for tasks where `id.startsWith("triage:")`.

If existing triage tasks found:
```
Found existing triage session:
• 32 analyzed (proposals saved)
• 18 pending

Resume? (y/n)
```

If yes → Skip to Phase 2 (process pending items only).

---

## Phase 1: Initialize

### 1.1 Load Vault Context

```typescript
para_list_areas({ response_format: "json" })
para_list_projects({ response_format: "json" })
para_config({ response_format: "json" })  // Get stakeholders for speaker matching
```

Extract `stakeholders` array from config (names, roles, companies for transcription speaker matching).

### 1.1.1 Stakeholder Bootstrap (if missing)

If `config.stakeholders` is empty AND inbox contains voice memos, offer to add stakeholders.
See [stakeholder-bootstrap.md](references/stakeholder-bootstrap.md) for the interactive wizard flow (bulk paste, one-at-a-time, or skip).

### 1.2 Scan Inbox

```typescript
para_list({ path: "00 Inbox", response_format: "json" })
```

For each item, extract **metadata only** (no content):

```typescript
para_fm_get({ file: itemPath, response_format: "json" })
```

**Extract from frontmatter:**
- `type` → routes to analyzer skill
- `source` → URL for enrichment (if clipping)
- `areas`, `projects` → pre-filled values

**DO NOT call `para_read`.** Content analysis happens in Phase 2 subagents.

### 1.3 Handle VTT Files

**CRITICAL:** VTT files must be converted to transcriptions before processing.

For each `.vtt` file found:

```bash
cd ${CLAUDE_PLUGIN_ROOT} && bun src/cli.ts voice convert "<vtt-path>" --format json
```

**Date handling for VTT:**
- If `--date` flag provided in `$ARGUMENTS`, use it
- Otherwise, prompt user: "VTT files require a meeting date. Enter date (YYYY-MM-DD):"
- Store converted transcription path for processing

### 1.4 Categorize Items

**Item Type (routes to analyzer skill):**

| Type | Detection | Analyzer Skill |
|------|-----------|----------------|
| `clipping` | `type === "clipping"` | analyze-web |
| `transcription` | `type === "transcription"` | analyze-voice |
| `attachment` | PDF/DOCX extension | analyze-attachment |
| `vtt` | `.vtt` extension | Convert first → analyze-voice |

**Source Type (for enrichment within analyzer):**

| Source | Detection | Tool | Parallel? |
|--------|-----------|------|-----------|
| YouTube | `youtube.com` domain | youtube-transcript | ✅ Yes |
| X/Twitter | `x.com` or `twitter.com` | Chrome DevTools | ❌ No |
| GitHub | `github.com` | Firecrawl | ✅ Yes |
| Public article | Default | Firecrawl | ✅ Yes |
| Voice/Attachment | Has content | None (para_read) | N/A |

**CRITICAL - X/Twitter:** Web Clipper captures only stubs. You MUST enrich via Chrome DevTools regardless of clipping content.

### 1.5 Create All Tasks Upfront

```typescript
// For each inbox item:
TaskCreate({
  subject: "Triage: ✂️ Article Name",
  description: "File: 00 Inbox/✂️ Article.md\nType: clipping\nSource: youtube",
  activeForm: "Analyzing article",
  metadata: {
    file: "00 Inbox/✂️ Article.md",
    itemType: "clipping",
    sourceType: "youtube",
    proposal: null  // Filled by subagent
  }
})
```

Task IDs are auto-generated. Store mapping: `{ taskId → file }`.

### 1.6 Present Summary

```
Found 50 items in inbox:

📋 By Type:
• 40 clippings
• 8 voice memos (including 2 converted VTT)
• 2 attachments

📋 By Enrichment:
• 35 parallel (YouTube, articles)
• 5 sequential (X/Twitter)
• 10 no enrichment needed

Starting subagent processing...
```

---

## Phase 2: Parallel Enrich + Analyze + Create

**Key insight:** Each subagent handles enrichment, analysis, AND note creation. Content stays isolated in subagent context - only lightweight proposals flow back to coordinator.

**CRITICAL:** Subagents create notes but **DO NOT delete/archive originals**. Deletion happens in Phase 5 AFTER user review and approval.

### 2.1 Spawn Subagents

For each batch of 5 items, spawn subagents **in a single message** for parallel execution.

**EXCEPTION:** X/Twitter items must be sequential (single Chrome browser). Process these separately after parallel items complete.

Use the prompt template from [subagent-prompts.md](references/subagent-prompts.md).

Pass these variables to each subagent:
- `taskId`, `file`, `sourceUrl`, `itemType`, `sourceType`
- `areas`, `projects`, `stakeholders` (from Phase 1)

Each subagent will: enrich content, analyze, create note, persist via TaskUpdate, and return `PROPOSAL_JSON:{...}`.

### 2.2 Handle X/Twitter Separately

X/Twitter requires Chrome DevTools (single browser instance). Process sequentially AFTER parallel items:

```typescript
// After all parallel subagents complete, process Twitter items one at a time
for (const twitterItem of twitterItems) {
  Task({
    subagent_type: "triage-worker",
    description: "Process: Twitter Thread",
    prompt: `... same prompt with sourceType: "twitter" ...`
  })
  // Wait for completion before next
}
```

Proposal collection happens in Phase 3. Subagents return `PROPOSAL_JSON:{...}` in response text.

### 2.3 Error Handling

Subagents may fail during enrichment (timeouts, 404s, rate limits) or return invalid proposals.

**Key behaviors:**
- Failed subagents leave tasks as `pending` (no TaskUpdate called)
- Invalid proposals get `enrichmentFailed: true` in metadata
- Phase 3 table flags failed items with status column
- User can Retry (R), Delete (D), or Skip (S) failed items

See [architecture.md#error-handling](references/architecture.md) for detailed error flows and recovery patterns.

---

## Phase 3: Present & Collaborate

**Key insight:** This is the collaborative checkpoint. Notes are already created, but originals still exist. User reviews proposals and can edit before we clean up.

Collect proposals from subagent response text (normal flow) or TaskGet loop (resume flow). Render table with all proposals. Ask user to Accept/Edit/Delete/Quit. **Never skip the collaborative checkpoint.**

See [execution-phases.md](references/execution-phases.md) for proposal collection code, table format, and checkpoint details.

---

## Phase 4: Edit (If Requested)

Quick inline edits for area, project, title, or type. Show current values, prompt for changes, update task metadata.

See [execution-phases.md](references/execution-phases.md) for edit flow.

---

## Phase 5: Execute (After User Approval)

Notes are ALREADY created by subagents. Phase 5 handles:
1. **Check creation status** - verify `created` and `layer1_injected` fields
2. **Apply edits** - re-create if title changed, `para_fm_set` if area/project changed
3. **Delete/archive originals** - route by `itemType` (see table below)
4. **Handle failures** - fall back to coordinator creation if subagent failed
5. **Cleanup tasks** - mark completed
6. **Report** - summary of all processed items

### CRITICAL: Original Cleanup Rules

**Route on `itemType` (source content), NOT `proposed_template` (output type).** A transcription classified as a resource is STILL archived, never deleted.

| itemType | Action | Why |
|----------|--------|-----|
| `transcription` | **Archive** via `para_rename` to `04 Archives/Transcriptions/`, then **update** resource note `source` to `[[archived note]]` via `para_fm_set` | Raw recordings have intrinsic value - NEVER delete. Resource note must link back to archived transcription |
| `clipping` | **Delete** via `para_delete` | Content captured in resource note |
| `attachment` | **Delete** inbox note via `para_delete` | PDF/DOCX stays in `Attachments/` |
| `capture` | **Keep** in inbox | No action needed |

**NEVER use `para_delete` on transcriptions.** Always use `para_rename` to archive them.

See [execution-phases.md](references/execution-phases.md) for status matrix, code patterns, and report format.

---

## Quick Reference

### Task States

| State | Meaning |
|-------|---------|
| `pending` | Created, not yet processed |
| `in_progress` | Subagent completed: note created, proposal saved, **original still exists** |
| `completed` | User approved, original deleted/archived, task done |

### Resume Capability

If session crashes/quits:
1. Tasks with `status: "in_progress"` have notes created + proposals saved + **originals preserved**
2. Tasks with `status: "pending"` need full processing
3. Run `/triage` again → detects existing tasks → offers resume
4. Resume shows proposals for review → user approves → then cleanup happens

---

## Classification Reference

For classification decision trees and emoji mappings used during analysis, see the **para-classifier skill**:

- **Classification Decision Tree:** @../para-classifier/references/classification-decision-tree.md
- **Emoji Mapping (source_format):** @../para-classifier/references/emoji-mapping.md

These provide the framework for determining note types and source_format values.

---

## Worker Skills

This orchestrator delegates to these worker skills:

| Skill | Purpose | When Used |
|-------|---------|-----------|
| [analyze-web](../analyze-web/SKILL.md) | Analyze web clippings | `itemType === "clipping"` |
| [analyze-voice](../analyze-voice/SKILL.md) | Analyze transcriptions | `itemType === "transcription"` |
| [analyze-attachment](../analyze-attachment/SKILL.md) | Analyze PDF/DOCX | `itemType === "attachment"` |
| [create-resource](../create-resource/SKILL.md) | Create resource note | `proposed_template === "resource"` |
| [create-meeting](../create-meeting/SKILL.md) | Create meeting note | `proposed_template === "meeting"` |

---

## References

| File | Content |
|------|---------|
| [architecture.md](references/architecture.md) | Flow diagrams, design rationale |
| [context-isolation.md](references/context-isolation.md) | Context isolation rules, common mistakes |
| [enrichment-strategies.md](references/enrichment-strategies.md) | Tool selection by source, voice memo cases, constraints |
| [execution-phases.md](references/execution-phases.md) | Phases 3-5 detailed implementation |
| [subagent-prompts.md](references/subagent-prompts.md) | Analysis prompt templates |
| [output-templates.md](references/output-templates.md) | Table format, actions |
| [task-patterns.md](references/task-patterns.md) | TaskCreate/Update API usage |
| [stakeholder-bootstrap.md](references/stakeholder-bootstrap.md) | Interactive stakeholder wizard |
