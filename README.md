# Nathan's Claude Code Setup

My personal Claude Code configuration with **17 slash commands**, **2 specialized AI agents**, and **12 custom skills** for productive development workflows.

## Quick Install

```bash
# Step 1: Add the marketplace
/plugin marketplace add nathanvale/nathan-vale-claude-code

# Step 2: Install the plugin
/plugin install nathan-vale-claude-code
```

### Local Installation (for development)

```bash
# Add as local marketplace
/plugin marketplace add /Users/nathanvale/code/nathan-vale-claude-code

# Install plugin
/plugin install nathan-vale-claude-code
```

## What's Inside

### 📋 Productivity Commands (17)

| Command | Description |
|---------|-------------|
| `/index` | Create or update PROJECT_INDEX.json for codebase awareness |
| `/learn` | Interactive 7-stage structured learning tutor |
| `/start` | Universal task starter - works in any project |
| `/next` | Start the next highest-priority READY task |
| `/pm` | Project Manager - task execution and status tracking |
| `/merge` | Merge a PR and clean up worktree and branches |
| `/start-review` | Decompose a review into individual task files |
| `/review-code` | Comprehensive code review across 7 quality dimensions |
| `/docs` | Documentation helper |
| `/analyze-last-run` | Analyze the last Claude Code run |
| `/attach-trace` | Phase B attachment migration with trace logging |
| `/migrate-debug` | Debug migration issues |
| `/migrate-rollback` | Rollback migration changes |
| `/melanie` | Personal helper command |
| `/sw-mode` | Create or edit SuperWhisper custom modes |
| `/sw-integrate` | Create SuperWhisper integration scripts |
| `/sw-fix` | Troubleshoot SuperWhisper issues |

### 🤖 Specialized AI Agents (2)

| Agent | Description |
|-------|-------------|
| **code-analyzer** | Analyze code changes for potential bugs and trace logic flow |
| **file-analyzer** | Analyze and summarize file contents, particularly log files |

### 🎯 Custom Skills (12)

| Skill | Description |
|-------|-------------|
| **bash-history-assistant** | Shell history search and analysis |
| **claude-docs-expert** | Claude Code documentation expertise |
| **code-analysis-toolkit** | Code analysis utilities |
| **directory-handling** | Directory and file management |
| **env-manager** | Environment variable management with 1Password |
| **hf-orchestrator** | HyperFlow keyboard orchestration system |
| **index-graph-navigator** | Codebase navigation via PROJECT_INDEX |
| **plugin-manager** | Claude Code plugin management |
| **shell-expert** | Shell scripting expertise |
| **skill-creator** | Create new Claude Code skills |
| **superwhisper** | SuperWhisper AI dictation integration |
| **task-manager** | Task and todo management |

### 🪝 Hooks

- **PostToolUse**: Atuin shell history integration for Bash commands
- **SessionStart**: Agent start logging

## Best For

- Dotfiles management
- Shell/terminal workflows
- HyperFlow keyboard orchestration
- SuperWhisper voice dictation
- Task and project management

## Customization

After installation, you can:
- Fork this repo and customize commands in `commands/`
- Add your own agents in `agents/`
- Create new skills in `skills/`
- Modify hooks in `hooks/hooks.json`

## Requirements

- Claude Code 2.0.13+
- Works with any project

## Author

Created by Nathan Vale

---

**Note**: This is my personal setup refined over time. Commands and skills are optimized for my dotfiles and development workflows but can be adapted for any use case.
