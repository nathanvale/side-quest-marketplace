# Execution Phases (2.5-5) Detail

## Phase 2.5: Coordinator Verification (Stamp + Verify)

After all subagents complete (Phase 2) and before presenting the review table (Phase 3), the coordinator unconditionally stamps critical fields from PROPOSAL_JSON into frontmatter, then verifies.

**Why "always stamp":** Idempotent. If the worker subagent got it right, overwriting with the same value does no harm. Eliminates all conditional logic and trust issues with the worker's self-reported `verification_status`.

### Field Mapping (Proposal camelCase → Frontmatter snake_case)

| Proposal Field (camelCase) | Frontmatter Field (snake_case) | Notes |
|---------------------------|--------------------------------|-------|
| `summary` | `summary` | Direct copy |
| (task metadata) `sourceUrl` | `source` | Use sourceUrl from task metadata, not proposal |
| `source_format` | `source_format` | Direct copy |
| `resourceType` | `resource_type` | camelCase → snake_case |
| `area` (array) | `areas` | Resources use plural `areas`; JSON.stringify() for arrays |
| `project` (array or null) | `projects` | Resources use plural `projects`; omit if null |
| `area` (string) | `area` | Meetings use singular `area` |
| `meeting_type` | `meeting_type` | Meetings only |

### Verification Loop Pseudocode

```
For each proposal in proposals:
  // Skip non-created
  if proposal.created == null: continue

  // Invoice/booking — no critical fields to verify
  if proposal.proposed_template in ["invoice", "booking"]:
    proposal.verification_status = "skipped"
    proposal.verification_issues = []
    continue

  // 1. Build stamp_set from proposal + task metadata
  stamp_set = {}
  if proposal.summary is not empty:
    stamp_set.summary = proposal.summary  // Stamp non-empty values to catch haiku drops
  // If summary is empty in BOTH proposal AND frontmatter → flag needs_review (don't stamp empty)

  if proposal.proposed_template == "resource":
    stamp_set.source = task_metadata.sourceUrl  // From task, not proposal
    stamp_set.source_format = proposal.source_format
    stamp_set.resource_type = proposal.resourceType  // camelCase → snake_case
    if proposal.area is array:
      stamp_set.areas = JSON.stringify(proposal.area)  // ["[[A1]]", "[[A2]]"] → YAML list
    else:
      stamp_set.areas = proposal.area  // "[[Area]]" — single string is valid (backward compat)
    if proposal.project != null:
      if proposal.project is array:
        stamp_set.projects = JSON.stringify(proposal.project)
      else:
        stamp_set.projects = proposal.project

  if proposal.proposed_template == "meeting":
    stamp_set.area = proposal.area  // Singular for meetings
    stamp_set.meeting_type = proposal.meeting_type

  // Remove any keys with empty/null values — don't stamp emptiness
  for key in stamp_set:
    if stamp_set[key] is null or stamp_set[key] === "": delete stamp_set[key]

  // 2. Stamp (always, even if values match — idempotent)
  if stamp_set is not empty:
    para_fm_set({ file: proposal.created, set: stamp_set, response_format: "json" })

  // 3. Verify
  fm = para_fm_get({ file: proposal.created, response_format: "json" })

  // 4. Check critical fields (projects is optional — many items have no project)
  critical_fields = (resource) ? ["summary", "source", "source_format", "resource_type", "areas"]
                    : (meeting) ? ["summary", "area", "meeting_type"]
                    : []

  missing = []
  for field in critical_fields:
    if fm[field] is empty/null/""/[]:
      missing.push("missing: " + field)

  // 5. Set coordinator's verification_status (overrides haiku's)
  if missing is empty:
    proposal.verification_status = "verified"
    proposal.verification_issues = []
  else:
    proposal.verification_status = "needs_review"
    proposal.verification_issues = missing
```

### Edge Cases

| Case | Handling |
|------|----------|
| `created == null` | Skip — note wasn't created, nothing to stamp |
| `summary == ""` in proposal | Don't stamp empty string — omit from stamp_set. If frontmatter `summary` is also empty after stamping, add `"missing: summary"` to verification_issues and set `needs_review` |
| `invoice`/`booking` | Skip — set `verification_status: "skipped"` |
| Resume flow (`in_progress` items) | Re-run Phase 2.5 on all items with `created != null`. TaskGet loop provides proposals |
| `sourceUrl` missing from task metadata | Don't stamp `source` — omit from stamp_set |

### Cost

- Up to 50 items × (`para_fm_set` + `para_fm_get`) = up to 100 tool calls, ~5 seconds (skips invoice/booking and items with `created == null`)
- Workers save ~100 tool calls (no post-creation verification)
- Net: token-neutral, reliability goes from ~50% to ~100%

---

## Phase 3: Present & Collaborate

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

| #  | Title                           | Area          | Project      | Type     | Conf | !  |
|----|--------------------------------|---------------|--------------|----------|------|----|
| 1  | ClawdBot Setup Guide           | 🤖 AI Practice | 🎯 Clawdbot  | video    | ✓    |    |
| 2  | AI Replacing Libraries         | -              | -            | video    | ✓    | ⚠  |
| 3  | Pizza Moncur Restaurant        | 🏡 Home        | -            | ref      | ?    |    |
| .. | ...                            | ...           | ...          | ...      | ...  | .. |
| 48 | Sprint 42 Planning             | 💼 Work        | 🎯 Migration | meeting  | ✓    |    |
| 49 | Quick Idea About Auth          | 💼 Work        | -            | idea     | ~    |    |
| 50 | Reminder to Call Mum           | 🏡 Home        | -            | clipping | ?    |    |

Legend: ✓ = high, ~ = medium, ? = low | ⚠ = needs review (missing area/project)

## Actions
• **A** - Accept all and execute
• **E 1,3,7** - Edit items 1, 3, 7 before accepting
• **D 5,12** - Delete items 5 and 12
• **3 50** - Get 3 alternative categorizations for item 50 (use when confidence is low)
• **Q** - Quit (proposals saved for resume)
```

**Columns:**
- **Type**: Proposed output type (video, article, meeting, idea, clipping)
- **Conf**: Confidence indicator - low confidence items benefit from "Deeper" (3) option
- **!**: Verification flag — show `⚠` when `verification_status === "needs_review"` (Phase 2.5 couldn't populate all critical fields)

**After the table, list verification issues for flagged items:**
```
⚠ Item 2: missing area, missing project
```

Flagged items should be included in the `E` (edit) suggestion so the user can fix them during Phase 4.

**Note:** When reviewing individual items, show `categorization_hints` and `notes` to explain the reasoning.

**See:** [output-templates.md](output-templates.md)

### 3.3 Collaborative Checkpoint (REQUIRED)

**CRITICAL:** Always ask before proceeding. Use AskUserQuestion or direct prompt:

```
Notes created. Want to change anything?

• **A** - Accept all as-is → proceed to cleanup
• **E 1,3** - Edit items 1 and 3 (area/project/title)
• **D 5** - Delete item 5 (removes created note too)
• **3 2** - Get 3 alternative categorizations for item 2
• **Q** - Quit (notes exist, originals preserved, resume later)
```

**Never skip this step.** Even for single items, ask: "Looks good? Or change area/project?"

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

## Phase 5: Execute (After User Approval)

**Key insight:** Notes are ALREADY created by subagents in Phase 2. Phase 5 handles:
1. Apply any edits from Phase 4
2. **Delete/archive originals** (only now, after user approved)
3. Task cleanup
4. Reporting

### 5.1 Check Creation Status

For each proposal, check `created`, `layer1_injected`, and `verification_status` fields.

**Note:** By Phase 5, `verification_status` is never `"pending_coordinator"` — Phase 2.5 resolves it to `"verified"`, `"needs_review"`, or `"skipped"` before the review table is presented.

| created | layer1_injected | verification | Status | Action |
|---------|-----------------|-------------|--------|--------|
| path | true | verified | Fully verified | Mark task completed |
| path | true | needs_review | Missing fields | Complete only if user filled in Phase 4 |
| path | true | skipped | Invoice/booking | Mark task completed |
| path | false | * | Layer 1 failed | Mark completed, note in report |
| path | null | * | Meeting (no Layer 1) | Mark task completed |
| null | null | * | Non-URL clipping | Mark task completed |
| null | - | * | Creation failed | Retry with create-resource/create-meeting |

### 5.2 Handle Edited Items

If user edited proposals in Phase 4, the changes may require re-creating the note:

**For changed title:**
```typescript
// Delete the auto-created note
para_delete({ file: proposal.created, confirm: true })

// Re-create with new title
para_create({
  template: proposal.proposed_template,
  title: editedTitle,
  ...
})
```

**For changed area/project:**
```typescript
// Update frontmatter on existing note
para_fm_set({
  file: proposal.created,
  set: { areas: editedArea, projects: editedProject },
  response_format: "json"
})
```

### 5.3 Delete/Archive Originals (AFTER approval)

**This is when originals are removed** - only after user has reviewed and approved.

```typescript
// For each accepted proposal:
// IMPORTANT: Route on itemType (source content), NOT proposed_template (output type).
// A transcription classified as a resource should still be archived, not deleted.
if (proposal.itemType === "transcription") {
  const filename = proposal.file.split('/').pop();
  const archivePath = `04 Archives/Transcriptions/${filename}`;

  // Archive transcriptions — raw recordings have intrinsic value
  para_rename({
    from: proposal.file,
    to: archivePath,
    response_format: "json"
  })

  // Link the resource note's source back to the archived transcription
  const noteTitle = filename.replace('.md', '');
  para_fm_set({
    file: proposal.created,
    set: { source: `[[${noteTitle}]]` },
    response_format: "json"
  })
} else if (proposal.itemType === "clipping") {
  // Delete clippings — content is captured in the resource note
  para_delete({ file: proposal.file, confirm: true, response_format: "json" })
} else if (proposal.itemType === "attachment") {
  // Delete attachment inbox note — PDF/DOCX stays in Attachments/
  para_delete({ file: proposal.file, confirm: true, response_format: "json" })
}
// Non-URL clippings (thoughts, conversations) stay in inbox - no deletion
```

### 5.4 Handle Creation Failures

If subagent failed to create a note (rare), fall back to coordinator creation:

```typescript
// Only if proposal.created is null AND source is a URL (non-URL clippings stay in inbox)
if (!proposal.created && proposal.sourceUrl?.startsWith("http")) {
  // Use create-resource or create-meeting skill
  // This is the fallback path - subagents should handle most cases
}
```

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
• 42 resources created (40 with Layer 1, 2 without)
• 5 meetings created
• 1 edited → re-created with changes
• 2 clippings (stayed in inbox)

Verification (Phase 2.5):
• 44 notes verified (all critical fields populated)
• 2 notes flagged needs_review (missing area — user fixed in Phase 4)
• 1 invoice/booking skipped

Use /para-obsidian:distill-resource to add progressive summarization.
```
