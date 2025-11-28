# Bun-Runner Plugin for Claude Code

Smart test runner and linter integration for Bun and Biome with automatic code quality enforcement via hooks and token-efficient MCP tools.

## Directory Structure

```
bun-runner/
├── mcp-servers/bun-runner/    # MCP server with 6 tools
│   ├── index.ts               # Test/lint tools (19KB)
│   ├── index.test.ts          # MCP tool tests
│   └── package.json           # MCP dependencies (mcpez)
├── hooks/                     # PostToolUse & Stop hooks
│   ├── biome-check.ts         # Auto-fix on Write/Edit (PostToolUse)
│   ├── biome-ci.ts            # Full lint check on Stop
│   ├── tsc-check.ts           # Single-file type check (PostToolUse)
│   ├── tsc-ci.ts              # Full type check on Stop
│   ├── hooks.json             # Hook configuration & matchers
│   └── shared/                # Shared utilities
│       ├── types.ts           # Hook input parsing
│       ├── constants.ts       # Supported file extensions
│       └── git-utils.ts       # Git-aware filtering
├── .claude-plugin/            # Plugin metadata
├── .mcp.json                  # MCP server config
└── package.json               # Dependencies
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

- `mcp-servers/bun-runner/index.ts` — MCP server with 6 tools for testing/linting
- `hooks/biome-check.ts` — PostToolUse hook: auto-fix on every file edit
- `hooks/tsc-check.ts` — PostToolUse hook: fast single-file type checking
- `hooks/*-ci.ts` — Stop hooks: full project validation before session end
- `hooks/shared/git-utils.ts` — Git-aware file filtering (3.3KB)

## MCP Tools (6 Total)

| Tool | Purpose | Output Format |
|------|---------|---------------|
| `bun_runTests` | Run tests with pattern filtering | Failures only (token-efficient) |
| `bun_testFile` | Run tests for specific file | Failures only |
| `bun_testCoverage` | Run tests with coverage report | Summary + low-coverage files |
| `bun_lintCheck` | Check for lint/format issues (read-only) | Structured errors |
| `bun_lintFix` | Auto-fix lint/format issues (--write) | Fixed count + remaining errors |
| `bun_formatCheck` | Check formatting without fixing | List of unformatted files |

## Architecture

**Dual enforcement strategy:**
1. **Immediate feedback (PostToolUse hooks)** — After Write/Edit, auto-fix with Biome and type-check with tsc
2. **Session validation (Stop hooks)** — Before session ends, run full project checks

**Hook Flow (PostToolUse):**
```
Claude writes file → biome-check.ts runs
  ↓ (git-aware filtering)
  ↓ (auto-fix with --write)
  ↓ (check for remaining errors)
  ↓ Exit 0 (success) or Exit 2 (block with errors)

In parallel → tsc-check.ts runs
  ↓ (single-file type check)
  ↓ Exit 0 or Exit 2
```

**Git-Aware Processing:**
- All hooks check `isFileInRepo()` before processing
- Skips files outside git repository (e.g., temp files, external paths)
- Uses `git ls-files` for efficient filtering

**Token-Efficient Output:**
- **Tests**: Show only failures, suppress passing tests and verbose logs
- **Lint**: Structured diagnostics with file:line, error code, message
- **Format**: Markdown or JSON output modes

## Code Standards

- **Bun-native APIs** — Uses `Bun.spawn()` instead of Node.js `child_process`
- **TypeScript strict mode** — Full type safety
- **AbortController for timeouts** — Avoids Bun's buggy timeout option
- **Parallel stream consumption** — Read stdout/stderr concurrently with `proc.exited`
- **Biome for linting** — Opinionated formatter/linter (tab indentation)

## Key Features

### Smart Hook Execution
```json
// hooks.json
"PostToolUse": [
  { "matcher": "Write|Edit|MultiEdit", "hooks": ["biome-check", "tsc-check"] }
],
"Stop": [
  { "matcher": "*", "hooks": ["biome-ci", "tsc-ci"] }
]
```

- **PostToolUse** hooks run after file edits (fast, single-file)
- **Stop** hooks run when session ends (comprehensive, full project)

### Supported File Extensions
```typescript
// Biome: JS, TS, JSON, CSS, GraphQL
BIOME_SUPPORTED_EXTENSIONS = [".js", ".ts", ".tsx", ".json", ".css", ".graphql", ...]

// TypeScript: TS only
TSC_SUPPORTED_EXTENSIONS = [".ts", ".tsx", ".mts", ".cts"]
```

### Exit Code Contract
- **0** — Success (no errors, or unsupported file type)
- **2** — Blocking error (shown to Claude, prevents further actions)

### Timeout Handling
```typescript
// AbortController pattern (Bun's timeout option is buggy)
const controller = new AbortController();
setTimeout(() => controller.abort(), 30000);
spawn({ signal: controller.signal });
```

## Testing

```bash
bun test --recursive              # All tests
bun test mcp-servers/             # MCP tool tests
bun test hooks/                   # Hook tests
```

**Test Coverage:**
- Hook input parsing (extractFilePaths, parseHookInput)
- Output parsers (Biome JSON, TSC errors, Bun test output)
- Git utilities (isFileInRepo, getChangedFiles)
- MCP tool integration

## Git Workflow

Commits: `type(scope): subject`

Examples:
- `feat(bun-runner): add coverage tool`
- `fix(hooks): handle missing git repo gracefully`
- `perf(tsc): use single-file mode for faster feedback`

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

**Hook Input Parsing** — Handles both single and multi-file edits:
```typescript
extractFilePaths(hookInput)
  → [file_path] for Write
  → [...edits.map(e => e.file_path)] for MultiEdit
```

**Two-Pass Linting** — Fix then check:
```typescript
// 1. Auto-fix what can be fixed
spawn(["biome", "check", "--write", filePath]);
// 2. Check for remaining issues
spawn(["biome", "check", "--reporter=json", filePath]);
```

**Graceful Degradation** — If parsing fails, exit 0 (don't block Claude)

## Dependencies

- `mcpez` — MCP framework for tool registration
- `@biomejs/biome` — Linter and formatter (peer dependency)
- `typescript` — Type checking (peer dependency)

## Environment Variables

- `CI=true` — Set by hooks to ensure non-interactive test output
- `CLAUDE_PLUGIN_ROOT` — Injected by Claude Code, used in hooks.json

## Notes

- **PostToolUse hooks run on every file edit** — Keep them fast (single-file checks)
- **Stop hooks can be slower** — Full project validation is acceptable
- **Exit code 2 is blocking** — Claude sees the error and must address it
- **Biome auto-fixes** — Most formatting/lint issues are fixed automatically
- **TypeScript errors cannot auto-fix** — Always require manual intervention
- **Git-aware by default** — Prevents processing external or temp files
- **Bun.spawn() preferred** — Faster than Node.js child_process, native to Bun runtime
