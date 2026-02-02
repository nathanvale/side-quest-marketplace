---
name: triage
description: Unified inbox processor - handles ALL content types (clippings, transcriptions, VTT files, attachments) with parallel subagents and single-table review. Routes to appropriate creator based on proposed_template.
argument-hint: "[all|clippings|voice|attachments|filename]"
user-invocable: true
disable-model-invocation: true
context: fork
allowed-tools: Task, Read, Bash, TaskCreate, TaskUpdate, TaskList, TaskGet, AskUserQuestion, mcp__plugin_para-obsidian_para-obsidian__para_list, mcp__plugin_para-obsidian_para-obsidian__para_create, mcp__plugin_para-obsidian_para-obsidian__para_delete, mcp__plugin_para-obsidian_para-obsidian__para_rename, mcp__plugin_para-obsidian_para-obsidian__para_replace_section, mcp__plugin_para-obsidian_para-obsidian__para_fm_get, mcp__plugin_para-obsidian_para-obsidian__para_fm_set, mcp__plugin_para-obsidian_para-obsidian__para_list_areas, mcp__plugin_para-obsidian_para-obsidian__para_list_projects, mcp__plugin_para-obsidian_para-obsidian__para_template_fields, mcp__plugin_para-obsidian_para-obsidian__para_commit
---

# Triage Coordinator

**Unified inbox processor** - handles ALL content dumped into inbox with parallel subagents and single-table review.

**Key design:** Subagents persist proposals immediately via TaskUpdate. If session crashes at item 23 of 50, items 1-22 are saved and resumable.

## Scope

**Single-session workflow.** Creates quick resource/meeting notes with `distilled: false`. Use `/para-obsidian:distill-resource` for progressive summarization.

---

## Skill Architecture

This orchestrator spawns `triage-worker` agents, each self-contained with preloaded skills:

```
┌─────────────────────────────────────────────────────────────┐
│  Tier 1: REFERENCE SKILLS (Knowledge)                       │
│  - para-classifier      (PARA philosophy, emoji mapping)    │
│  - content-processing   (note creation, Layer 1, commit)    │
│  - content-sourcing     (URL routing, tool selection)        │
└─────────────────────────────────────────────────────────────┘
                            ↓ loaded by
┌─────────────────────────────────────────────────────────────┐
│  Tier 2: WORKER SKILLS (preloaded into triage-worker agent) │
│  - analyze-web         (analyze web content → proposal)     │
│  - analyze-voice       (analyze transcription → proposal)   │
│  - analyze-attachment  (analyze PDF/DOCX → proposal)        │
└─────────────────────────────────────────────────────────────┘
                            ↓ orchestrated by
┌─────────────────────────────────────────────────────────────┐
│  Tier 3: ORCHESTRATOR (This skill)                          │
│  - triage              (unified inbox processing)           │
└─────────────────────────────────────────────────────────────┘
```

**Note:** `content-processing` is the canonical pipeline for note creation, Layer 1 injection, and commit — shared by `triage-worker` and `quick-create`. `create-resource` and `create-meeting` are standalone skills for non-triage workflows.

---

## Architecture Overview

```
Phase 1: Initialize (coordinator)
├── Scan inbox, detect VTT files, create tasks
└── Load vault context (areas, projects)

Phase 2: Enrich + Analyze + Create (subagents)
├── Route to correct analyzer based on item type
├── Parallel for YouTube, articles, X/Twitter (batches of 10)
├── Sequential for Confluence only (single browser)
├── CREATE notes AND inject Layer 1 content (but DO NOT delete originals)
└── Enriched content stays in subagent context

Phase 2.5: Coordinator Verification (coordinator)
├── For each proposal with created != null
├── para_fm_set: stamp summary + source + classification fields from proposal
├── para_fm_get: verify all critical fields populated
└── Override haiku's verification_status with coordinator's assessment

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

### 1.1 Load Vault Context (via preflight subagent)

Spawn a haiku preflight subagent to gather vault context cheaply:

```typescript
Task({
  model: "haiku",
  subagent_type: "general-purpose",
  description: "Triage preflight",
  prompt: "<preflight prompt with mode=triage>"
})
```

Use the prompt template from [../brain/references/preflight-prompt.md](../brain/references/preflight-prompt.md) with `$MODE = triage`.

Parse `PREFLIGHT_JSON:{...}` from the response. Extract `areas`, `projects`, `inbox_items`, and `stakeholders`.

**Fallback:** If the subagent fails, fall back to direct MCP calls:

```typescript
para_list_areas({ response_format: "json" })
para_list_projects({ response_format: "json" })
para_config({ response_format: "json" })
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

See [enrichment-strategies.md](references/enrichment-strategies.md) for the canonical routing table (source detection, tool selection, parallelization constraints).

**CRITICAL - X/Twitter:** Web Clipper captures only stubs. You MUST enrich via X-API MCP tools (`x_get_tweet`) regardless of clipping content.

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

### 1.6 Pre-load Template Fields

Call `para_template_fields` once per unique template type (usually just `"resource"`, sometimes `"meeting"`). Pass results to subagents so they skip this call.

```typescript
// For each unique proposed template:
para_template_fields({ template: "resource", response_format: "json" })
// → { validArgs, creation_meta: { contentTargets, dest, titlePrefix, sections } }
```

Store the results keyed by template name. Include in every subagent prompt (see subagent-prompts.md).

### 1.7 Present Summary

```
Found 50 items in inbox:

📋 By Type:
• 40 clippings
• 8 voice memos (including 2 converted VTT)
• 2 attachments

📋 By Enrichment:
• 35 parallel (YouTube, articles)
• 5 X/Twitter (parallel via X-API)
• 10 no enrichment needed

Starting subagent processing...
```

---

## Phase 2: Parallel Enrich + Analyze + Create

**Key insight:** Each subagent handles enrichment, analysis, AND note creation. Content stays isolated in subagent context - only lightweight proposals flow back to coordinator.

**CRITICAL:** Subagents create notes but **DO NOT delete/archive originals**. Deletion happens in Phase 5 AFTER user review and approval.

### 2.1 Spawn Subagents

For all items (up to 10 per batch), spawn subagents **in a single message** for parallel execution. For inboxes >10 items, use batches of 10. Claude Code handles 7-10 parallel Task calls well for haiku subagents.

**EXCEPTION:** Confluence items must be sequential (single Chrome browser). Process these separately after parallel items complete.

Use the prompt template from [subagent-prompts.md](references/subagent-prompts.md).

Pass these variables to each subagent:
- `taskId`, `file`, `sourceUrl`, `itemType`, `sourceType`
- `areas`, `projects`, `stakeholders` (from Phase 1)
- `templateFields` (from Phase 1.6 — pre-loaded template metadata)

**Batch mode flags:** Instruct subagents to pass `no_autocommit: true` and `skip_guard: true` to `para_create`. This allows parallel subagents to write simultaneously without git guard conflicts. The coordinator commits once after all subagents complete (Phase 5).

Each subagent will: enrich content, analyze, create note (no commit), persist via TaskUpdate, and return `PROPOSAL_JSON:{...}`.

### 2.1.1 Model Selection by Item Type

Override the agent's default model based on content complexity:

| Item Type | Model | Why |
|-----------|-------|-----|
| `clipping` | `haiku` (default) | Enrichment provides strong source content |
| `transcription` | `sonnet` | Ambiguous speakers, nuanced categorization |
| `vtt` (converted) | `sonnet` | Same as transcription |

```typescript
// Pass model override in Task call:
Task({
  subagent_type: "triage-worker",
  model: itemType === "transcription" ? "sonnet" : undefined,  // undefined = use agent default (haiku)
  description: "Process: ...",
  prompt: `...`
})
```

### 2.2 Handle Confluence Separately

Confluence requires Chrome DevTools (single browser instance). Process sequentially AFTER parallel items:

```typescript
// After all parallel subagents complete, process Confluence items one at a time
for (const confluenceItem of confluenceItems) {
  Task({
    subagent_type: "triage-worker",
    description: "Process: Confluence Page",
    prompt: `... same prompt with sourceType: "confluence" ...`
  })
  // Wait for completion before next
}
```

**Note:** X/Twitter items are now processed in the parallel batch (Section 2.1) using stateless X-API MCP tools.

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

## Phase 2.5: Coordinator Verification

**Rationale:** Haiku triage-workers generate correct values in PROPOSAL_JSON but drop fields ~50% of the time when constructing `para_create` args. Haiku also falsely reports `verification_status: "verified"` when fields are empty. The coordinator has authoritative values from PROPOSAL_JSON and stamps them unconditionally — idempotent (if haiku got it right, overwriting with the same value does no harm).

**This replaces trust in haiku's `verification_status`.** Workers now set `verification_status: "pending_coordinator"` and skip post-creation verification.

### Stamp Set by Template

| Template | Fields Stamped | Source |
|----------|---------------|--------|
| `resource` | `summary`, `source`, `source_format`, `resource_type`, `areas`, `projects` | proposal + task metadata (sourceUrl) |
| `meeting` | `summary`, `area`, `meeting_type` | proposal |
| `invoice`/`booking` | (skip) | N/A |

### Verification Loop

For each proposal where `created != null` and template not in `[invoice, booking]`:

1. **Build stamp_set** from PROPOSAL_JSON fields + task metadata (`sourceUrl` for `source` field)
2. **`para_fm_set`** — stamp all critical fields unconditionally
3. **`para_fm_get`** — read back frontmatter to verify
4. **Check critical fields** — if all populated → `"verified"`, if any still empty → `"needs_review"`
5. **Override** haiku's `verification_status` with the coordinator's assessment

See [execution-phases.md](references/execution-phases.md) for full pseudocode and field mapping.

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

Notes are ALREADY created by subagents (uncommitted in batch mode). Phase 5 handles:
1. **Bulk commit** - `para_commit()` once to commit all notes created by subagents (batch mode)
2. **Check creation status** - verify `created` and `layer1_injected` fields
3. **Apply edits** - re-create if title changed, `para_fm_set` if area/project changed
4. **Delete/archive originals** - route by `itemType` (see table below)
5. **Handle failures** - fall back to coordinator creation if subagent failed
6. **Cleanup tasks** - mark completed
7. **Report** - summary of all processed items

### CRITICAL: Original Cleanup Rules

**Route on `itemType` (source content), NOT `proposed_template` (output type).** A transcription classified as a resource is STILL archived, never deleted.

| itemType | Action | Why |
|----------|--------|-----|
| `transcription` | **Archive** via `para_rename` to `04 Archives/Transcriptions/`, then **update** resource note `source` to `[[archived note]]` via `para_fm_set` | Raw recordings have intrinsic value - NEVER delete. Resource note must link back to archived transcription |
| `clipping` | **Delete** via `para_delete` | Content captured in resource note |
| `attachment` | **Delete** inbox note via `para_delete` | PDF/DOCX stays in `Attachments/` |
| `clipping` (non-URL) | **Keep** in inbox | Thought/conversation clippings are manual review items |

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

The `triage-worker` agent has these skills preloaded:

| Skill | Purpose | When Used |
|-------|---------|-----------|
| [analyze-web](../analyze-web/SKILL.md) | Analyze web clippings | `itemType === "clipping"` |
| [analyze-voice](../analyze-voice/SKILL.md) | Analyze transcriptions | `itemType === "transcription"` |
| [analyze-attachment](../analyze-attachment/SKILL.md) | Analyze PDF/DOCX | `itemType === "attachment"` |

**Standalone skills** (not used during triage — the worker handles creation inline):

| Skill | Purpose | When Used |
|-------|---------|-----------|
| [create-resource](../create-resource/SKILL.md) | Create resource note | Non-triage workflows |
| [create-meeting](../create-meeting/SKILL.md) | Create meeting note | Non-triage workflows |

---

## Completion Signal

After the final report in Phase 5, emit a structured completion signal so the brain orchestrator can parse the outcome:

- **All processed:** `SKILL_RESULT:{"status":"ok","skill":"triage","summary":"Processed N items","processed":N}`
- **Partial failures:** `SKILL_RESULT:{"status":"partial","skill":"triage","processed":N,"failed":M}`
- **Empty inbox:** `SKILL_RESULT:{"status":"ok","skill":"triage","summary":"Inbox is empty"}`
- **User cancelled:** `SKILL_RESULT:{"status":"ok","skill":"triage","summary":"Cancelled by user"}`

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
