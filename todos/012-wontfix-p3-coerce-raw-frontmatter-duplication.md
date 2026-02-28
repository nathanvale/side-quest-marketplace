---
status: pending
priority: p3
issue_id: "012"
tags: [code-review, simplicity, duplication]
dependencies: []
---

# coerceRawFrontmatter duplicates Zod preprocess logic

## Problem Statement

`coerceRawFrontmatter()` in `parser.ts` manually coerces Date objects and tags -- the same transformations that `FrontmatterSchema` does via `z.preprocess()`. This creates two parallel coercion paths that must be kept in sync.

**Why it matters:** If the schema adds a new preprocess rule, `coerceRawFrontmatter` must be updated separately or the best-effort path will have different behavior.

## Findings

- **Source:** code-simplicity-reviewer
- **Location:** `src/parser.ts:244-273` -- `coerceRawFrontmatter()`
- **Evidence:** Manual Date-to-string and tags coercion mirrors `DateString` and `TagsArray` preprocessors in `schema.ts`

## Proposed Solutions

### Option A: Use Zod partial parse

Instead of manual coercion, run the data through a partial/lenient version of `FrontmatterSchema` that coerces without failing.

- **Pros:** Single source of truth for coercion rules
- **Cons:** Zod partial schemas can be tricky
- **Effort:** Small
- **Risk:** Low

### Option B: Accept the duplication

The best-effort path is intentionally separate from the happy path. Keeping them distinct makes the logic explicit.

- **Pros:** Explicit, easy to understand
- **Cons:** Must sync manually
- **Effort:** None
- **Risk:** Low

## Recommended Action

_(To be filled during triage)_

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-28 | Created from multi-agent review | Simplicity reviewer flagged |

## Resources

- Branch: `feat/add-cortex`
