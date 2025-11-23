# NVCC - Nathan Vale's Claude Code Plugin

Personal Claude Code plugin with productivity commands, specialized agents, and custom skills for dotfiles management and development workflows.

## Installation

```bash
/plugin install nvcc@nathan-vale-claude-code
```

## What's Inside

### Commands (17)

| Command | Description |
|---------|-------------|
| `/nvcc:index` | Create or update PROJECT_INDEX.json for codebase awareness |
| `/nvcc:learn` | Interactive 7-stage structured learning tutor |
| `/nvcc:start` | Universal task starter - works in any project |
| `/nvcc:next` | Start the next highest-priority READY task |
| `/nvcc:pm` | Project Manager - task execution and status tracking |
| `/nvcc:merge` | Merge a PR and clean up worktree and branches |
| `/nvcc:start-review` | Decompose a review into individual task files |
| `/nvcc:review-code` | Comprehensive code review across 7 quality dimensions |
| `/nvcc:docs` | Documentation helper |
| `/nvcc:analyze-last-run` | Analyze the last Claude Code run |
| `/nvcc:attach-trace` | Phase B attachment migration with trace logging |
| `/nvcc:migrate-debug` | Debug migration issues |
| `/nvcc:migrate-rollback` | Rollback migration changes |
| `/nvcc:melanie` | Personal helper command |
| `/nvcc:sw-mode` | Create or edit SuperWhisper custom modes |
| `/nvcc:sw-integrate` | Create SuperWhisper integration scripts |
| `/nvcc:sw-fix` | Troubleshoot SuperWhisper issues |

### Specialized AI Agents (2)

| Agent | Description |
|-------|-------------|
| **code-analyzer** | Analyze code changes for potential bugs and trace logic flow |
| **file-analyzer** | Analyze and summarize file contents, particularly log files |

### Custom Skills (13)

| Skill | Description |
|-------|-------------|
| **bash-history-assistant** | Shell history search and analysis |
| **claude-docs-expert** | Claude Code documentation expertise |
| **code-analysis-toolkit** | Code analysis utilities |
| **directory-handling** | Directory and file management |
| **env-manager** | Environment variable management with 1Password |
| **hf-orchestrator** | HyperFlow keyboard orchestration system |
| **index-graph-navigator** | Codebase navigation via PROJECT_INDEX |
| **mcp-manager** | MCP server management |
| **plugin-manager** | Claude Code plugin management |
| **shell-expert** | Shell scripting expertise |
| **skill-creator** | Create new Claude Code skills |
| **superwhisper** | SuperWhisper AI dictation integration |
| **task-manager** | Task and todo management |

### Hooks

- **PostToolUse**: Atuin shell history integration for Bash commands
- **SessionStart**: Agent start logging

## Best For

- Dotfiles management
- Shell/terminal workflows
- HyperFlow keyboard orchestration
- SuperWhisper voice dictation
- Task and project management

## Author

Created by Nathan Vale
