---
name: mcp-manager
description: |
  Manage MCP (Model Context Protocol) servers for Claude Code. Use this skill when the user asks about:
  adding MCP servers, removing MCP servers, listing MCP servers, configuring MCP, finding new MCP servers,
  discovering MCP integrations, "mcp add", "mcp list", "mcp remove", project scope, user scope, local scope,
  "what MCP servers", "connect to", OAuth authentication, Firecrawl search for MCP servers.
allowed-tools: Bash, WebFetch, WebSearch, Read, Grep, Glob
---

# MCP Server Manager

This skill manages MCP (Model Context Protocol) servers for Claude Code at the user level and project level.

## Quick Reference

```bash
# List all MCP servers
claude mcp list

# Check server status (inside Claude Code)
/mcp

# Add servers
claude mcp add --transport http <name> <url>           # Remote HTTP server
claude mcp add --transport stdio <name> -- <command>   # Local stdio server

# Remove a server
claude mcp remove <name>

# Get server details
claude mcp get <name>
```

## Understanding Scopes

MCP servers can be configured at three scope levels:

| Scope | Storage | Visibility | Use Case |
|-------|---------|------------|----------|
| `local` | Project user settings | Only you, this project | Personal dev servers, experiments |
| `project` | `.mcp.json` (committed) | Everyone on team | Shared team tools |
| `user` | Global user settings | You, all projects | Personal utilities |

**Precedence**: local > project > user (local overrides project, etc.)

## Adding MCP Servers

### REQUIRED: Ask User About Installation Scope

**BEFORE adding ANY MCP server, ALWAYS use the AskUserQuestion tool to ask the user where they want it installed.**

This is mandatory behavior - never assume the scope. Use this pattern:

```
AskUserQuestion with:
- question: "Where would you like to install the <server-name> MCP server?"
- header: "Install scope"
- options:
  1. "User (global)" - "Available in all your projects (~/.claude.json)"
  2. "Project (local)" - "Only in this project (.mcp.json, not committed)"
  3. "Project (shared)" - "Shared with team (committed to .mcp.json)"
```

**Example AskUserQuestion call:**
```json
{
  "questions": [{
    "question": "Where would you like to install the snap-happy MCP server?",
    "header": "Install scope",
    "options": [
      {"label": "User (global)", "description": "Available in all your projects - stored in ~/.claude.json"},
      {"label": "Project (local)", "description": "Only you, only this project - stored in project settings"},
      {"label": "Project (shared)", "description": "Shared with team - committed to .mcp.json"}
    ],
    "multiSelect": false
  }]
}
```

**After the user responds, map their choice to the correct scope flag:**
- "User (global)" → `--scope user`
- "Project (local)" → `--scope local` (default, can omit)
- "Project (shared)" → `--scope project`

### Remote HTTP Servers (Recommended)

```bash
# Basic syntax
claude mcp add --transport http <name> <url>

# Add at user scope (available everywhere)
claude mcp add --transport http <name> --scope user <url>

# Add at project scope (shared with team via .mcp.json)
claude mcp add --transport http <name> --scope project <url>

# With authentication header
claude mcp add --transport http <name> <url> --header "Authorization: Bearer <token>"
```

**Examples:**
```bash
# GitHub (OAuth - authenticate via /mcp after adding)
claude mcp add --transport http github https://api.githubcopilot.com/mcp/

# Notion
claude mcp add --transport http notion https://mcp.notion.com/mcp

# Sentry
claude mcp add --transport http sentry https://mcp.sentry.dev/mcp

# Linear
claude mcp add --transport http linear https://mcp.linear.app/sse

# Stripe
claude mcp add --transport http stripe https://mcp.stripe.com
```

### Local Stdio Servers

```bash
# Basic syntax (note the -- separator)
claude mcp add --transport stdio <name> -- <command> [args...]

# With environment variable
claude mcp add --transport stdio <name> --env KEY=value -- <command>

# User scope
claude mcp add --transport stdio <name> --scope user -- <command>
```

**Examples:**
```bash
# Filesystem access
claude mcp add --transport stdio filesystem -- npx -y @modelcontextprotocol/server-filesystem /path/to/allow

# PostgreSQL database
claude mcp add --transport stdio db -- npx -y @bytebase/dbhub --dsn "postgresql://user:pass@host:5432/db"

# Airtable
claude mcp add --transport stdio airtable --env AIRTABLE_API_KEY=your_key -- npx -y airtable-mcp-server

# Brave Search
claude mcp add --transport stdio brave --env BRAVE_API_KEY=your_key -- npx -y @anthropic/mcp-brave-search

# Puppeteer (browser automation)
claude mcp add --transport stdio puppeteer -- npx -y @anthropic/mcp-puppeteer

# Memory (knowledge graph)
claude mcp add --transport stdio memory -- npx -y @anthropic/mcp-memory

# Sequential thinking
claude mcp add --transport stdio thinking -- npx -y @anthropic/mcp-sequential-thinking

# Firecrawl (web scraping)
claude mcp add --transport stdio firecrawl --env FIRECRAWL_API_KEY=your_key -- npx -y firecrawl-mcp
```

### Import from Claude Desktop

```bash
# Interactive import
claude mcp add-from-claude-desktop

# Import to user scope
claude mcp add-from-claude-desktop --scope user
```

### Add from JSON Configuration

```bash
# HTTP server from JSON
claude mcp add-json api-server '{"type":"http","url":"https://api.example.com/mcp","headers":{"Authorization":"Bearer token"}}'

# Stdio server from JSON
claude mcp add-json local-tool '{"type":"stdio","command":"npx","args":["-y","some-package"],"env":{"KEY":"value"}}'
```

## Listing MCP Servers

```bash
# List all configured servers
claude mcp list

# Inside Claude Code, check status and authenticate
/mcp
```

## Removing MCP Servers

```bash
# Remove a server
claude mcp remove <name>

# Get details first
claude mcp get <name>
```

## OAuth Authentication

For servers requiring OAuth (GitHub, Sentry, etc.):

1. Add the server: `claude mcp add --transport http github https://api.githubcopilot.com/mcp/`
2. In Claude Code, run `/mcp`
3. Select "Authenticate" for the server
4. Complete OAuth flow in browser

To revoke access, use `/mcp` and select "Clear authentication".

## Project-Level Configuration (.mcp.json)

When using `--scope project`, Claude Code creates/updates `.mcp.json`:

```json
{
  "mcpServers": {
    "github": {
      "type": "http",
      "url": "https://api.githubcopilot.com/mcp/"
    },
    "db": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@bytebase/dbhub", "--dsn", "${DB_URL}"],
      "env": {}
    }
  }
}
```

**Environment variable expansion supported:**
- `${VAR}` - Expands to value of VAR
- `${VAR:-default}` - Uses default if VAR not set

## Claude Desktop Configuration

Claude Desktop uses a separate config file and does NOT support `${VAR}` environment variable expansion. Instead, use a zsh wrapper to source environment variables.

**Config location:** `~/Library/Application Support/Claude/claude_desktop_config.json`

### Environment Variable Pattern for Claude Desktop

For servers requiring API keys, wrap the command with zsh to source your env file:

```json
{
  "mcpServers": {
    "tavily-mcp": {
      "command": "/bin/zsh",
      "args": ["-c", "source ~/code/dotfiles/.env && exec npx -y tavily-mcp@0.1.2"]
    },
    "firecrawl": {
      "command": "/bin/zsh",
      "args": ["-c", "source ~/code/dotfiles/.env && exec npx -y firecrawl-mcp"]
    }
  }
}
```

**Key points:**
- Use `/bin/zsh -c` to run a shell command
- `source ~/code/dotfiles/.env` loads environment variables (TAVILY_API_KEY, FIRECRAWL_API_KEY, etc.)
- `exec` replaces the shell process with the actual server
- The `.env` file should export the variables: `export TAVILY_API_KEY="your-key"`

### Nathan's Environment Setup

Environment variables are stored in `~/code/dotfiles/.env` and sourced by:
- `.zshrc` (for terminal sessions and Claude Code)
- Claude Desktop configs (via zsh wrapper pattern above)

**Adding new API keys:**
1. Add to `~/code/dotfiles/.env`: `export NEW_API_KEY="your-key"`
2. For Claude Code: Use `--env 'NEW_API_KEY=${NEW_API_KEY}'` (auto-expanded from shell)
3. For Claude Desktop: Use the zsh sourcing pattern above

### Full Claude Desktop Example

```json
{
  "mcpServers": {
    "codemcp": {
      "command": "/opt/homebrew/bin/uvx",
      "args": ["--from", "git+https://github.com/ezyang/codemcp@prod", "codemcp"]
    },
    "claude-code": {
      "command": "claude",
      "args": ["mcp", "serve"],
      "env": {}
    },
    "wallaby": {
      "command": "npx",
      "args": ["-y", "-c", "node ~/.wallaby/mcp/"],
      "env": {}
    },
    "context7": {
      "command": "npx",
      "args": ["-y", "@upstash/context7-mcp"]
    },
    "tavily-mcp": {
      "command": "/bin/zsh",
      "args": ["-c", "source ~/code/dotfiles/.env && exec npx -y tavily-mcp@0.1.2"]
    },
    "firecrawl": {
      "command": "/bin/zsh",
      "args": ["-c", "source ~/code/dotfiles/.env && exec npx -y firecrawl-mcp"]
    },
    "sequential-thinking": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-sequential-thinking"]
    },
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/Users/nathanvale/code", "/Users/nathanvale/Documents"]
    },
    "puppeteer": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-puppeteer"]
    }
  },
  "preferences": {
    "menuBarEnabled": false
  }
}
```

## Finding New MCP Servers

### Search Strategy

To discover MCP servers, I will:

1. **Search the official MCP servers repository**: https://github.com/modelcontextprotocol/servers
2. **Search npm for MCP packages**: Look for `mcp-server` or `@modelcontextprotocol` packages
3. **Use Firecrawl/WebSearch** to find community MCP servers

### Popular MCP Server Categories

| Category | Example Servers |
|----------|----------------|
| **Productivity** | GitHub, Linear, Notion, Asana, Jira |
| **Databases** | PostgreSQL, MySQL, SQLite, MongoDB |
| **Cloud** | AWS, GCP, Azure, Cloudflare |
| **Monitoring** | Sentry, Datadog, New Relic |
| **Communication** | Slack, Discord, Gmail |
| **Files** | Filesystem, Google Drive, Dropbox |
| **Search** | Brave Search, Exa, Tavily |
| **Browser** | Puppeteer, Playwright, Browserbase |
| **AI/ML** | HuggingFace, OpenAI, Memory |

### Discovering MCP Servers with Firecrawl

When the user wants to find MCP servers, I should:

1. **Search the web** for available MCP servers matching their needs
2. **Check official sources**:
   - https://github.com/modelcontextprotocol/servers
   - https://modelcontextprotocol.io/
3. **Search npm registry** for MCP packages
4. **Validate** the server exists and is maintained

```bash
# Example search for database MCP servers
# Use WebSearch to find: "MCP server database postgresql site:github.com"
# Or: "Model Context Protocol server" + category
```

## Troubleshooting

### Server won't connect

```bash
# Check server details
claude mcp get <name>

# Inside Claude Code
/mcp

# Check if it's a timeout issue
MCP_TIMEOUT=10000 claude
```

### OAuth not working

1. Run `/mcp` in Claude Code
2. Select the server
3. Choose "Clear authentication"
4. Re-authenticate

### Windows Issues

On native Windows, wrap npx commands:
```bash
claude mcp add --transport stdio my-server -- cmd /c npx -y @some/package
```

### Project servers not loading

```bash
# Reset project server approvals
claude mcp reset-project-choices
```

## Common Workflows

### Add Team Tools (Project Scope)

```bash
# Add shared servers to .mcp.json
claude mcp add --transport http github --scope project https://api.githubcopilot.com/mcp/
claude mcp add --transport http linear --scope project https://mcp.linear.app/sse

# Commit to share with team
git add .mcp.json
git commit -m "Add team MCP server configuration"
```

### Personal Dev Setup (User Scope)

```bash
# Add servers available in all projects
claude mcp add --transport stdio filesystem --scope user -- npx -y @modelcontextprotocol/server-filesystem ~/code
claude mcp add --transport http github --scope user https://api.githubcopilot.com/mcp/
```

### Database Integration

```bash
# PostgreSQL
claude mcp add --transport stdio db -- npx -y @bytebase/dbhub --dsn "postgresql://user:pass@localhost:5432/mydb"

# Then ask Claude:
# "Show me the schema for the users table"
# "Find orders from the last 7 days"
```

## Reference Documentation

For discovering new MCP servers, see [reference/discovery.md](reference/discovery.md).
