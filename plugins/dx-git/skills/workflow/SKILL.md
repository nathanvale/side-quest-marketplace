---
name: workflow
description: Provides git workflow expertise -- conventional commits, history exploration, worktree management, PR creation, squash, rebase, merge, stash, and safety guards. Use for any git-related task including committing, branching, history, repository analysis, or worktree coordination. Do not use when no git operations are involved.
user-invocable: false
allowed-tools:
  - Bash(git *:*)
  - Bash(gh *:*)
  - Read
  - Glob
  - Grep
---

# Git Workflow

Unified git workflow skill. Routes to the right procedure based on what the user needs.

## Routing

| User wants... | Reference | Key commands |
|---------------|-----------|-------------|
| Create a commit | [workflows.md](references/workflows.md) § Commit + [conventions.md](references/conventions.md) | `git status`, `git diff`, `git add`, `git commit` |
| Quick checkpoint | [workflows.md](references/workflows.md) § Checkpoint | `git add -u`, `git commit --no-verify` |
| Squash WIP commits | [workflows.md](references/workflows.md) § Squash | `git merge-base`, `git reset --soft`, `git commit` |
| Explore history | Decision tree below | `git log`, `git blame`, `git show`, `git diff` |
| Create PR | [workflows.md](references/workflows.md) § PR | `git push -u`, `gh pr create` |
| Commit + PR in one step | [workflows.md](references/workflows.md) § Commit-Push-PR | `git status`, `git add`, `git commit`, `git push`, `gh pr create` |
| Clean merged branches | [workflows.md](references/workflows.md) § Clean-Gone | `git fetch --prune`, `git for-each-ref`, `git branch -d` |
| Session activity | [workflows.md](references/workflows.md) § Session Log | `git log --since="1 hour ago"` |
| Manage worktrees | [worktree.md](references/worktree.md) | CLI via `bunx @side-quest/git worktree <command>` |
| Review a PR | [workflows.md](references/workflows.md) § Review PR | `gh pr view`, `gh pr diff`, `gh api` |
| Generate changelog | [workflows.md](references/workflows.md) § Changelog | `git log`, `git tag`, `git describe` |
| Compare branches | [workflows.md](references/workflows.md) § Compare | `git merge-base`, `git diff`, `git log` |

## History Exploration Decision Tree

| Question | Git commands |
|----------|-------------|
| "What changed recently?" | `git log --oneline -10`, `git status --porcelain -b`, `git diff --stat` |
| "What changed in \<area\>?" | `git log --oneline -10 -- <path>`, `git log --all --grep="<area>"` |
| "When did we add/change X?" | `git log --all --grep="<X>"`, `git log -S "<X>"`, `git log -G "<X>"` |
| "Who changed this?" | `git blame <file>`, `git log --follow -- <file>` |
| "Compare branches" | `git log --oneline main..HEAD`, `git diff main...HEAD --stat` |
| "Show specific commit" | `git show <hash> --stat`, `git show <hash>` |
| "What branches exist?" | `git branch -a`, `git branch --show-current` |
| "What did we do this session?" | `git log --oneline --since="1 hour ago"`, `git status` |
| "Review this PR" | `gh pr view <PR>`, `gh pr diff <PR>`, `gh api .../pulls/<PR>/comments` |
| "Generate changelog" | `git describe --tags --abbrev=0`, `git log <tag>..HEAD --oneline` |
| "Compare these branches" | `git merge-base <base> HEAD`, `git diff <base>...HEAD --stat` |

## Safety Rules

These are non-negotiable:

- **NEVER** force push (`git push --force` / `-f`)
- **NEVER** `git reset --hard` -- blocked by safety hook, no override
- **NEVER** `git clean -f` -- blocked by safety hook, no override
- **NEVER** `git checkout .` or `git restore .` -- blocked by safety hook, no override
- **NEVER** commit secrets (`.env`, credentials, API keys)
- **NEVER** use `git add .` or `git add -A` -- stage specific files (exception: `git add -u` for WIP checkpoints, which only stages tracked file changes)
- **NEVER** skip hooks (`--no-verify`) except for WIP/checkpoint commits on feature branches
- **ALWAYS** check branch before committing -- if on `main`/`master`, create a feature branch first (no exceptions, including WIP checkpoints)
- **ALWAYS** verify on feature branch before squash (abort if `main`)
- **ALWAYS** use HEREDOC format for multi-line commit messages
- **ASK** user if commit scope or message is unclear
- **SPLIT** large changes into atomic commits

## Lifecycle Hooks

This plugin runs 5 hooks that fire automatically -- you don't invoke them, but be aware of their effects:

| Hook | Event | What It Does |
|------|-------|--------------|
| `session-start` | SessionStart | Loads git context (branch, recent commits, status) |
| `git-safety` | PreToolUse | Blocks destructive git commands, all commits on main/master, --no-verify on non-WIP commits, and protected file edits |
| `command-logger` | PostToolUse | Logs Bash commands to ~/.claude/logs/git-command-log.jsonl |
| `session-summary` | PreCompact | Extracts salient transcript items and saves git compaction summary |
| `auto-commit` | Stop | Creates WIP checkpoint commit for tracked changes on stop (feature branches only) |

If a hook blocks an action, resolve the underlying git safety issue rather than bypassing hook behavior.

## Commit Format

```text
<type>(<scope>): <subject>
```

See [conventions.md](references/conventions.md) for full type table, scope guidelines, and examples.
