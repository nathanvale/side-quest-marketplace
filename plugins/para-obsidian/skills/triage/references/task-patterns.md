# Task Patterns

## Overview

The triage skill uses Claude Code's native Task system for:
- Progress tracking (visible via `Ctrl+T`)
- Crash resilience (subagents persist proposals immediately)
- Resume capability (tasks survive session restarts)
- Cross-session sharing (via `CLAUDE_CODE_TASK_LIST_ID`)

---

## Task API Reference

### TaskCreate

Creates a new task. Returns the generated task ID.

```typescript
TaskCreate({
  subject: string;        // Brief title (imperative: "Analyze article")
  description: string;    // Detailed info about the task
  activeForm?: string;    // Present continuous ("Analyzing article")
  metadata?: object;      // Arbitrary data (file, proposal, etc.)
})
```

### TaskUpdate

Updates an existing task. Metadata is merged (set key to null to delete).

```typescript
TaskUpdate({
  taskId: string;                    // Required
  status?: "pending" | "in_progress" | "completed";
  subject?: string;
  description?: string;
  activeForm?: string;
  owner?: string;
  metadata?: object;                 // Merged with existing
  addBlocks?: string[];              // Task IDs this blocks
  addBlockedBy?: string[];           // Task IDs that block this
})
```

### TaskList

Returns all tasks with summary info. No parameters.

```typescript
TaskList()
// Returns: { id, subject, status, owner, blockedBy }[]
```

### TaskGet

Returns full details for a specific task including description and metadata.

```typescript
TaskGet({ taskId: string })
```

---

## Triage Task Structure

### Task Creation (Phase 1)

```typescript
TaskCreate({
  subject: "Triage: ✂️ Article Name",
  description: `File: 00 Inbox/✂️ Article.md
Type: clipping
Source: https://example.com/article`,
  activeForm: "Analyzing article",
  metadata: {
    file: "00 Inbox/✂️ Article.md",
    itemType: "clipping",
    sourceType: "article",
    sourceUrl: "https://example.com/article",
    proposal: null  // Filled by subagent
  }
})
```

### Task Update by Subagent (Phase 3)

```typescript
TaskUpdate({
  taskId: "abc123",
  status: "in_progress",
  metadata: {
    proposal: {
      title: "Meaningful Article Title",
      summary: "2-3 sentence summary of the content.",
      area: "[[🤖 AI Practice]]",
      project: "[[🎯 Project Name]]",
      resourceType: "article"
    }
  }
})
```

### Task Completion (Phase 6)

```typescript
TaskUpdate({
  taskId: "abc123",
  status: "completed"
})
```

---

## State Machine

```
┌─────────────┐
│   pending   │  ← TaskCreate (Phase 1)
└──────┬──────┘
       │
       │ Subagent calls TaskUpdate with proposal
       │
┌──────▼──────┐
│ in_progress │  ← Proposal saved in metadata
└──────┬──────┘
       │
       │ para_create executed
       │
┌──────▼──────┐
│  completed  │
└─────────────┘
```

---

## Resume Flow

### Detecting Existing Session

```typescript
const tasks = TaskList();
const triageTasks = tasks.filter(t => t.subject.startsWith("Triage:"));

if (triageTasks.length > 0) {
  const analyzed = triageTasks.filter(t => t.status === "in_progress");
  const pending = triageTasks.filter(t => t.status === "pending");
  const completed = triageTasks.filter(t => t.status === "completed");

  console.log(`Found existing triage session:
• ${analyzed.length} analyzed (proposals saved)
• ${pending.length} pending (need analysis)
• ${completed.length} completed

Resume? (y/n)`);
}
```

### Resuming

If user chooses to resume:
1. Skip Phase 1 (tasks already created)
2. Skip enrichment/analysis for `in_progress` tasks (proposals exist)
3. Only process `pending` tasks
4. Proceed to Phase 4 (present table)

---

## Crash Resilience

### Why Subagents Persist Immediately

If the main session crashes at item 23 of 50:

**Without immediate persistence:**
- All 50 analyses lost
- Must restart from scratch

**With immediate persistence:**
- Items 1-22: proposals saved in task metadata
- Items 23-50: still pending
- Resume: only analyze pending items

### Implementation

Each subagent's prompt includes:

```
## CRITICAL: Persist Immediately

After creating proposal, call:

TaskUpdate({
  taskId: "${taskId}",
  status: "in_progress",
  metadata: {
    proposal: { ... }
  }
})

This ensures your work survives if the session crashes.
```

---

## Cross-Session Sharing

To share tasks across terminal sessions:

```bash
CLAUDE_CODE_TASK_LIST_ID=triage-session claude
```

Tasks stored in `~/.claude/tasks/triage-session/`.

Useful for:
- Running triage in one terminal, reviewing in another
- Pausing work overnight, resuming next day
- Team collaboration on shared inbox

---

## Task Cleanup

### After Successful Completion

```typescript
// Option 1: Mark all completed
for (const task of triageTasks) {
  TaskUpdate({ taskId: task.id, status: "completed" });
}

// Option 2: Tasks auto-cleanup when session ends
// (depends on settings)
```

### Canceling a Triage Session

To abandon a triage session:

```typescript
// Clear all triage tasks
const tasks = TaskList();
const triageTasks = tasks.filter(t => t.subject.startsWith("Triage:"));

for (const task of triageTasks) {
  TaskUpdate({ taskId: task.id, status: "completed" });
}
```

---

## Best Practices

1. **Subject prefix** - All triage tasks start with "Triage:" for easy filtering
2. **Store file path in metadata** - Needed for para_create and para_delete
3. **Store source URL in metadata** - Needed for resource frontmatter
4. **Persist proposal immediately** - Subagents call TaskUpdate before returning
5. **Use in_progress for analyzed** - Distinguishes from pending (not analyzed) and completed (resource created)
6. **Check for existing session first** - Offer resume before creating new tasks
