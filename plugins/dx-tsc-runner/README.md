# dx-tsc-runner Plugin for Claude Code

TypeScript type checker with post-edit hooks and an MCP server for on-demand checks.

## Components

| Component | Mechanism | Trigger | Behavior |
|-----------|-----------|---------|----------|
| `tsc_check` MCP tool | JSON-RPC over stdio | On-demand | Structured JSON with `file:line:col` errors |
| PostToolUse hook | Shell script via bun | Write/Edit/MultiEdit on .ts | Blocks on errors in edited files only |
| MCP dedup hook | `sq-claude-hook` via bunx | PostToolUse/PostToolUseFailure on runner MCP tools | Points Claude to MCP output instead of repeating diagnostics |
| Stop hook | Shell script via bun | Session end | Blocks on any project-wide errors |

## MCP Tool

The `tsc_check` tool is provided by the `@side-quest/tsc-runner` npm package. Use `response_format: "json"` for structured output:

```
tsc_check({ response_format: "json" })
```

## Hook Behavior

**PostToolUse (tsc-check.ts)**
- Fires after every Write, Edit, or MultiEdit on TypeScript files
- Groups edited files by nearest `tsconfig.json`
- Runs `tsc --noEmit --incremental` per config directory (in parallel)
- Only reports errors in the files you just edited (not pre-existing errors)
- Returns structured JSON with `decision: "block"` and error details
- 30s timeout, exits cleanly on timeout (non-blocking)

**PostToolUse/PostToolUseFailure MCP dedup adapter (`sq-claude-hook`)**
- Fires after `tsc_check`
- Runs `SQ_HOOK_DEDUP_ENABLED=1 bunx @side-quest/claude-hooks posttool` and `posttool-failure`
- Emits a short pointer back to the MCP output when Claude already has structured runner diagnostics
- Falls back to a compact hook summary if the MCP response is unavailable
- Uses bounded stdin parsing, short-lived dedup cache entries, and stderr-only observability from `@side-quest/claude-hooks`

**Stop (tsc-ci.ts)**
- Fires at session end
- Runs full project-wide type check (all errors, not just edited files)
- Detects Bun workspaces and runs `bun run --filter * typecheck` if present
- Skips if no TypeScript files were changed
- Checks `stop_hook_active` to prevent infinite loops
- 120s timeout, exits cleanly on timeout (non-blocking)

Both hooks use `--incremental` for 80-95% faster warm-cache checks. This writes `.tsbuildinfo` files next to your `tsconfig.json` -- add them to `.gitignore`. If the cache becomes corrupted, delete the `.tsbuildinfo` file and the next run rebuilds it.

## Commands

- `/dx-tsc-runner:show-logs` -- View MCP server and hook logs from `~/.claude/logs/tsc-runner.jsonl`

## Prerequisites

- [Bun](https://bun.sh/) runtime
- TypeScript project with `tsconfig.json`
- `@side-quest/tsc-runner` npm package (for MCP tool)
- `bunx` access to `@side-quest/claude-hooks` (for MCP dedup hook adapter)

## License

MIT
