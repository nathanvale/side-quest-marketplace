---
name: git-expert
description: Git workflow expert — conventional commits, history exploration, worktree management, PR creation, squash, and safety. Activates for any git-related task including committing, branching, history, and repository analysis.
allowed-tools:
  - Bash(git *:*)
  - Bash(gh *:*)
  - Read
  - Glob
  - Grep
---

# Git Expert

Unified git workflow skill. Routes to the right procedure based on what the user needs.

## Routing

| User wants... | Reference | Key commands |
|---------------|-----------|-------------|
| Create a commit | [WORKFLOWS.md](WORKFLOWS.md) § Commit + [CONVENTIONS.md](CONVENTIONS.md) + [EXAMPLES.md](EXAMPLES.md) | `git status`, `git diff`, `git add`, `git commit` |
| Quick checkpoint | [WORKFLOWS.md](WORKFLOWS.md) § Checkpoint | `git add -u`, `git commit --no-verify` |
| Squash WIP commits | [WORKFLOWS.md](WORKFLOWS.md) § Squash | `git merge-base`, `git reset --soft`, `git commit` |
| Explore history | Decision tree below | `git log`, `git blame`, `git show`, `git diff` |
| Create PR | [WORKFLOWS.md](WORKFLOWS.md) § PR | `git push -u`, `gh pr create` |
| Session activity | [WORKFLOWS.md](WORKFLOWS.md) § Session Log | `git log --since="1 hour ago"` |
| Manage worktrees | [WORKTREE.md](WORKTREE.md) | CLI at `src/worktree/cli.ts` |
| Compare branches | Decision tree below | `git log main..HEAD`, `git diff main...HEAD` |

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

## Safety Rules

These are non-negotiable:

- **NEVER** force push (`git push --force` / `-f`)
- **NEVER** `git reset --hard` without explicit user confirmation
- **NEVER** `git clean -f` without explicit user confirmation
- **NEVER** `git checkout .` or `git restore .` without user confirmation
- **NEVER** commit secrets (`.env`, credentials, API keys)
- **NEVER** use `git add .` or `git add -A` — always stage specific files
- **NEVER** skip hooks (`--no-verify`) except for WIP/checkpoint commits
- **ALWAYS** verify on feature branch before squash (abort if `main`)
- **ALWAYS** use HEREDOC format for multi-line commit messages
- **ASK** user if commit scope or message is unclear
- **SPLIT** large changes into atomic commits

## Commit Format

```
<type>(<scope>): <subject>
```

See [CONVENTIONS.md](CONVENTIONS.md) for full spec and [EXAMPLES.md](EXAMPLES.md) for examples.

| Type | Use for |
|------|---------|
| feat | New feature |
| fix | Bug fix |
| docs | Documentation only |
| refactor | Code change (no feature/fix) |
| test | Adding/updating tests |
| chore | Maintenance |
| perf | Performance |
| style | Formatting |
| build | Build system |
| ci | CI/CD |
| revert | Revert changes |
