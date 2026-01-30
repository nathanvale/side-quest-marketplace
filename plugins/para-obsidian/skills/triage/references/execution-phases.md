# Execution Phases (3-5) Detail

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

| #  | Title                           | Area          | Project      | Type     | Conf |
|----|--------------------------------|---------------|--------------|----------|------|
| 1  | ClawdBot Setup Guide           | 🤖 AI Practice | 🎯 Clawdbot  | video    | ✓    |
| 2  | AI Replacing Libraries         | 🤖 AI Practice | -            | video    | ✓    |
| 3  | Pizza Moncur Restaurant        | 🏡 Home        | -            | ref      | ?    |
| .. | ...                            | ...           | ...          | ...      | ...  |
| 48 | Sprint 42 Planning             | 💼 Work        | 🎯 Migration | meeting  | ✓    |
| 49 | Quick Idea About Auth          | 💼 Work        | -            | idea     | ~    |
| 50 | Reminder to Call Mum           | 🏡 Home        | -            | clipping | ?    |

Legend: ✓ = high confidence, ~ = medium, ? = low (use "3" for alternatives)

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

For each proposal, check `created` and `layer1_injected` fields:

| created | layer1_injected | Status | Action |
|---------|-----------------|--------|--------|
| path | true | Resource created, Layer 1 populated | Mark task completed |
| path | false | Resource created, Layer 1 failed | Mark completed, note in report |
| path | null | Meeting created (no Layer 1 needed) | Mark task completed |
| null | null | Non-URL clipping (stays in inbox) | Mark task completed |
| null | - | Creation failed | Retry with create-resource/create-meeting |

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

Use /para-obsidian:distill-resource to add progressive summarization.
```
