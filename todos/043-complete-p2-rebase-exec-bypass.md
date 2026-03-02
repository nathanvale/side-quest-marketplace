---
status: complete
priority: p2
issue_id: "043"
tags: [code-review, security, safety-hook]
dependencies: []
---

# git rebase --exec can run arbitrary destructive commands

## Problem Statement

`git rebase --exec "git reset --hard" HEAD~3` passes through the safety hook because `rebase` is not in the blocked commands list. The `--exec` argument contains a shell command that git will execute for each commit during rebase.

**Why it matters:** A destructive git command can be hidden inside a rebase --exec argument.

## Findings

- **Source:** Security sentinel review (2026-03-03)
- **File:** `plugins/git/hooks/git-safety.ts`
- `parseGitInvocation` extracts subcommand `rebase` with args, but no rule checks for it
- The `--exec` argument value is a shell command string that should be recursively checked

## Proposed Solutions

Extract and recursively check the value of `--exec` arguments in `git rebase` commands using `checkCommandInternal`.

## Acceptance Criteria

- [ ] `git rebase --exec "git reset --hard" HEAD~3` is blocked
- [ ] `git rebase --exec "echo test"` is NOT blocked (safe command)
- [ ] Normal `git rebase main` is NOT blocked
