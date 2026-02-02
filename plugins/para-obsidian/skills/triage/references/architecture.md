# Triage Architecture

## Design Philosophy

**Problem:** When processing 50 inbox items, two things pollute context:
1. Enriched content (50 transcripts, 50 articles) flowing through coordinator
2. Sequential analysis causing context accumulation

**Solution:**
1. Each subagent handles BOTH enrichment AND analysis (isolated context)
2. Enriched content never touches coordinator
3. Subagents persist proposals immediately (crash resilience)
4. Single table review (no context rot from back-and-forth)

---

## Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         PHASE 1: INITIALIZE                              │
│  Coordinator:                                                            │
│  • Scan inbox                                                            │
│  • Create tasks via TaskCreate (status: pending)                         │
│  • Load vault context (areas, projects) ONCE                             │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    PHASE 2: ENRICH + ANALYZE (SUBAGENTS)                 │
│                                                                          │
│   ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                  │
│   │  Subagent 1  │  │  Subagent 2  │  │  Subagent 3  │  ...             │
│   │              │  │              │  │              │                  │
│   │ 1. Enrich    │  │ 1. Enrich    │  │ 1. Enrich    │                  │
│   │    (fetch)   │  │    (fetch)   │  │    (fetch)   │                  │
│   │ 2. Analyze   │  │ 2. Analyze   │  │ 2. Analyze   │                  │
│   │ 3. TaskUpdate│  │ 3. TaskUpdate│  │ 3. TaskUpdate│                  │
│   │    (persist) │  │    (persist) │  │    (persist) │                  │
│   └──────────────┘  └──────────────┘  └──────────────┘                  │
│                                                                          │
│   • Parallel for YouTube, articles, X/Twitter (batches of 10)            │
│   • Sequential for Confluence only (single Chrome browser)               │
│   • Enriched content stays in subagent context                           │
│   • Coordinator context stays CLEAN                                      │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    PHASE 3: SINGLE TABLE REVIEW                          │
│                                                                          │
│   Coordinator reads proposals from task metadata:                        │
│                                                                          │
│   ┌─────────────────────────────────────────────────────────────────┐   │
│   │ | #  | Title              | Area        | Project    | Type  | │   │
│   │ |----|-------------------|-------------|------------|-------| │   │
│   │ | 1  | ClawdBot Setup    | AI Practice | Clawdbot   | video | │   │
│   │ | 2  | AI Libraries      | AI Practice | -          | video | │   │
│   │ | 3  | Pizza Moncur      | Home        | -          | ref   | │   │
│   │ | .. | ...               | ...         | ...        | ...   | │   │
│   │                                                                 │   │
│   │ Actions: A (all) | E 1,3 (edit) | D 5 (delete) | Q (quit)      │   │
│   └─────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│   ONE interaction point. User sees everything, decides once.             │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    PHASE 4: EDIT (if requested)                          │
│                                                                          │
│   Only for items user selected with "E 1,3,7"                            │
│   Quick inline: Change area? Project? Delete?                            │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    PHASE 5: CLEANUP & COMMIT                             │
│                                                                          │
│   Coordinator:                                                           │
│   • Bulk commit (para_commit) — notes already created by subagents       │
│   • Apply edits from Phase 4 (re-create or para_fm_set)                  │
│   • Handle originals (delete clippings, archive transcriptions)          │
│   • Mark tasks completed                                                 │
│   • Report summary                                                       │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Why This Architecture?

### 1. Context Isolation
Each subagent gets fresh 200k token context. Enriched content (transcripts, articles, threads) stays in subagent context and never pollutes the coordinator.

### 2. Coordinator Stays Clean
The coordinator only sees:
- Task metadata (small)
- Proposals (title, summary, area, project, type)
- No 10k+ token transcripts or articles

### 3. Crash Resilience
Subagents persist via TaskUpdate immediately. If crash at item 23:
- Items 1-22: proposals saved in task metadata
- Items 23-50: still pending
- Resume: only re-process pending items

### 4. Single Review Point
No back-and-forth per item. User sees complete table, decides once:
- "A" to accept all
- "E 1,3" to tweak specific items
- "D 5" to delete

### 5. Efficient Execution
Batch create all resources. No waiting between items.

### 6. Batch Size: Why 10?

Subagents spawn in batches of 10 for these reasons:

| Factor | Constraint |
|--------|-----------|
| **API concurrency** | Claude Code handles 7-10 parallel Task calls well for haiku subagents |
| **Token budget** | 10 haiku subagents × ~2k tokens = ~20k tokens/batch |
| **Progress visibility** | User sees "Batch 1/5 complete" feedback |
| **Error isolation** | If batch fails, only 10 items need retry |
| **Memory** | Reasonable memory footprint for parallel execution |

Adjust batch size based on:
- Smaller batches (3-5) for complex content requiring sonnet
- 10 is the default for haiku subagents (clippings, most items)

---

## State Machine

```
                    ┌─────────────┐
         TaskCreate │   pending   │
                    └──────┬──────┘
                           │
              Subagent: enrich + analyze + TaskUpdate
                           │
                    ┌──────▼──────┐
                    │ in_progress │  ← note created + proposal saved in metadata
                    └──────┬──────┘     (original inbox file still exists)
                           │
              User approves (Phase 3) + coordinator cleans up (Phase 5)
                           │
                    ┌──────▼──────┐
                    │  completed  │  ← original deleted/archived
                    └─────────────┘
```

---

## Resume Flow

```
User runs /triage
        │
        ▼
   TaskList()
        │
        ▼
  ┌─────────────────────────────────────┐
  │ Any tasks with subject "Triage:*"?  │
  └──────────────┬──────────────────────┘
                 │
        ┌────────┴────────┐
        │                 │
       Yes               No
        │                 │
        ▼                 ▼
  Show resume prompt    Start fresh
  "32 analyzed,         (Phase 1)
   18 pending"
        │
        ▼
  Skip to Phase 2
  (only process pending)
```

---

## Comparison: Old vs New

| Aspect | Old (Coordinator Enriches) | New (Subagent Enriches) |
|--------|---------------------------|------------------------|
| Enriched content | Flows through coordinator | Stays in subagent |
| Coordinator context | Polluted (500k+ tokens) | Clean (small metadata) |
| Subagent job | Analyze only | Enrich + Analyze |
| Tool calls | Coordinator + Subagent | Subagent only |
| Crash recovery | Proposals saved | Proposals saved |

---

## Error Handling

### Subagent Fails to Persist

If a subagent crashes before calling TaskUpdate:

1. Task remains `status: pending` (no proposal in metadata)
2. Resume flow detects pending tasks
3. User offered to re-process only pending items
4. No manual intervention needed

```
Subagent spawned → Crash before TaskUpdate
                         ↓
              Task stays "pending"
                         ↓
              Resume detects pending
                         ↓
              Re-spawn subagent for that item
```

### Subagent Returns Invalid Proposal

If subagent persists but proposal is malformed:

1. Task has `status: in_progress` with bad metadata
2. Phase 3 table rendering skips or flags invalid proposals
3. User can choose to delete (D) or edit (E) flagged items
4. Alternatively, mark as pending for re-analysis

### Enrichment Fails

If subagent can't fetch content (timeout, 404, rate limit):

1. Subagent stores `enrichmentFailed: true` in task metadata
2. Table shows warning for that item
3. User can retry (R), delete (D), or skip (S)

### Batch Failure

If entire batch fails (API error, rate limit):

1. All tasks in batch remain pending
2. Wait and retry the batch
3. Consider reducing batch size temporarily

### Best Practice

Always check task metadata before presenting table:

```typescript
const validProposals = tasks.filter(t =>
  t.status === "in_progress" &&
  t.metadata?.proposal?.title &&
  t.metadata?.proposal?.area
);

const invalidTasks = tasks.filter(t =>
  t.status === "in_progress" && !t.metadata?.proposal?.title
);

if (invalidTasks.length > 0) {
  console.log(`⚠️ ${invalidTasks.length} items have invalid proposals`);
}
```
