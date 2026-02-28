---
status: pending
priority: p2
issue_id: "006"
tags: [code-review, performance, memory]
dependencies: []
---

# Full doc bodies held in memory

## Problem Statement

`buildIndex()` stores the full markdown body of every document in the `CortexDoc[]` array. For large vaults, this means all document content is resident in memory even when only frontmatter is needed for listing/searching.

**Why it matters:** Memory usage scales linearly with total vault content size. A vault with 1000 docs averaging 10KB each would hold ~10MB in memory unnecessarily for list/search operations.

## Findings

- **Source:** performance-oracle (critical -- P2 for Stage 0)
- **Location:** `src/parser.ts` -- `parseDoc()` returns full body; `src/schema.ts` -- `CortexDoc.body` is always populated
- **Evidence:** Every doc's full body is stored regardless of whether it's needed

## Proposed Solutions

### Option A: Lazy body loading

Store only frontmatter + path in the index. Load body on demand when a command needs it (e.g., `read`).

- **Pros:** Dramatically reduces memory for list/search
- **Cons:** Adds I/O on body access, slightly more complex API
- **Effort:** Medium
- **Risk:** Low

### Option B: Accept for Stage 0

The 1MB file size guard already limits individual docs. For the dogfood MVP with small vaults, this is acceptable.

- **Pros:** No code change
- **Cons:** Won't scale
- **Effort:** None
- **Risk:** Low for Stage 0

## Recommended Action

_(To be filled during triage -- likely defer to Stage 1)_

## Technical Details

- **Affected files:** `src/parser.ts`, `src/schema.ts`, all commands that access `doc.body`

## Acceptance Criteria

- [ ] Memory usage doesn't grow linearly with vault content size
- [ ] OR documented as known limitation for Stage 0
- [ ] `bun run validate` passes

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-28 | Created from multi-agent review | Performance oracle flagged |

## Resources

- Branch: `feat/add-cortex`
