# MCP Server Discovery Guide

This document provides strategies for finding and evaluating MCP servers.

## Official Sources

### Model Context Protocol Servers Repository

**URL**: https://github.com/modelcontextprotocol/servers

The official repository maintained by Anthropic with reference implementations and community servers.

**Categories in the repo:**
- Data & File Systems (filesystem, git, postgres, sqlite)
- Developer Tools (GitHub, GitLab, Docker)
- Productivity (Slack, Google Drive, Gmail)
- Search & Web (Brave Search, Puppeteer)
- AI & Knowledge (Memory, Sequential Thinking)

### MCP Documentation

**URL**: https://modelcontextprotocol.io/

Official documentation with:
- Protocol specification
- SDK documentation (Python, TypeScript)
- Integration guides

## Search Strategies

### Using Firecrawl for Discovery

When the user wants to find MCP servers, use web search and Firecrawl to:

1. **Search GitHub**:
   ```
   WebSearch: "MCP server" <category> site:github.com
   WebSearch: "@modelcontextprotocol" <tool> site:github.com
   WebSearch: "Model Context Protocol server" <integration>
   ```

2. **Search npm**:
   ```
   WebSearch: "mcp-server" <tool> site:npmjs.com
   WebSearch: "@modelcontextprotocol" site:npmjs.com
   ```

3. **Crawl discovered repositories** with WebFetch to:
   - Verify the server exists
   - Get installation instructions
   - Check maintenance status (last commit, stars, issues)

### Search Queries by Category

| Need | Search Query |
|------|-------------|
| Database | `"MCP server" database postgresql mysql site:github.com` |
| Cloud | `"MCP server" AWS GCP Azure site:github.com` |
| Productivity | `"MCP server" notion slack linear site:github.com` |
| Browser | `"MCP server" puppeteer playwright browser site:github.com` |
| Search | `"MCP server" search brave exa tavily site:github.com` |
| Files | `"MCP server" filesystem storage drive site:github.com` |
| API | `"MCP server" REST API integration site:github.com` |

## Evaluating MCP Servers

Before recommending an MCP server, evaluate:

### Quality Indicators

| Indicator | Good Sign | Warning Sign |
|-----------|-----------|--------------|
| Last commit | < 3 months | > 1 year |
| Stars | 50+ | < 10 |
| Issues | Active responses | Many stale issues |
| Documentation | Clear README | No docs |
| Publisher | Known org / @anthropic / @modelcontextprotocol | Anonymous |

### Security Considerations

- **Trust level**: Only recommend servers from trusted sources
- **Permissions**: Check what access the server requires
- **Data handling**: Review what data the server accesses
- **Dependency audit**: Check for known vulnerabilities

## Popular MCP Servers Reference

### Official/Reference Servers (@modelcontextprotocol)

| Server | Package | Transport | Purpose |
|--------|---------|-----------|---------|
| Filesystem | `@modelcontextprotocol/server-filesystem` | stdio | File system access |
| Git | `@modelcontextprotocol/server-git` | stdio | Git operations |
| GitHub | `https://api.githubcopilot.com/mcp/` | http | GitHub integration |
| PostgreSQL | `@modelcontextprotocol/server-postgres` | stdio | Database queries |
| SQLite | `@modelcontextprotocol/server-sqlite` | stdio | SQLite database |
| Memory | `@modelcontextprotocol/server-memory` | stdio | Knowledge graph |
| Sequential Thinking | `@modelcontextprotocol/server-sequential-thinking` | stdio | Reasoning chains |
| Puppeteer | `@modelcontextprotocol/server-puppeteer` | stdio | Browser automation |
| Brave Search | `@modelcontextprotocol/server-brave-search` | stdio | Web search |
| Fetch | `@modelcontextprotocol/server-fetch` | stdio | HTTP requests |
| Slack | `@modelcontextprotocol/server-slack` | stdio | Slack integration |
| Google Drive | `@modelcontextprotocol/server-gdrive` | stdio | Drive files |

### Third-Party Popular Servers

| Server | Source | Transport | Purpose |
|--------|--------|-----------|---------|
| Sentry | `https://mcp.sentry.dev/mcp` | http | Error monitoring |
| Linear | `https://mcp.linear.app/sse` | sse | Project management |
| Notion | `https://mcp.notion.com/mcp` | http | Notion workspace |
| Firecrawl | `firecrawl-mcp` | stdio | Web scraping |
| Dbhub | `@bytebase/dbhub` | stdio | Multi-database |
| Exa | `exa-mcp-server` | stdio | AI search |
| Tavily | `tavily-mcp` | stdio | AI search |
| Airtable | `airtable-mcp-server` | stdio | Airtable data |

## Installation Templates

### HTTP Servers (OAuth)

```bash
# GitHub
claude mcp add --transport http github https://api.githubcopilot.com/mcp/

# Sentry
claude mcp add --transport http sentry https://mcp.sentry.dev/mcp

# Notion
claude mcp add --transport http notion https://mcp.notion.com/mcp

# Linear (uses SSE transport)
claude mcp add --transport sse linear https://mcp.linear.app/sse
```

### Stdio Servers (npm packages)

```bash
# Filesystem
claude mcp add --transport stdio filesystem -- npx -y @modelcontextprotocol/server-filesystem /allowed/path

# PostgreSQL
claude mcp add --transport stdio postgres -- npx -y @modelcontextprotocol/server-postgres postgresql://user:pass@host:5432/db

# SQLite
claude mcp add --transport stdio sqlite -- npx -y @modelcontextprotocol/server-sqlite /path/to/database.db

# Memory (knowledge graph)
claude mcp add --transport stdio memory -- npx -y @modelcontextprotocol/server-memory

# Puppeteer
claude mcp add --transport stdio puppeteer -- npx -y @modelcontextprotocol/server-puppeteer

# Brave Search (requires API key)
claude mcp add --transport stdio brave-search --env BRAVE_API_KEY=your_key -- npx -y @modelcontextprotocol/server-brave-search

# Git
claude mcp add --transport stdio git -- npx -y @modelcontextprotocol/server-git --repository /path/to/repo

# Slack (requires token)
claude mcp add --transport stdio slack --env SLACK_BOT_TOKEN=xoxb-... -- npx -y @modelcontextprotocol/server-slack

# Google Drive (requires credentials)
claude mcp add --transport stdio gdrive -- npx -y @modelcontextprotocol/server-gdrive

# Firecrawl (requires API key)
claude mcp add --transport stdio firecrawl --env FIRECRAWL_API_KEY=your_key -- npx -y firecrawl-mcp

# Dbhub (multi-database)
claude mcp add --transport stdio dbhub -- npx -y @bytebase/dbhub --dsn "postgresql://..."
```

## Workflow: Finding a New MCP Server

When the user asks to find an MCP server for a specific purpose:

1. **Understand the need**: What integration/tool do they want?

2. **Check known servers first**: Look at the tables above

3. **Search if not found**:
   ```
   WebSearch: "MCP server" <their need> site:github.com
   ```

4. **Evaluate results**:
   - Check repository quality (stars, recent commits)
   - Verify it's actually an MCP server
   - Read installation instructions

5. **Provide installation command**:
   - Format correctly for their needs (scope, transport)
   - Include any required environment variables
   - Note if OAuth is needed

6. **Verify installation**:
   ```bash
   claude mcp list
   # or inside Claude Code:
   /mcp
   ```

## Common Discovery Requests

| User Request | Search For |
|--------------|------------|
| "I need to query my database" | PostgreSQL, MySQL, SQLite, Dbhub |
| "Connect to GitHub" | GitHub HTTP server |
| "Error monitoring" | Sentry |
| "Project management" | Linear, Jira, Asana |
| "Web scraping" | Firecrawl, Puppeteer, Playwright |
| "Search the web" | Brave Search, Exa, Tavily |
| "File access" | Filesystem |
| "Knowledge storage" | Memory |
| "Cloud provider" | AWS, GCP, Azure servers |
| "Communication" | Slack, Discord, Gmail |
