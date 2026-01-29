# Task Patterns

## Overview

The triage skill uses Claude Code's native Task system (TaskCreate, TaskUpdate, TaskList, TaskGet) for:
- Progress tracking (visible via `Ctrl+T`)
- Crash resilience (subagents persist proposals immediately)
- Resume capability (tasks survive session restarts)
- Cross-session sharing (via `CLAUDE_CODE_TASK_LIST_ID`)

**CRITICAL:** TaskList does NOT return metadata. To read proposals, you must call TaskGet for each task.

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

To share tasks across terminal sessions, set `CLAUDE_CODE_TASK_LIST_ID=triage-session` when launching Claude.

---

## Proposal Retrieval

Two data flows from subagents to coordinator:

| Method | When | How |
|--------|------|-----|
| **Response text** | Normal flow | Parse `PROPOSAL_JSON:{...}` from subagent output |
| **TaskGet loop** | Resume flow | Call `TaskGet(taskId)` for each `in_progress` task |

**Use response text for normal operation, TaskGet loop only on resume.** See [execution-phases.md](execution-phases.md) for implementation code.

---

## Best Practices

1. **Subject prefix** - All triage tasks start with "Triage:" for easy filtering
2. **Store file path in metadata** - Needed for para_create and para_delete
3. **Store source URL in metadata** - Needed for resource frontmatter
4. **Persist proposal immediately** - Subagents call TaskUpdate before returning
5. **Return structured proposal text** - Subagents return parseable proposal for coordinator
6. **Use in_progress for analyzed** - Distinguishes from pending (not analyzed) and completed (resource created)
7. **Check for existing session first** - Offer resume before creating new tasks
8. **Never read content in coordinator** - All file reads happen in subagents only
