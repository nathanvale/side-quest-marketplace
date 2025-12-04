---
argument-hint: [count=N] [level=LEVEL] [cwd=PATH] [cid=ID] [errors]
description: View bun-runner logs with filtering (test failures, project-specific)
---

# Bun-Runner Logs

View recent bun-runner log entries with powerful filtering.

## Usage

```
/bun-runner:logs [options]
```

## Arguments

All arguments are optional with smart defaults:

- `count=N` - Number of recent entries (default: 20, max: 500)
- `level=LEVEL` - Filter by log level: ERROR, WARN, INFO, DEBUG (default: all levels)
- `cwd=auto` - Filter to current project only (default: auto-detect from $PWD)
- `cid=ID` - Filter by 8-character correlation ID
- `errors` - Shorthand for `level=ERROR` (only show errors)

## Examples

```
/bun-runner:logs                    # Last 20 entries from current project
/bun-runner:logs count=50           # Last 50 entries
/bun-runner:logs errors             # Only ERROR level entries
/bun-runner:logs level=WARN         # Only WARN and ERROR entries
/bun-runner:logs cid=a1b2c3d4       # All entries for correlation ID
/bun-runner:logs count=100 errors   # Last 100 errors
/bun-runner:logs cwd=/path/to/repo  # Filter to specific project
```

---

Read the bun-runner log file at `~/.claude/logs/bun-runner.jsonl`.

Parse arguments from: $ARGUMENTS

## Default Behavior (No Arguments)

- Show last 20 entries
- All log levels (ERROR, WARN, INFO, DEBUG)
- Filter to current working directory project (from $PWD)
- Formatted for readability

## Argument Parsing

Parse $ARGUMENTS and extract:

1. **count=N** → Number of entries to show (1-500)
2. **level=LEVEL** → Minimum log level (ERROR, WARN, INFO, DEBUG)
3. **errors** → Shorthand for level=ERROR
4. **cid=ID** → 8-character correlation ID
5. **cwd=PATH** → Project path filter (auto-detect from $PWD if not specified)

## Filtering Logic

1. **Project filtering** (cwd):
   - Extract project path from $PWD (current working directory)
   - Filter log entries where file paths contain this project directory
   - Use `properties.file` or `properties.files` fields
   - Skip filtering if cwd=all or no project detected

2. **Level filtering**:
   - ERROR: Show only ERROR entries
   - WARN: Show WARN and ERROR entries
   - INFO: Show INFO, WARN, and ERROR entries
   - DEBUG: Show all entries (default)

3. **Correlation ID filtering**:
   - When cid is provided, show all entries with matching cid
   - Ignore count limit for correlation ID queries
   - Group entries by timestamp

## Output Format

For each matching log entry:
```
[HH:MM:SS] LEVEL logger: message
  file: <path>
  testName: <test-name>
  error: <error-message>
  cid: <correlation-id>
  durationMs: <duration>
```

For test failure entries, highlight:
- Test file path
- Test name that failed
- Error message
- Expected vs actual values (if available)

## Log Structure Reference

- Logs are JSONL format (one JSON object per line)
- Each entry has: @timestamp, level, logger, message, properties
- Common fields: cid, hook, tool, durationMs, exitCode
- Subsystem loggers: bun-runner, bun-runner.test, bun-runner.mcp
- File paths in: properties.file, properties.files
- Test fields: testName, error, expected, actual
