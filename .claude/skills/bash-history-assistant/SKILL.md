---
name: bash-history-assistant
description:
  Searches and analyzes bash command history using Atuin CLI integration. Use when finding
  previously-run commands, analyzing command patterns, searching for cloud/deployment commands, or
  when mentioned 'bash history', 'atuin', 'command history', 'what command did I use', 'find
  command'.
---

# Bash History Assistant

## Overview

Provides access to Atuin command history without requiring MCP server environment variables. Uses
Atuin CLI directly via Bash tool to search, analyze, and retrieve command history captured from
Claude Code sessions and interactive shell usage.

## Core Capabilities

### 1. Search Command History

Use `atuin search` to find commands matching specific patterns:

```bash
# Basic search (returns most recent matches)
atuin search "docker" --cmd-only --limit 10

# Search for cloud deployment commands
atuin search "deploy\|kubectl\|aws\|gcloud" --cmd-only --limit 20

# Search in specific directory
atuin search "git" --cwd /Users/nathanvale/code/dotfiles --cmd-only --limit 10

# Search by exit code (find failed commands)
atuin search "npm install" --exit 1 --cmd-only --limit 5

# Search with date filters
atuin search "curl" --after "2025-01-01" --cmd-only --limit 10

# Reverse order (oldest first)
atuin search "migration" --reverse --cmd-only --limit 10
```

**Common patterns:**

- Cloud commands: `"aws\|gcloud\|kubectl\|docker\|terraform"`
- Git workflows: `"git commit\|git push\|git rebase"`
- Package management: `"npm\|yarn\|pnpm\|brew"`
- Database: `"psql\|mysql\|redis-cli"`

### 2. Get Recent Commands

Use `atuin history last` for the most recent command, or `atuin search` with limit:

```bash
# Last command executed
atuin history last --cmd-only

# Last 20 commands
atuin search --cmd-only --limit 20

# Last 50 commands (broader context)
atuin search --cmd-only --limit 50
```

### 3. Analyze Command Statistics

Use `atuin stats` to understand command usage patterns:

```bash
# Top 10 most-used commands
atuin stats

# Top 20 commands
atuin stats --count 20

# Statistics for today only
atuin stats today --count 10

# Statistics for this week
atuin stats week --count 15
```

### 4. Find Command Sequences

Use ngram analysis to find common command sequences:

```bash
# Find 2-command sequences
atuin stats --ngram-size 2 --count 10

# Find 3-command sequences (common workflows)
atuin stats --ngram-size 3 --count 10
```

## When to Use This Skill

Invoke this skill when the user asks about:

- "What command did I use to..."
- "Find the command for..."
- "Show me my bash history"
- "What curl/git/docker/kubectl command did I run"
- "What's my most common command for..."
- Cloud-related operations (deploy, infrastructure, containers)
- Commands run by Claude Code agents
- Debugging failed commands

## Search Modes

Atuin supports different search modes via `--search-mode`:

- `prefix`: Match command prefix (default)
- `full-text`: Match anywhere in command
- `fuzzy`: Fuzzy matching
- `skim`: Advanced fuzzy matching

Example:

```bash
atuin search "git push" --search-mode full-text --cmd-only --limit 10
```

## Output Formatting

Use `--format` to customize output:

```bash
# Show command with timestamp
atuin search "docker" --format "{time} - {command}" --limit 10

# Show command with directory and duration
atuin search "npm" --format "{directory} [{duration}] {command}" --limit 10

# Show exit code and command
atuin search "curl" --format "[exit:{exit}] {command}" --limit 10
```

Available variables: `{command}`, `{directory}`, `{duration}`, `{user}`, `{host}`, `{time}`,
`{exit}`, `{relativetime}`

## Integration with Claude Code

Commands executed by Claude Code agents are automatically captured via the PostToolUse hook:

- Hook script: `.claude/hooks/atuin-post-tool.sh`
- Commands are added to `~/.zsh_history`
- Atuin automatically imports from zsh history
- All Bash tool invocations are searchable

## Troubleshooting

If searches return no results:

1. Check zsh history exists: `ls -lh ~/.zsh_history`
2. Verify Atuin is importing: `atuin import auto`
3. Check Atuin database: `atuin stats`

## Handy Commands

```bash
# Quick search for cloud operations
atuin search "kubectl\|docker\|aws\|gcloud" --cmd-only --limit 20

# Find failed commands today
atuin search --exit 1 --after "today" --cmd-only --limit 10

# Most common git commands
atuin stats --count 10 | grep git

# Recent commands in current directory
atuin search --cwd $(pwd) --cmd-only --limit 15

# Find curl API calls
atuin search "curl.*api" --search-mode fuzzy --cmd-only --limit 10
```
