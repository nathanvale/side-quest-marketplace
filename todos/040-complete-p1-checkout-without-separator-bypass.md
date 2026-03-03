---
status: complete
priority: p1
issue_id: "040"
tags: [code-review, security, safety-hook]
dependencies: []
---

# git checkout HEAD file.txt bypasses safety without -- separator

## Problem Statement

The checkout path-overwrite check only blocks when the `--` separator is present with arguments after it. But `git checkout HEAD file.txt` (without `--`) also overwrites files and passes through unblocked.

**Why it matters:** Common destructive operation that bypasses the safety hook entirely.

## Findings

- **Source:** Security sentinel + TypeScript reviewer (2026-03-03)
- **File:** `plugins/git/hooks/git-safety.ts` lines 280-289
- The check at line 281-288 only triggers when `args.indexOf('--')` finds a separator
- `git checkout HEAD file.txt` has no `--` separator, so it passes through
- Also: `git checkout main:src/index.ts` is destructive with no `--`

## Proposed Solutions

### Option A: Block checkout with ref + positional path args
Detect when checkout has 2+ non-flag arguments (ref + path) even without `--`.

- **Pros:** Catches the bypass
- **Cons:** May false-positive on `git checkout -b new-branch base-branch`
- **Effort:** Medium (need to distinguish branch creation from path checkout)

### Option B: Block all git checkout with positional args, suggest git switch
Block any `git checkout` that has non-flag arguments beyond the branch name. Suggest `git switch` for branch switching and document that file restoration should use `git show ref:path > path`.

- **Pros:** Clean separation of concerns
- **Cons:** More aggressive blocking
- **Effort:** Low

## Acceptance Criteria

- [ ] `git checkout HEAD file.txt` is blocked
- [ ] `git checkout -b new-branch` is NOT blocked (branch creation)
- [ ] `git checkout branch-name` is NOT blocked (branch switch)
- [ ] Test coverage for new cases
