# Plugins Overview

## Core Plugins

| Plugin | Purpose | Key Commands |
|--------|---------|--------------|
| **kit** | Code search (text, AST, semantic) | MCP tools — see @./MCP_TOOLS.md |
| **git** | Git intelligence & workflow | `/git:commit`, `/git:create-pr`, `/git:history` |
| **bun-runner** | Test execution | MCP: `bun_runTests`, `bun_testFile` |
| **biome-runner** | Lint & format | MCP: `biome_lintCheck`, `biome_lintFix` |
| **tsc-runner** | TypeScript checking | MCP: `mcp__tsc-runner_tsc-runner__tsc_check` |

## Utility Plugins

| Plugin | Purpose | Key Commands |
|--------|---------|--------------|
| **atuin** | Bash history search | MCP: `mcp__atuin_bash-history__atuin_search_history` |
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
