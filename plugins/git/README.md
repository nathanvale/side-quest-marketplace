# Git Intelligence Plugin for Claude Code

Provides intelligent git context, history exploration, and smart commit capabilities for Claude Code sessions.

## Features

### MCP Server: git-intelligence

Seven tools for efficient git queries:
- `get_recent_commits` - Recent commit history with details
- `search_commits` - Search by message or code changes (-S style)
- `get_file_history` - File-specific commit history (follows renames)
- `get_status` - Current repository state (staged, modified, untracked)
- `get_branch_info` - Current branch, tracking status, local/remote branches
- `get_diff_summary` - Summary of uncommitted changes vs reference
- `get_stash_list` - List stashed changes for recovery

### Hooks

**SessionStart** - Automatically loads git context:
- Current branch and status
- Last 5 commits
- Open GitHub issues (if gh CLI available)

**PreCompact** - Saves session summary before context compaction:
- Commits made during session
- Current uncommitted changes
- Helps maintain continuity across context windows

**Stop** - Auto-commit check before session ends:
- Detects staged changes that should be committed
- Blocks session end and prompts Claude to use `/git:commit`
- Includes loop prevention via `stop_hook_active` flag
- Only triggers on staged changes (respects user intent)
- Auto-commits uncommitted changes as WIP when session stops (prevents lost work)

### Slash Commands

- `/git:commit` - Smart commits with Conventional Commits format
- `/git:create-pr` - Create pull requests with proper formatting
- `/git:checkpoint` - Quick WIP checkpoint commits
- `/git:session-log` - Show session git activity
- `/git:history [query]` - Interactive history exploration

### Skill: git-expert

Claude autonomously uses git context when you ask:
- "What did we change recently?"
- "Who wrote this code?"
- "Commit my changes"
- "What happened to the auth module?"
- "Save my work before I try this"

## Prerequisites

- Git installed and configured
- Node.js 18+ (for MCP server)
- Optional: GitHub CLI (`gh`) for issue integration

## Installation

```bash
/plugin install git@nathan-vale-claude-code
```

Dependencies are automatically installed on first session start.

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

## Configuration

### Debug Mode

Enable debug logging:
```bash
export CLAUDE_GIT_DEBUG=1
```

### Session Summary Location

Session summaries are saved to `~/.claude/session-summaries/{repo-name}.md` to avoid polluting your repository.

## Usage Examples

### Smart Commits
```
/git:commit
```
Claude will analyze changes, suggest appropriate type/scope, and create a well-formatted commit.

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
