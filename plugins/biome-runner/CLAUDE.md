# Biome Runner

**Biome linter and formatter with auto-fix hooks and MCP server** - Automatically lint and format code using Biome with git-aware change detection.

---

## CRITICAL RULES

**Automatic Formatting:**
- **PostToolUse hooks** run after Write/Edit operations - Biome auto-formats changed files
- **Stop hook** runs full CI check on session end - validates entire codebase
- **NEVER** manually run Biome commands - hooks handle this automatically

**MCP Server:**
- Use `biome_lintCheck` for checking code without making changes
- Use `biome_lintFix` to auto-fix issues
- Use `biome_formatCheck` to verify formatting
- All tools return structured diagnostics with file, line, code, and suggestions

**Logging:**
- All operations logged to `~/.claude/logs/biome-runner.jsonl`
- Use `/biome-runner:logs` to view diagnostics and troubleshoot issues
- Correlation IDs track hook execution across multiple operations

---

## Project Structure

```
biome-runner/
├── .claude-plugin/
│   └── plugin.json              # Plugin metadata
├── commands/
│   └── logs.md                  # /biome-runner:logs slash command
├── hooks/
│   ├── hooks.json               # Hook configuration (SessionStart, PostToolUse, Stop)
│   ├── biome-check.ts           # PostToolUse hook - auto-format changed files
│   ├── biome-ci.ts              # Stop hook - full CI validation
│   └── shared/                  # Shared utilities
│       ├── biome-config.ts      # Biome configuration detection
│       ├── constants.ts         # Logging paths and constants
│       ├── git-utils.ts         # Git-aware file detection
│       ├── logger.ts            # Structured JSONL logging
│       ├── spawn-utils.ts       # Bun.spawn() wrapper
│       └── types.ts             # TypeScript types
├── mcp/
│   ├── index.ts              # MCP server implementation
│   ├── index.test.ts         # Tests for diagnostic parsing
│   ├── path-validator.ts     # Path validation utilities
│   └── package.json          # MCP dependencies
├── .mcp.json                    # MCP server registration
├── package.json                 # Dependencies and scripts
└── tsconfig.json                # TypeScript configuration
```

---

## Commands

```bash
# Package scripts (run from plugin directory)
bun test              # Run tests
bun typecheck         # Type check
bun run check         # Biome lint + format (with --write)

# MCP tools (available in Claude Code)
biome_lintCheck       # Check for lint errors without fixing
biome_lintFix         # Auto-fix lint errors
biome_formatCheck     # Verify formatting

# Slash commands
/biome-runner:logs    # View logs with filtering
```

---

## Key Files

| File | Purpose |
|------|---------|
| `hooks/biome-check.ts` | PostToolUse hook - formats files after Write/Edit |
| `hooks/biome-ci.ts` | Stop hook - runs full CI validation |
| `hooks/shared/logger.ts` | Structured logging to `~/.claude/logs/biome-runner.jsonl` |
| `mcp/index.ts` | MCP server with 3 tools |
| `.mcp.json` | MCP server registration config |

---

## How It Works

### Hook Workflow

1. **SessionStart** - Bootstraps plugin environment
2. **Write/Edit operation** - User or Claude modifies files
3. **PostToolUse hook fires** - `biome-check.ts` runs:
   - Detects changed files using git
   - Runs `biome check --write` on changed files only
   - Logs diagnostics with correlation ID
4. **Session ends** - Stop hook fires - `biome-ci.ts` validates entire codebase

### MCP Server Tools

All tools support `response_format: "markdown" | "json"` (default: markdown).

**biome_lintCheck:**
- Runs `biome lint` without fixing
- Returns structured diagnostics (file, line, code, message, severity)
- Use to preview issues before fixing

**biome_lintFix:**
- Runs `biome lint --write` to auto-fix
- Returns count of fixed issues and remaining errors
- Use when you want to fix issues programmatically

**biome_formatCheck:**
- Runs `biome format --check`
- Returns list of unformatted files
- Use to verify formatting without changes

### Logging System

Logs written to: `~/.claude/logs/biome-runner.jsonl`

**Log structure:**
```json
{
  "@timestamp": "2025-12-04T10:30:00.000Z",
  "level": "ERROR",
  "logger": "biome-runner.biome",
  "message": "Lint errors found",
  "properties": {
    "cid": "a1b2c3d4",
    "hook": "PostToolUse",
    "tool": "Write",
    "file": "/path/to/file.ts",
    "code": "lint/suspicious/noDoubleEquals",
    "line": 42,
    "severity": "error",
    "message": "Use === instead of ==",
    "suggestion": "Replace == with ===",
    "durationMs": 234
  }
}
```

**View logs:**
```bash
/biome-runner:logs              # Last 20 entries from current project
/biome-runner:logs errors       # Only errors
/biome-runner:logs cid=a1b2c3d4 # All entries for correlation ID
```

---

## Code Conventions

### TypeScript

- Strict mode enabled (`tsconfig.json`)
- Bun runtime types
- `noEmit: true` (Bun handles transpilation)

### Testing

- Framework: Bun test (native)
- Pattern: `*.test.ts` alongside source
- Run: `bun test` from plugin directory

### Git Integration

Hooks detect changed files using:
- `git status --porcelain` - staged and unstaged changes
- `git diff --name-only` - working directory changes
- Only runs Biome on modified files (performance optimization)

---

## MCP Server Details

### Tool Naming

```
mcp__biome-runner_biome-runner__biome_lintCheck
mcp__biome-runner_biome-runner__biome_lintFix
mcp__biome-runner_biome-runner__biome_formatCheck
```

### Response Formats

**Markdown (default):**
```markdown
## Lint Results

**Errors:** 2
**Warnings:** 1

### Errors

**src/index.ts:42** - lint/suspicious/noDoubleEquals
Use === instead of ==

**Suggestion:** Replace == with ===
```

**JSON:**
```json
{
  "error_count": 2,
  "warning_count": 1,
  "diagnostics": [
    {
      "file": "src/index.ts",
      "line": 42,
      "code": "lint/suspicious/noDoubleEquals",
      "severity": "error",
      "message": "Use === instead of ==",
      "suggestion": "Replace == with ==="
    }
  ]
}
```

---

## Troubleshooting

### Hook not running

```bash
# Check hooks.json syntax
cat hooks/hooks.json

# View logs for hook execution
/biome-runner:logs count=50
```

### Biome errors not showing

```bash
# Check if Biome is installed
biome --version

# View detailed logs
/biome-runner:logs level=DEBUG

# Run manually for debugging
bun run check
```

### Path resolution issues

- All paths in `.mcp.json` use `${CLAUDE_PLUGIN_ROOT}`
- Hooks use absolute paths resolved from plugin root
- Biome runs in git repository root (auto-detected)

---

## Recent Changes

Recent commits to biome-runner:

- `fix(biome-runner): report warnings when exit code is 0` - Handle warning-only runs correctly
- Hook integration with marketplace core bootstrap

---

## Resources

- **Biome docs:** https://biomejs.dev
- **MCP SDK:** https://github.com/modelcontextprotocol/sdk
- **Plugin guide:** @../../PLUGIN_DEV_GUIDE.md
- **Logging utilities:** @./hooks/shared/logger.ts
