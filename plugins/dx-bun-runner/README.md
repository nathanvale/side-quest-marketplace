# dx-bun-runner Plugin for Claude Code

Bun test runner with post-edit hooks and an MCP server for on-demand test execution.

## Components

| Component | Mechanism | Trigger | Behavior |
|-----------|-----------|---------|----------|
| `bun_runTests` MCP tool | JSON-RPC over stdio | On-demand | Run all tests with structured JSON results |
| `bun_testFile` MCP tool | JSON-RPC over stdio | On-demand | Run tests in a specific file |
| `bun_testCoverage` MCP tool | JSON-RPC over stdio | On-demand | Run tests with coverage reporting |
| PostToolUse hook | Shell script via bun | Write/Edit/MultiEdit | Blocks on failures in edited test files only |
| Stop hook | Shell script via bun | Session end | Blocks on any project-wide test failures |

## MCP Tools

The MCP tools are provided by the `@side-quest/bun-runner` npm package. Use `response_format: "json"` for structured output:

```typescript
bun_runTests({ response_format: "json" })
bun_testFile({ response_format: "json" })
bun_testCoverage({ response_format: "json" })
```

## Hook Behavior

**PostToolUse (bun-test.ts)**
- Fires after every Write, Edit, or MultiEdit on source or test files
- For test files (`.test.ts`, `.spec.ts`, etc.), runs them directly
- For source files (`.ts`, `.tsx`, etc.), finds and runs the corresponding test file if it exists
- Runs `bun test <file>` for each matched test file
- Returns structured JSON with `decision: "block"` and failure details
- 30s timeout, exits cleanly on timeout (non-blocking)

**Stop (bun-test-ci.ts)**
- Fires at session end
- Runs `bun test` at git root (all tests)
- Skips if no test files were changed
- Checks `stop_hook_active` to prevent infinite loops
- 120s timeout, exits cleanly on timeout (non-blocking)

## Commands

- `/dx-bun-runner:show-logs` -- View MCP server and hook logs from `~/.claude/logs/bun-runner.jsonl`

## Prerequisites

- [Bun](https://bun.sh/) runtime
- Project with test files (`*.test.ts`, `*.spec.ts`, etc.)
- `@side-quest/bun-runner` npm package (for MCP tools)

## License

MIT
