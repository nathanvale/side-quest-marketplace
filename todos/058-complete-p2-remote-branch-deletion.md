---
status: complete
priority: p2
issue_id: "058"
tags: [code-review, security]
dependencies: []
---

## Problem Statement

The safety hook blocks force-push but does not block remote branch deletion via `git push origin --delete branch-name` or `git push origin :branch-name`. Deleting remote branches (especially protected ones) is destructive.

## Findings

- `git-safety.ts` push checks focus on `--force`, `--force-with-lease`, and `--force-if-includes`
- No check for `--delete` / `-d` flag on push
- No check for refspec `:branch-name` (colon prefix = delete)
- This allows `git push origin --delete main`

## Proposed Solutions

Add detection for `git push --delete` and `:refspec` patterns. Block when targeting protected branches.

## Technical Details

- **File**: `plugins/git/hooks/git-safety.ts` -- push subcommand handling

## Acceptance Criteria

- `git push origin --delete main` is blocked
- `git push origin :main` is blocked
- `git push origin --delete feature/foo` is allowed (non-protected)
- Tests added
