---
name: bash-history
description: Search and retrieve bash command history using Atuin
triggers:
  - history
  - previous command
  - how did I
  - what command
  - ran before
  - last time
  - find command
---

# Bash History Skill

This skill provides access to bash command history through Atuin, allowing you to search for and retrieve previously executed commands.

## When to Use

Use this skill when the user:
- Asks about commands they've run before
- Wants to find a specific command from history
- Needs to recall how they did something previously
- Is looking for a workflow or pattern from past commands
- Asks "how did I..." or "what command did I use to..."

## Available Tools

### mcp__bash-history__search_history

Search for commands matching a query.

**Parameters:**
- `query` (string): Search term to find matching commands
- `limit` (number, default: 10): Maximum results to return
- `include_failed` (boolean, default: false): Include failed commands

### mcp__bash-history__get_recent_history

Get the most recent commands.

**Parameters:**
- `limit` (number, default: 10): Number of recent commands
- `include_failed` (boolean, default: false): Include failed commands

## Example Usage

When user asks: "How did I deploy last time?"
```
Use mcp__bash-history__search_history with query "deploy"
```

When user asks: "What commands did I run recently?"
```
Use mcp__bash-history__get_recent_history with limit 20
```

When user asks: "Show me failed git commands"
```
Use mcp__bash-history__search_history with query "git" and include_failed true
```

## Output Format

Results include:
- Command text
- Exit code (0 = success, non-zero = failure)
- Timestamp when the command was executed

Present the results in a clear, readable format and offer to help the user understand or reuse the commands.
