# Plugins Overview

## Core Plugins

| Plugin | Purpose | Key Commands |
|--------|---------|--------------|
| **kit** | Code search (text, AST, semantic) | MCP tools -- see @./MCP_TOOLS.md |

## Extracted Plugins (Two-Repo Architecture)

Extracted plugins live in separate repos following a two-repo pattern:

### Git Plugin --> `side-quest-git` + `side-quest-plugins`

| Repo | Purpose |
|------|---------|
| `side-quest-git` (npm: `@side-quest/git`) | Reusable git utilities library |
| `side-quest-plugins/plugins/git/` | Plugin wrapper with hooks, commands, skills |

### Runners

The runner MCP servers are split across two repos:

### MCP Server Code → `side-quest-runners`

Published npm packages containing the actual MCP tool implementations:

| Package | Purpose | Tools |
|---------|---------|-------|
| `@side-quest/bun-runner` | Test execution | `bun_runTests`, `bun_testFile`, `bun_testCoverage` |
| `@side-quest/biome-runner` | Lint & format | `biome_lintCheck`, `biome_lintFix`, `biome_formatCheck` |
| `@side-quest/tsc-runner` | TypeScript checking | `tsc_check` |

### Claude Code Plugins → `side-quest-plugins`

Plugin wrappers that configure and extend the MCP servers:

| Plugin | Contains |
|--------|----------|
| `bun-runner` | `.mcp.json` (points to npm package), PostToolUse hooks |
| `biome-runner` | `.mcp.json`, hooks for auto-lint on file changes |
| `tsc-runner` | `.mcp.json`, hooks for type checking |
| `x-api` | Full MCP server + plugin (Twitter/X API) |

**Setup:** Install the plugin from `side-quest-plugins` — it references the npm package via `bunx @side-quest/<runner>`.

## Utility Plugins

| Plugin | Purpose | Key Commands |
|--------|---------|--------------|
| **atuin** | Bash history search | MCP: `atuin_search_history` |
| **clipboard** | System clipboard | `/clipboard:copy`, `/clipboard:paste` |
| **firecrawl** | Web scraping | `/firecrawl:scrape`, `/firecrawl:search` |
| **plugin-template** | Plugin scaffolding | `/plugin-template:create` |
| **para-brain** | Obsidian PARA method | Slash commands for note management |

## External Dependencies

| Plugin | Requires |
|--------|----------|
| kit | `uv tool install cased-kit` |
| atuin | `brew install atuin` |
| firecrawl | Firecrawl API key |

---

Full catalog: @../.claude-plugin/marketplace.json
