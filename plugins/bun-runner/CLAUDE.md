# Bun-Runner Plugin for Claude Code

Test runner for Bun with token-efficient MCP tools that focus on test failures and coverage.

## Directory Structure

```
bun-runner/
├── mcp-servers/bun-runner/    # MCP server with 3 tools
│   ├── index.ts               # Test runner tools
│   ├── index.test.ts          # MCP tool tests
│   ├── path-validator.ts      # Path validation for security
│   └── package.json           # MCP dependencies (mcpez)
├── hooks/                     # SessionStart bootstrap hook
│   ├── hooks.json             # Hook configuration
├── .claude-plugin/            # Plugin metadata
├── .mcp.json                  # MCP server config
└── package.json               # Dependencies
```

## Commands

```bash
bun test --recursive       # Run all tests
bun test --filter '*'      # Run tests in all workspace packages
```

## Key Files

- `mcp-servers/bun-runner/index.ts` — MCP server with 3 test runner tools
- `hooks/hooks.json` — SessionStart bootstrap hook
- `path-validator.ts` — Security validation for file paths

## MCP Tools (3 Total)

| Tool | Purpose | Output Format |
|------|---------|---------------|
| `bun_runTests` | Run tests with pattern filtering | Failures only (token-efficient) |
| `bun_testFile` | Run tests for specific file | Failures only |
| `bun_testCoverage` | Run tests with coverage report | Summary + low-coverage files |

## Architecture

**Test runner design:**
- 3 MCP tools for running Bun tests with structured output
- Workspace-aware: Uses `bun --filter '*' test` for workspace projects
- Token-efficient: Shows only test failures and coverage

**Workspace Detection:**
```typescript
// Detects if package.json has workspaces array
// In workspaces, uses `bun --filter '*' test` to respect package-level configs
// Otherwise uses direct `bun test`
```

**Token-Efficient Output:**
- **Tests**: Show only failures, suppress passing tests and verbose logs
- **Coverage**: Show coverage percentage and files with low coverage (<50%)

## Code Standards

- **Bun-native APIs** — Uses `Bun.spawn()` instead of Node.js `child_process`
- **TypeScript strict mode** — Full type safety
- **AbortController for timeouts** — Avoids Bun's buggy timeout option
- **Parallel stream consumption** — Read stdout/stderr concurrently with `proc.exited`

## Key Features

### Workspace-Aware Testing
- Detects workspace structure from package.json
- Runs tests in all packages using `--filter '*'`
- Respects package-level bunfig.toml configurations

### Pattern Filtering
- Run specific tests with pattern: `bun_runTests(pattern: "auth")`
- Supports test file names and glob patterns
- Security-validated paths prevent directory traversal

### Coverage Reports
- Runs tests with coverage tracking
- Shows overall coverage percentage
- Highlights files with low coverage (<50%)

## Testing

```bash
bun test --recursive              # All tests for this plugin
bun test mcp-servers/             # MCP tool tests only
```

**Test Coverage:**
- Output parsers (Bun test output)
- Workspace detection logic
- Path validation for security
- MCP tool integration

## Notable Patterns

**Race Condition Fix** — Read streams in parallel with exit:
```typescript
// WRONG: Can miss output if stream closes before reading
const exitCode = await proc.exited;
const stdout = await new Response(proc.stdout).text(); // May be empty!

// CORRECT: Consume in parallel
const [stdout, stderr, exitCode] = await Promise.all([
  new Response(proc.stdout).text(),
  new Response(proc.stderr).text(),
  proc.exited,
]);
```

**Workspace Detection** — Check for workspace configuration:
```typescript
export async function isWorkspaceProject(): Promise<boolean> {
  try {
    const pkg = await Bun.file("package.json").json();
    return Array.isArray(pkg.workspaces) && pkg.workspaces.length > 0;
  } catch {
    return false;
  }
}
```

## Dependencies

- `mcpez` — MCP framework for tool registration
- Bun runtime — Native test runner

## Environment Variables

- `CI=true` — Set during test runs to ensure non-interactive output
- `CLAUDE_PLUGIN_ROOT` — Injected by Claude Code, used in hooks.json

## Notes

- **30-second timeout** — Test runs abort after 30 seconds to prevent hanging
- **60-second timeout** — Coverage runs allow 60 seconds for instrumentation
- **Workspace-aware** — Automatically detects and respects workspace structure
- **Pattern validation** — Prevents directory traversal attacks
- **Bun.spawn() preferred** — Faster than Node.js child_process, native to Bun runtime
