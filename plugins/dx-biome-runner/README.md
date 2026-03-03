# dx-biome-runner Plugin for Claude Code

Biome linter and formatter with post-edit hooks and an MCP server for on-demand checks.

## Components

| Component | Mechanism | Trigger | Behavior |
|-----------|-----------|---------|----------|
| `biome_lintCheck` MCP tool | JSON-RPC over stdio | On-demand | Structured JSON with lint diagnostics |
| `biome_lintFix` MCP tool | JSON-RPC over stdio | On-demand | Auto-fix lint and format issues |
| `biome_formatCheck` MCP tool | JSON-RPC over stdio | On-demand | Check formatting without changes |
| PostToolUse hook | Shell script via bun | Write/Edit/MultiEdit | Blocks on errors in edited files only |
| Stop hook | Shell script via bun | Session end | Blocks on any project-wide errors |

## MCP Tools

The MCP tools are provided by the `@side-quest/biome-runner` npm package. Use `response_format: "json"` for structured output:

```typescript
biome_lintCheck({ response_format: "json" })
biome_lintFix({ response_format: "json" })
biome_formatCheck({ response_format: "json" })
```

## Hook Behavior

**PostToolUse (biome-check.ts)**
- Fires after every Write, Edit, or MultiEdit on supported files
- Supported extensions: `.ts`, `.tsx`, `.js`, `.jsx`, `.json`, `.jsonc`, `.css`
- Runs `biome check --reporter=json` on the specific edited files
- Only blocks on errors (warnings are allowed through)
- Returns structured JSON with `decision: "block"` and diagnostic details
- 30s timeout, exits cleanly on timeout (non-blocking)

**Stop (biome-ci.ts)**
- Fires at session end
- Runs `biome check --reporter=json` on the project root (all errors, not just edited files)
- Skips if no Biome-relevant files were changed
- Checks `stop_hook_active` to prevent infinite loops
- 120s timeout, exits cleanly on timeout (non-blocking)

## Commands

- `/dx-biome-runner:show-logs` -- View MCP server and hook logs from `~/.claude/logs/biome-runner.jsonl`

## Prerequisites

- [Bun](https://bun.sh/) runtime
- Project with `biome.json` configuration
- `@side-quest/biome-runner` npm package (for MCP tools)

## License

MIT
