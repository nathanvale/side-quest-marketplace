---
status: complete
priority: p2
issue_id: "063"
tags: [code-review, agent-native]
dependencies: []
---

## Problem Statement

`/git:review-pr` and `/git:changelog` have mandatory interactive approval steps that block sub-agent callers. `/git:worktree create` requires branch name confirmation even when the branch is provided as an argument.

## Findings

- `workflows.md` lines 107-109: review-pr requires "user approval" before posting
- `workflows.md` lines 140-142: changelog requires "user approval" before writing
- `worktree.md` lines 16-17: create requires branch name confirmation
- `worktree.md` lines 44, 49: delete requires selection and deletion confirmation
- Sub-agent callers hit conversational walls at these gates

## Proposed Solutions

1. When all required arguments are provided in `$ARGUMENTS`, skip confirmation steps
2. Document `--submit` / `--write` / `--force` flags for non-interactive bypass
3. Keep confirmations for ambiguous or missing inputs

## Technical Details

- **Files**: `plugins/git/skills/workflow/references/workflows.md`, `plugins/git/skills/workflow/references/worktree.md`

## Acceptance Criteria

- `/git:review-pr 123 --submit` skips approval gate
- `/git:changelog --write` skips approval gate
- `/git:worktree create feat/foo` skips branch name confirmation
- Interactive confirmation preserved when arguments are missing
