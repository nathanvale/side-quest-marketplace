# Atuin Plugin for Claude Code

Integrates Atuin shell history with Claude Code for intelligent command history search, retrieval, and automatic command capture.

## Directory Structure

```
atuin/
├── src/                    # MCP server code (Bun-based)
│   ├── index.ts           # Main MCP server with tools
│   └── index.test.ts      # MCP server tests
├── hooks/                  # Post-tool-use hook for capturing commands
│   ├── atuin-post-tool.sh # Shell hook to capture executed commands
│   └── hooks.json         # Hook configuration
├── commands/              # Slash command definitions
│   └── history.md         # /atuin:history command prompt
├── skills/                # Autonomous skill for Claude
│   └── bash-history/      # Skill allows Claude to autonomously search
├── .claude-plugin/        # Plugin metadata
├── .mcp.json             # MCP server configuration
├── package.json          # Dependencies (mcpez)
├── tsconfig.json         # TypeScript config
└── README.md             # User-facing documentation
```

## Commands

```bash
bun test --recursive       # Run tests
tsc --noEmit              # Type checking
biome format --write .    # Format code
biome lint .              # Lint code
biome check --write .     # Lint and format
```

## Key Files

- `src/index.ts` — MCP server with 4 tools for history search and insights
- `hooks/atuin-post-tool.sh` — Captures all Bash commands executed by Claude with exit codes
- `skills/bash-history/SKILL.md` — Enables autonomous history search skills

## MCP Tools

| Tool | Purpose |
|------|---------|
| `atuin_search_history` | Fuzzy/prefix/full-text search with filtering by time, directory, exit code |
| `atuin_get_recent_history` | Get N most recent commands |
| `atuin_search_by_context` | Filter by git branch or Claude session ID |
| `atuin_history_insights` | Stats on frequent commands and failure patterns |

## Key Features

- **History Search** — Fuzzy, prefix, or full-text search with optional filters (time range, directory, exit code)
- **Context Tracking** — Commands tagged with git branch and Claude session ID in `~/.claude/atuin-context.jsonl`
- **Post-Tool Hook** — Automatically captures all `Bash` tool executions
- **Fallback to zsh** — If atuin unavailable, falls back to `fc -l | grep`
- **Insights** — Frequency analysis and failure pattern detection

## Architecture

**MCP Server (mcpez)** → Bun TypeScript server that exposes 4 tools via `startServer("bash-history")`

**Execution:**
1. User invokes `/atuin:history [query]` or asks Claude a question
2. MCP tool executes atuin command: `atuin search --limit N --search-mode [fuzzy|prefix|full-text]`
3. Results parsed and formatted (markdown or JSON)
4. Hook captures all executed commands asynchronously

## Code Standards

- **Bun runtime** — Lightweight, fast
- **TypeScript strict mode** — Full type safety
- **mcpez framework** — Minimal boilerplate MCP implementation
- **Biome formatting** — Consistent style
- **Tab indentation** — Per project standards

## Testing

```bash
bun test --recursive          # Run all tests
bun test src/index.test.ts    # Test MCP server tools
bun test hooks/               # Test hooks if present
```

Focus: MCP tool output validation, error handling for atuin failures

## Git Workflow

Commits follow: `<type>(<scope>): <subject>`

Examples:
- `feat(atuin): add context search by branch`
- `fix(hook): handle missing atuin fallback to zsh`
- `test(atuin): add search filter tests`

## Notable Patterns

**Overloaded Functions** — `searchHistory()` accepts either string query or `SearchOptions` object (src/index.ts:115-130)

**Error Resilience** — If atuin fails, falls back to zsh `fc -l | grep` (src/index.ts:159-188)

**JSON Line Format** — Context entries stored as JSONL in `~/.claude/atuin-context.jsonl` for easy append/query (src/index.ts:207)

**Format Negotiation** — All tools support both markdown and JSON output for flexibility

## Dependencies

- `mcpez` — MCP framework for tool registration and server startup
- `@types/bun` — TypeScript definitions for Bun runtime

## Environment Variables

- `CLAUDE_ATUIN_DEBUG=1` — Enable debug logging for hook (logs to `hooks/atuin-hook.log`)

## Notes

- Plugin requires Atuin installed (`atuin --version`)
- Requires `jq` for hook JSON parsing
- Context file grows over time — periodic cleanup may be needed
- Search limits default to 10 but customizable per query
