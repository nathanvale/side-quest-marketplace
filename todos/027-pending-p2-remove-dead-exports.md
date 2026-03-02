---
status: pending
priority: p2
issue_id: "027"
tags: [code-review, quality]
dependencies: []
---

## Problem Statement

Two exported functions have no callers in production code: `stripQuotedContents` in `git-safety.ts` and `getStableRepoName` in `git-status-parser.ts`. Dead exports increase maintenance burden and mislead readers about the public API surface.

## Findings

- `git-safety.ts` line 430: `stripQuotedContents` is exported and tested but never called in production code
- `git-status-parser.ts` line 96: `getStableRepoName` is exported but has no imports in any hook file

## Proposed Solutions

**Option A (preferred):** Remove both functions and their tests entirely.

**Option B:** If `stripQuotedContents` has planned future use, add JSDoc explaining it's a utility for external consumers and mark it with `@internal` or similar annotation.

## Technical Details

- Search all `.ts` files for imports of `stripQuotedContents` and `getStableRepoName` to confirm they are truly dead
- Remove the function definitions
- Remove corresponding test cases
- Run full test suite to confirm no breakage

## Acceptance Criteria

- [ ] No exported functions exist without callers (or have explicit JSDoc justifying their export)
- [ ] All tests pass after removal
- [ ] No orphaned test cases remain
