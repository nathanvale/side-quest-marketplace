# dx-git Plugin for Claude Code

> **v3.0.0** -- Renamed from `git` to `dx-git` (Developer experience tier)

Provides intelligent git context, history exploration, smart commit capabilities, and safety guardrails for Claude Code sessions.

## Features

- **Worktree-aware repo keying** - Session memory is shared across all worktrees of the same repo (uses main worktree root instead of `--show-toplevel`)

### Hooks (5 lifecycle events)

**SessionStart** - Loads git context:
- Current branch and status
- Last 5 commits
- Skill nudge for /dx-git:commit, /dx-git:squash, /dx-git:checkpoint

**PreToolUse** - Git safety guard:
- Blocks destructive commands (force push, hard reset, clean -f, checkout ., branch -D)
- Blocks all commits on protected branches (main/master)
- Blocks --no-verify on non-WIP commits (prevents bypassing pre-commit hooks)
- Blocks Write/Edit to protected files (.env, credentials, .git/ directory)
- Returns deny decision with explanation

#### Safety Modes

Control strictness with `CLAUDE_GIT_SAFETY_MODE`:

- `strict` (default) - Full enforcement. Denies destructive git/shell commands and commit policy violations.
- `commit-guard` - Enforces commit policies only (protected branches + `--no-verify` rules). Destructive commands emit warnings instead of denials.
- `advisory` - Never denies; emits warnings/events only.

Recommended rollout:
- Keep `strict` for normal operation.
- Use `commit-guard` during temporary migration/debugging windows.
- Use `advisory` only for diagnostics with explicit team consent.

### Pre-Merge Validation

Run these checks before merging safety changes to `main`:

1. `bun test plugins/dx-git/hooks/`
2. `bun run typecheck`
3. Runtime mode smoke checks:
  - `strict`: destructive command should deny
  - `commit-guard`: destructive command should warn/allow, commit policy should still deny
  - `advisory`: no deny decisions, warnings/events only

Operational default:
- Keep `CLAUDE_GIT_SAFETY_MODE` unset in production (`strict` by default).

**PostToolUse** - Command logger:
- Appends Bash commands to ~/.claude/logs/git-command-log.jsonl
- Fire-and-forget audit trail

**PreCompact** - Session summary:
- Saves git state summary to ~/.claude/session-summaries/{repo-name}.md (append, not overwrite)
- Outputs git context to stdout so it survives compaction

**Stop** - Auto-commit check:
- Creates WIP checkpoint for uncommitted tracked changes (feature branches only)
- Uses --no-verify to bypass pre-commit hooks
- Uses git add -u (tracked files only, avoids staging secrets)
- Skips on protected branches (main/master) to prevent direct commits

### Slash Commands

All commands are thin wrappers that delegate to the workflow skill:

- `/dx-git:commit` - Smart commits with Conventional Commits format
- `/dx-git:squash` - Squash WIP commits into one conventional commit
- `/dx-git:checkpoint` - Quick WIP checkpoint commits
- `/dx-git:create-pr` - Create pull requests with proper formatting
- `/dx-git:review-pr <number>` - Review a GitHub pull request with inline comments
- `/dx-git:changelog [version]` - Generate changelog from conventional commits
- `/dx-git:compare [branch]` - Compare branches with AI summary
- `/dx-git:history [query]` - Interactive history exploration
- `/dx-git:session-log` - Show session git activity
- `/dx-git:worktree <subcommand>` - Manage git worktrees (create, list, delete, sync, clean, status)

### Skill: workflow

Unified skill covering all git workflows. Claude auto-activates for git tasks:
- "Commit my changes" → Conventional commit workflow
- "Squash these WIP commits" → Merge-base + reset --soft
- "What changed recently?" → History exploration
- "Create a PR" → Push + gh pr create
- "Review this PR" → Batched review with inline comments
- "Generate a changelog" → Keep a Changelog from conventional commits
- "Compare branches" → Diff summary with AI analysis
- "Set up a worktree" → Worktree management
- "Manage my worktrees" → Worktree lifecycle management

## Prerequisites

- Git installed and configured
- Optional: GitHub CLI (`gh`) for PR creation and issue integration

## Installation

Part of the [SideQuest Marketplace](https://github.com/nathanvale/side-quest-marketplace). Installed automatically when the marketplace is active.

## Commit Format

Uses [Conventional Commits](https://www.conventionalcommits.org/) specification:

```
<type>(<scope>): <subject>
```

| Type | Description |
|------|-------------|
| feat | A new feature |
| fix | A bug fix |
| docs | Documentation |
| style | Code style (formatting) |
| refactor | Code refactoring |
| perf | Performance improvements |
| test | Adding/updating tests |
| build | Build system changes |
| ci | CI/CD configuration |
| chore | Maintenance tasks |
| revert | Revert changes |

## Usage Examples

### Smart Commits
```
/dx-git:commit
```
Claude analyzes changes, suggests type/scope, and creates a well-formatted commit.

### Squash WIP Commits
```
/dx-git:squash
```
Combines WIP commits on a feature branch into one clean conventional commit.

### Quick Checkpoints
```
/dx-git:checkpoint before refactor
```
Creates a quick WIP commit to save current state.

### History Exploration
```
/dx-git:history auth
```
Searches for commits related to "auth".

### Session Summary
```
/dx-git:session-log
```
Shows commits made and current changes during this session.

### Create Pull Request
```
/dx-git:create-pr
```
Analyzes all commits on the branch and creates a PR with proper formatting.

### Review a Pull Request
```
/dx-git:review-pr 42
```
Fetches PR diff, reviews for bugs/issues, presents findings, and posts a batched review on approval.

### Generate Changelog
```
/dx-git:changelog
/dx-git:changelog 2.1.0
```
Groups conventional commits into Keep a Changelog format. Suggests version bump if not specified.

### Compare Branches
```
/dx-git:compare
/dx-git:compare feature/auth
```
Shows commit summary, file impact, and AI analysis of differences between current branch and target.

## License

MIT
