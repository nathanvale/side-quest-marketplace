# Atuin Plugin for Claude Code

Integrates [Atuin](https://atuin.sh/) shell history with Claude Code, providing intelligent command history search and automatic capture of executed commands.

## Features

### MCP Server: bash-history
Provides two tools for searching command history:
- `search_history` - Fuzzy search through command history
- `get_recent_history` - Get most recent commands

### Hook: PostToolUse
Automatically captures all Bash commands executed by Claude Code and adds them to your Atuin history with:
- Exit codes
- Timestamps
- Full command text

### Slash Command
- `/atuin:history [query]` - Search your command history

### Skill: bash-history
Claude can autonomously search your history when you ask questions like:
- "How did I deploy last time?"
- "What git commands did I run?"
- "Find the docker command I used before"

## Prerequisites

- [Atuin](https://atuin.sh/) installed and configured
- `jq` installed (for hook JSON parsing)
- Node.js 18+ (for MCP server)

## Installation

1. Install the plugin:
   ```bash
   /plugin install atuin@nathan-vale-claude-code
   ```

2. Restart Claude Code to activate the plugin

Dependencies are automatically installed on first startup via the SessionStart hook.

## Configuration

### Debug Mode
Enable debug logging for the hook:
```bash
export CLAUDE_ATUIN_DEBUG=1
```

Logs are written to `hooks/atuin-hook.log` in the plugin directory.

## Usage

### Search History
```
/atuin:history docker
```

### Ask Claude
Just ask naturally:
- "What commands did I run to set up the database?"
- "Show me my recent git commands"
- "How did I fix that npm issue last week?"

## License

MIT
