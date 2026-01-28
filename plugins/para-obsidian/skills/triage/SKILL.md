---
name: triage
description: Unified inbox processor - handles ALL content types (clippings, transcriptions, VTT files, attachments) with parallel subagents and single-table review. Routes to appropriate creator based on proposed_template.
user-invocable: true
disable-model-invocation: true
allowed-tools: Task, Read, Bash, TaskCreate, TaskUpdate, TaskList, TaskGet, AskUserQuestion, mcp__plugin_para-obsidian_para-obsidian__para_list, mcp__plugin_para-obsidian_para-obsidian__para_create, mcp__plugin_para-obsidian_para-obsidian__para_delete, mcp__plugin_para-obsidian_para-obsidian__para_rename, mcp__plugin_para-obsidian_para-obsidian__para_fm_get, mcp__plugin_para-obsidian_para-obsidian__para_fm_set, mcp__plugin_para-obsidian_para-obsidian__para_list_areas, mcp__plugin_para-obsidian_para-obsidian__para_list_projects
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

Phase 2: Enrich + Analyze (subagents)
├── Route to correct analyzer based on item type
├── Parallel for YouTube, articles (batches of 5)
├── Sequential for X/Twitter (single browser)
└── Enriched content stays in subagent context

Phase 3: Present (coordinator)
├── Read all tasks, filter for analyzed
├── Render table with all proposals (resources AND meetings)
└── User chooses: Accept all, Edit specific, Delete specific

Phase 4: Edit (only if requested)
└── Quick inline edits for selected items

Phase 5: Execute (coordinator)
├── Route to correct creator based on proposed_template
├── Handle originals (delete/archive)
└── Cleanup tasks
```

**Key insight:** Subagents handle BOTH enrichment AND analysis. Enriched content never flows through coordinator context.

**See:** [architecture.md](references/architecture.md) for diagrams.

---

## CRITICAL: Context Isolation Rules

**The orchestrator MUST NOT read content.** All content reading happens in subagents.

### What flows through coordinator (ALLOWED):
- File paths and names (~50 bytes each)
- Frontmatter metadata via `para_fm_get` (~200 bytes)
- Proposals from subagent **response text** (~500 bytes)
- **Total for 50 items: ~40k tokens**

### What NEVER flows through coordinator (FORBIDDEN):
- Transcription text (`para_read`) - 10k+ tokens each
- YouTube transcripts - 20k+ tokens each
- Article content (Firecrawl) - 5k+ tokens each
- **If leaked: 50 items = 500k+ tokens = context overflow**

### Why this matters:
```
Without isolation:  50 items × 10k avg = 500k tokens (OVERFLOW)
With isolation:     50 items × 0.5k avg = 25k tokens (FITS)
```

### Common Mistakes (AVOID THESE):

1. **Reading file to "verify" subagent work** - WRONG
   ```typescript
   // ❌ Fills coordinator context with 10k+ tokens
   para_read({ file: "00 Inbox/🎤 Voice memo.md" })
   ```

2. **Re-reading after subagent returns** - WRONG
   ```typescript
   // ❌ Subagent already analyzed this - trust its output
   const result = await Task({ ... });
   para_read({ file }); // WHY? You have the proposal!
   ```

3. **Trying to get metadata from TaskList** - WRONG
   ```typescript
   // ❌ TaskList doesn't return metadata
   const tasks = TaskList();
   const proposal = tasks[0].metadata?.proposal; // undefined!
   ```

### Correct Patterns:

1. **Use subagent response text** - Subagents return `PROPOSAL_JSON:{...}`
2. **Trust the subagent** - If it says "Sprint Planning", it read the content
3. **On resume only** - Use TaskGet loop to retrieve persisted proposals

**If you're tempted to call `para_read` - STOP.**
Spawn a subagent instead. That's what Phase 2 is for.

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

If `config.stakeholders` is empty or missing AND inbox contains voice memos/transcriptions:

```
No stakeholders configured. Stakeholders help match speakers in transcriptions
to projects and improve meeting classification.

Would you like to add stakeholders now?
(1) Paste a list (table, CSV, or JSON)
(2) Add one at a time
(3) Skip for now
```

#### Option 1: Bulk paste (recommended)

Accept any of these formats:

**Table format:**
```
Name            | Role          | Email                  | Company  | Squad
June Xu         | Developer     | JXu3@bunnings.com.au   | Bunnings | GMS (POS Yellow)
Mustafa Jalil   | Backend Dev   | MJalil@bunnings.com.au | Bunnings | GMS (POS Yellow)
```

**CSV format:**
```
name,role,email,company,squad,project,alias
June Xu,Developer,JXu3@bunnings.com.au,Bunnings,GMS (POS Yellow),[[🎯 GMS]],
Mustafa Jalil,Backend Dev,MJalil@bunnings.com.au,Bunnings,GMS (POS Yellow),[[🎯 GMS]],MJ
```

**JSON format:**
```json
[
  { "name": "June Xu", "role": "Developer", "email": "JXu3@bunnings.com.au" },
  { "name": "Mustafa Jalil", "alias": "MJ", "role": "Backend Dev" }
]
```

Parse the input, show confirmation:
```
Parsed 13 stakeholders:
• June Xu (Developer) - Bunnings/GMS
• Mustafa Jalil aka MJ (Backend Dev) - Bunnings/GMS
• ...

Save to config? (y/n)
```

#### Option 2: One at a time

```
Add a stakeholder (or press Enter to finish):

Name: June Xu
Email (optional): JXu3@bunnings.com.au
Role (optional): Developer
Company (optional): Bunnings
Squad (optional): GMS (POS Yellow)
Project wikilink (optional): [[🎯 GMS - Gift Card Management System]]
Alias (optional):

Added June Xu. Add another? (y/n)
```

#### Save to config

After collecting stakeholders (either method), write to config:

```bash
# Read existing config, merge stakeholders, write back
cat ~/.config/para-obsidian/config.json 2>/dev/null || echo '{}'
# Merge new stakeholders with existing, write back
```

**Skip bootstrap if:** No voice memos in inbox (stakeholders mainly help with transcriptions).

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

## Phase 2: Parallel Enrich + Analyze

**Key insight:** Each subagent handles BOTH enrichment AND analysis. This keeps enriched content out of the coordinator's context.

### 2.1 Spawn Subagents

For each batch of 5 items, spawn subagents **in a single message** for parallel execution.

**EXCEPTION:** X/Twitter items must be sequential (single Chrome browser). Process these separately after parallel items complete.

```typescript
Task({
  subagent_type: "general-purpose",
  description: "Process: Article Title",
  model: "haiku",
  prompt: `
    You are processing a single inbox item: enrich, analyze, and persist.

    ## Item
    Task ID: ${taskId}
    File: ${file}
    Source URL: ${sourceUrl}
    Item Type: ${itemType}      // clipping, transcription, attachment
    Source Type: ${sourceType}  // youtube, twitter, article, voice, attachment

    ## Vault Context (use these, don't fetch)

    ### Areas
    ${JSON.stringify(areas, null, 2)}

    ### Projects
    ${JSON.stringify(projects, null, 2)}

    ### Stakeholders (for speaker matching in voice memos)
    ${JSON.stringify(stakeholders, null, 2)}

    ## Step 1: Enrich (fetch full content)

    Based on source type, fetch the content:

    **YouTube:**
    mcp__youtube-transcript__get_transcript({ url: "${sourceUrl}" })

    **Article/GitHub:**
    mcp__firecrawl__firecrawl_scrape({ url: "${sourceUrl}", formats: ["markdown"] })

    **X/Twitter:**
    mcp__chrome-devtools__navigate_page({ url: "${sourceUrl}", timeout: 30000 })
    mcp__chrome-devtools__take_snapshot({})

    **Voice/Attachment:** Content already in file, use para_read.

    ## Step 2: Analyze

    Based on the enriched content and item type, create a proposal.

    For voice memos, determine if this is a MEETING or a RESOURCE:
    - Multiple speakers with status updates → meeting (standup)
    - Two people, career topics → meeting (1on1)
    - Planning/backlog discussion → meeting (planning)
    - Single speaker thinking aloud → resource (idea)
    - Quick reminder → capture (stays in inbox)

    **For meetings, extract full body content:**
    - Match speakers against stakeholders list (name, alias, email prefix)
    - Output matched speakers as wikilinks: "MJ" → "[[Mustafa Jalil]]"
    - If ALL speakers share same squad, infer project
    - Extract meeting notes, decisions, action items, follow-up

    ### Core Proposal Fields (all types):
    - proposed_title: Meaningful, descriptive title
    - proposed_template: "resource" | "meeting" | "capture"
    - summary: 2-3 sentences capturing key value
    - area: Wikilink from vault [[Area Name]]
    - project: Wikilink or null
    - resourceType: article|video|thread|meeting|reference|idea

    ### UX Fields (for review table - REQUIRED):
    - categorization_hints: Array of 3 key points explaining categorization
      Example: ["Multiple speakers", "Action items assigned", "Sprint backlog discussion"]
    - source_format: "article"|"video"|"audio"|"document"|"thread"|"image"
    - confidence: "high"|"medium"|"low" (low triggers "Deeper" option in review)
    - notes: Special considerations or null (e.g., "Could also be a brainstorm")

    ### Meeting-Specific Fields (when proposed_template === "meeting"):
    - meeting_type: standup|1on1|planning|retro|general
    - meeting_date: ISO date (from recorded field)
    - attendees: Array of wikilinks/names ["[[June Xu]]", "Speaker 3"]
    - meeting_notes: Array of key discussion points
    - decisions: Array of decisions made
    - action_items: Array of { assignee, task, due } objects
    - follow_up: Array of next steps

    **CRITICAL:** Only use areas/projects from the lists above.

    ## Step 3: Persist (CRITICAL - do not skip)

    TaskUpdate({
      taskId: "${taskId}",
      status: "in_progress",
      metadata: {
        proposal: {
          // Core fields
          proposed_title: "...",
          proposed_template: "resource" | "meeting" | "capture",
          summary: "...",
          area: "[[Area]]",
          project: "[[Project]]" or null,
          resourceType: "...",

          // UX fields (REQUIRED)
          categorization_hints: ["hint1", "hint2", "hint3"],
          source_format: "audio" | "video" | "article" | "document" | "thread",
          confidence: "high" | "medium" | "low",
          notes: "Special considerations" or null,

          // Meeting-specific (when proposed_template === "meeting")
          meeting_type: "..." or null,
          meeting_date: "..." or null,
          attendees: ["[[Name]]", ...] or null,
          meeting_notes: ["..."] or null,
          decisions: ["..."] or null,
          action_items: [{ assignee, task, due }] or null,
          follow_up: ["..."] or null
        }
      }
    })

    This ensures your work survives if the session crashes.

    ## Step 4: Return Structured Output (CRITICAL)

    After TaskUpdate, return a parseable JSON line so the coordinator can use your
    proposal immediately WITHOUT calling TaskGet or reading the file:

    For resources:
    PROPOSAL_JSON:{"taskId":"${taskId}","proposed_title":"...","proposed_template":"resource","summary":"...","area":"[[Area]]","project":"[[Project]]","resourceType":"...","source_format":"video","confidence":"high","categorization_hints":["hint1","hint2","hint3"],"notes":null,"file":"${file}"}

    For meetings (include ALL fields):
    PROPOSAL_JSON:{"taskId":"${taskId}","proposed_title":"...","proposed_template":"meeting","summary":"...","area":"[[Area]]","project":"[[Project]]","resourceType":"meeting","source_format":"audio","confidence":"high","categorization_hints":["hint1","hint2","hint3"],"notes":"All speakers from same squad","meeting_type":"planning","meeting_date":"2026-01-28","file":"${file}","attendees":["[[Name]]"],"meeting_notes":["..."],"decisions":["..."],"action_items":[{"assignee":"[[Name]]","task":"...","due":"..."}],"follow_up":["..."]}

    The coordinator parses this line directly - faster than TaskGet.
  `
})
```

**CRITICAL:** Run 5 Task calls in a single message for parallel execution.

**See:** [subagent-prompts.md](references/subagent-prompts.md) for full templates.

### 2.2 Handle X/Twitter Separately

X/Twitter requires Chrome DevTools (single browser instance). Process sequentially AFTER parallel items:

```typescript
// After all parallel subagents complete, process Twitter items one at a time
for (const twitterItem of twitterItems) {
  Task({
    subagent_type: "general-purpose",
    description: "Process: Twitter Thread",
    model: "haiku",
    prompt: `... same prompt with sourceType: "twitter" ...`
  })
  // Wait for completion before next
}
```

### 2.3 Collect Proposals from Subagents

Each subagent returns structured text with `PROPOSAL_JSON:{...}`. Parse these directly:

```typescript
const proposals = [];
for (const result of subagentResults) {
  const match = result.output.match(/PROPOSAL_JSON:(\{.*\})/);
  if (match) {
    proposals.push(JSON.parse(match[1]));
  }
}
```

**Why this pattern:**
- Subagents also persist to TaskUpdate (crash resilience)
- But coordinator uses response text (no extra tool calls)
- Content stays in subagent context (coordinator never reads files)
- If coordinator crashes, resume uses TaskGet loop instead

---

## Phase 3: Present Single Table

### 3.1 Collect Proposals from Subagents

**CRITICAL:** There are two data flows. Use the appropriate one:

#### Normal Flow: Parse Subagent Response Text

When subagents complete, they return structured text with `PROPOSAL_JSON:`. Parse this directly:

```typescript
// Subagent response includes:
// PROPOSAL_JSON:{"taskId":"1","title":"...","area":"[[...]]",...}

const proposals = [];
for (const result of subagentResults) {
  const match = result.output.match(/PROPOSAL_JSON:(\{.*\})/);
  if (match) {
    proposals.push(JSON.parse(match[1]));
  }
}
```

**This is preferred** - no extra tool calls, immediate use.

#### Resume Flow: TaskGet Loop

On resume (existing triage session), proposals are in task metadata. Must call TaskGet for each:

```typescript
// ❌ WRONG - TaskList doesn't return metadata
TaskList()
// Returns: { id, subject, status, owner, blockedBy }[] - NO metadata!

// ✅ CORRECT - TaskGet loop
const tasks = TaskList().filter(t => t.subject.startsWith("Triage:") && t.status === "in_progress");
const proposals = [];
for (const task of tasks) {
  const full = TaskGet({ taskId: task.id });
  if (full.metadata?.proposal) {
    proposals.push({ taskId: task.id, file: full.metadata.file, ...full.metadata.proposal });
  }
}
```

### 3.2 Render Table

```markdown
# Inbox Triage: 50 items

| #  | Title                           | Area          | Project      | Type     | Conf |
|----|--------------------------------|---------------|--------------|----------|------|
| 1  | ClawdBot Setup Guide           | 🤖 AI Practice | 🎯 Clawdbot  | video    | ✓    |
| 2  | AI Replacing Libraries         | 🤖 AI Practice | -            | video    | ✓    |
| 3  | Pizza Moncur Restaurant        | 🏡 Home        | -            | ref      | ?    |
| .. | ...                            | ...           | ...          | ...      | ...  |
| 48 | Sprint 42 Planning             | 💼 Work        | 🎯 Migration | meeting  | ✓    |
| 49 | Quick Idea About Auth          | 💼 Work        | -            | idea     | ~    |
| 50 | Reminder to Call Mum           | 🏡 Home        | -            | capture  | ?    |

Legend: ✓ = high confidence, ~ = medium, ? = low (use "3" for alternatives)

## Actions
• **A** - Accept all and execute
• **E 1,3,7** - Edit items 1, 3, 7 before accepting
• **D 5,12** - Delete items 5 and 12
• **3 50** - Get 3 alternative categorizations for item 50 (use when confidence is low)
• **Q** - Quit (proposals saved for resume)
```

**Columns:**
- **Type**: Proposed output type (video, article, meeting, idea, capture)
- **Conf**: Confidence indicator - low confidence items benefit from "Deeper" (3) option

**Note:** When reviewing individual items, show `categorization_hints` and `notes` to explain the reasoning.

**See:** [output-templates.md](references/output-templates.md)

---

## Phase 4: Edit (If Requested)

For each item in edit list:

```
## Editing Item 3: Pizza Moncur Restaurant

Current:
• Area: 🏡 Home
• Project: -
• Type: ref

Change: (A)rea, (P)roject, (T)ype, (D)elete, or Enter to skip?
```

Quick inline edits. Update task metadata with changes.

---

## Phase 5: Execute

### 5.1 Route to Creator by Template

**CRITICAL:** Route to correct creator skill based on `proposed_template`.

| proposed_template | Creator Skill | Destination |
|-------------------|---------------|-------------|
| `resource` | create-resource | `03 Resources/` |
| `meeting` | create-meeting | Area-based Meetings folder |
| `capture` | (skip creation) | Stays in `00 Inbox/` |

### 5.2 Create Resources

For items with `proposed_template === "resource"`:

```typescript
para_create({
  template: "resource",
  title: proposal.proposed_title,
  dest: "03 Resources",
  args: {
    summary: proposal.summary,
    source: originalUrl,
    resource_type: proposal.resourceType,
    areas: proposal.area,           // Wikilink: "[[Area]]"
    projects: proposal.project,      // Wikilink or omit
    distilled: "false"
  }
})
```

### 5.3 Create Meetings

For items with `proposed_template === "meeting"`:

#### 5.3.1 Confirm Project (Required for Meetings)

Meetings require either an area or project. Before creating, confirm the project assignment:

**If stakeholder-inferred project exists:**
```
Meeting: "Sprint 42 Planning"
Speakers detected: June Xu, MJ, Joshua Green
Inferred project: [[🎯 GMS - Gift Card Management System]] (all speakers in GMS squad)

Is this correct? (y/n/other)
```

**If no project inferred:**
```
Meeting: "Sprint 42 Planning"
No project could be inferred from speakers.

Select project:
1. [[🎯 GMS - Gift Card Management System]]
2. [[🎯 Clawdbot Setup & Integration]]
3. [[🎯 Learn IndyDevDan Agentic Coding Principles]]
4. (other - enter wikilink)
5. (none - use area only)
```

#### 5.3.2 Create Meeting Note

**CRITICAL:** Use `para_create` with `content` parameter to populate body sections.

```typescript
// Format body content from proposal
const attendeesContent = proposal.attendees
  .map(a => `- ${a}`)
  .join('\n');

const notesContent = proposal.meeting_notes
  .map(n => `- ${n}`)
  .join('\n');

const decisionsContent = proposal.decisions
  .map(d => `- ${d}`)
  .join('\n');

const actionItemsContent = proposal.action_items
  .map(item => {
    const assignee = item.assignee ? `${item.assignee} - ` : '';
    const due = item.due ? ` (due: ${item.due})` : '';
    return `- [ ] ${assignee}${item.task}${due}`;
  })
  .join('\n');

const followUpContent = proposal.follow_up
  .map(f => `- ${f}`)
  .join('\n');

// Create meeting with populated body sections
para_create({
  template: "meeting",
  title: proposal.proposed_title,
  dest: "04 Archives/Meetings",  // Meeting notes go to Archives
  args: {
    meeting_date: proposal.meeting_date,
    meeting_type: proposal.meeting_type,
    transcription: `[[${transcriptionNoteName}]]`,
    summary: proposal.summary,
    area: proposal.area,
    project: confirmedProject || null
  },
  content: {
    "Attendees": attendeesContent,
    "Notes": notesContent,
    "Decisions Made": decisionsContent,
    "Action Items": actionItemsContent,
    "Follow-up": followUpContent
  },
  response_format: "json"
})
```

Then link transcription to meeting:

```typescript
para_fm_set({
  file: originalFile,
  set: { "meeting": `[[${meetingNoteName}]]` },
  response_format: "json"
})
```

### 5.4 Handle Originals

| Type | Template | Action |
|------|----------|--------|
| Clipping | resource | `para_delete({ file, confirm: true })` |
| Transcription | resource | `para_rename({ to: "04 Archives/Transcriptions/..." })` |
| Transcription | meeting | `para_rename({ to: "04 Archives/Transcriptions/..." })` |
| Attachment | resource | Keep in place (linked via source) |
| Any | capture | Keep in inbox (no action) |

### 5.5 Cleanup Tasks

```typescript
// Mark each as completed
TaskUpdate({ taskId, status: "completed" })

// Or delete all triage tasks
// (Tasks auto-cleanup when session ends)
```

### 5.6 Report

```
✅ Triage complete!

Processed 50 items:
• 42 resources created
• 5 meetings created
• 1 edited → created with changes
• 2 captures (stayed in inbox)

Use /para-obsidian:distill-resource to add progressive summarization.
```

---

## Quick Reference

### Task States

| State | Meaning |
|-------|---------|
| `pending` | Created, not yet analyzed |
| `in_progress` | Subagent completed, proposal saved |
| `completed` | Note created |

### Resume Capability

If session crashes/quits:
1. Tasks with `status: "in_progress"` have proposals saved
2. Tasks with `status: "pending"` need re-analysis
3. Run `/triage` again → detects existing tasks → offers resume

### Enrichment Constraints

| Source | Parallel? | Reason |
|--------|-----------|--------|
| YouTube | ✅ Yes | Stateless API |
| Firecrawl | ✅ Yes | Batch API |
| Chrome DevTools | ❌ No | Single browser instance |

### Voice Memo Special Cases

Voice memos are the most ambiguous content type:

| Pattern | proposed_template | meeting_type |
|---------|-------------------|--------------|
| Multiple speakers + status updates | meeting | standup |
| Two people + career topics | meeting | 1on1 |
| Sprint planning discussion | meeting | planning |
| Single speaker thinking aloud | resource (idea) | null |
| Quick reminder | capture | null |
| Teams VTT file | meeting | (inferred) |

**Key insight:** Personal voice memos (iOS) vs Teams VTTs have different contexts. iOS is usually ideas/reminders. VTTs are usually meetings.

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
| [enrichment-strategies.md](references/enrichment-strategies.md) | Tool selection by source |
| [subagent-prompts.md](references/subagent-prompts.md) | Analysis prompt templates |
| [output-templates.md](references/output-templates.md) | Table format, actions |
| [task-patterns.md](references/task-patterns.md) | TaskCreate/Update API usage |
