---
status: pending
priority: p3
issue_id: "015"
tags: [code-review, performance, optimization]
dependencies: []
---

# toLowerCase() called repeatedly in search loops

## Problem Statement

In `search.ts` and `list.ts`, `toLowerCase()` is called on filter values inside the loop for each document. This creates a new string allocation per iteration when the filter value is constant.

**Why it matters:** Minor performance issue. For large vaults (1000+ docs), the repeated allocations add up, but for Stage 0 this is negligible.

## Findings

- **Source:** performance-oracle
- **Location:** `src/commands/search.ts`, `src/commands/list.ts` -- filter loops
- **Evidence:** `doc.frontmatter.type?.toLowerCase()` and similar called per-doc

## Proposed Solutions

### Option A: Hoist toLowerCase out of loops

Pre-compute lowercased filter values before the loop.

- **Pros:** Eliminates redundant allocations
- **Cons:** Minimal real-world impact for Stage 0
- **Effort:** Trivial
- **Risk:** None

## Recommended Action

_(Quick fix if touching those files, otherwise defer)_

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-28 | Created from multi-agent review | Performance oracle flagged |

## Resources

- Branch: `feat/add-cortex`
