---
status: pending
priority: p2
issue_id: "028"
tags: [code-review, security]
dependencies: []
---

## Problem Statement

Several destructive git commands are not blocked by the safety hook, creating gaps in the protection layer.

## Findings

File: `plugins/git/hooks/git-safety.ts`

The following destructive commands are not currently blocked:
- `git filter-branch` -- rewrites repository history
- `git reflog expire --expire=now` -- destroys the reflog safety net
- `git update-ref -d HEAD` -- deletes the HEAD reference
- `git gc --prune=now` -- permanently removes unreachable objects

## Proposed Solutions

Add these commands to the blocked commands list in `checkCommand`, following the existing pattern for destructive operation detection.

## Technical Details

- Add pattern matching for `filter-branch` as a git subcommand (always destructive)
- Add pattern matching for `reflog expire` with `--expire=now` or `--expire=all` flags
- Add pattern matching for `update-ref -d` (delete mode)
- Add pattern matching for `gc --prune=now` (immediate pruning)
- Add corresponding test cases for each new block
- Consider whether `git replace` should also be blocked (history alteration)

## Acceptance Criteria

- [ ] `git filter-branch` is blocked by the safety hook
- [ ] `git reflog expire --expire=now` is blocked by the safety hook
- [ ] `git update-ref -d HEAD` is blocked by the safety hook
- [ ] `git gc --prune=now` is blocked by the safety hook
- [ ] Each new block has corresponding test coverage
- [ ] Existing tests continue to pass
