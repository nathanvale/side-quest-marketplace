# Git Plugin for Claude Code

> **v2.0.0** — Lean skills-based architecture (no MCP server)

Provides intelligent git context, history exploration, smart commit capabilities, and safety guardrails for Claude Code sessions.

## Features

### Hooks (5 lifecycle events)

**SessionStart** - Loads git context:
- Current branch and status
- Last 5 commits
- Skill nudge for /git:commit, /git:squash, /git:checkpoint

**PreToolUse** - Git safety guard:
- Blocks destructive commands (force push, hard reset, clean -f, checkout ., branch -D)
- Returns deny decision with explanation

**PostToolUse** - Command logger:
- Appends Bash commands to ~/.claude/logs/git-command-log.jsonl
- Fire-and-forget audit trail

**PreCompact** - Cortex pattern:
- Extracts decisions, error fixes, learnings, preferences from transcript
- Appends to ~/.claude/cortex/{repo-name}.jsonl
- Saves git state summary (append, not overwrite)

**Stop** - Auto-commit check:
- Creates WIP checkpoint for uncommitted tracked changes
- Uses --no-verify to bypass pre-commit hooks
- Uses git add -u (tracked files only, avoids staging secrets)

### Slash Commands

All commands are thin wrappers that delegate to the git-expert skill:

- `/git:commit` - Smart commits with Conventional Commits format
- `/git:squash` - Squash WIP commits into one conventional commit
- `/git:checkpoint` - Quick WIP checkpoint commits
- `/git:create-pr` - Create pull requests with proper formatting
- `/git:history [query]` - Interactive history exploration
- `/git:session-log` - Show session git activity

### Skill: git-expert

Unified skill covering all git workflows. Claude auto-activates for git tasks:
- "Commit my changes" → Conventional commit workflow
- "Squash these WIP commits" → Merge-base + reset --soft
- "What changed recently?" → History exploration
- "Create a PR" → Push + gh pr create
- "Set up a worktree" → Worktree management

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
/git:commit
```
Claude analyzes changes, suggests type/scope, and creates a well-formatted commit.

### Squash WIP Commits
```
/git:squash
```
Combines WIP commits on a feature branch into one clean conventional commit.

### Quick Checkpoints
```
/git:checkpoint before refactor
```
Creates a quick WIP commit to save current state.

### History Exploration
```
/git:history auth
```
Searches for commits related to "auth".

### Session Summary
```
/git:session-log
```
Shows commits made and current changes during this session.

### Create Pull Request
```
/git:create-pr
```
Analyzes all commits on the branch and creates a PR with proper formatting.

## License

MIT
