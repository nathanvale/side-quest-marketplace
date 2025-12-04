---
argument-hint: [count=N] [level=LEVEL] [cwd=PATH] [cid=ID] [errors]
description: View tsc-runner logs with filtering (errors, warnings, project-specific)
model: claude-3-5-haiku-20241022
---

# TSC-Runner Logs

View recent tsc-runner log entries with powerful filtering.

## Usage

```
/tsc-runner:logs [options]
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
/tsc-runner:logs                    # Last 20 entries from current project
/tsc-runner:logs count=50           # Last 50 entries
/tsc-runner:logs errors             # Only ERROR level entries
/tsc-runner:logs level=WARN         # Only WARN and ERROR entries
/tsc-runner:logs cid=a1b2c3d4       # All entries for correlation ID
/tsc-runner:logs count=100 errors   # Last 100 errors
/tsc-runner:logs cwd=/path/to/repo  # Filter to specific project
```

---

Read the tsc-runner log file at `~/.claude/logs/tsc-runner.jsonl`.

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
   - Use `properties.configDir`, `properties.file`, or `properties.files` fields
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
  error: <message>
  cid: <correlation-id>
  durationMs: <duration>
```

For error entries, highlight the key diagnostic fields:
- file path and line number
- error message
- suggestion (if available)

## Log Structure Reference

- Logs are JSONL format (one JSON object per line)
- Each entry has: @timestamp, level, logger, message, properties
- Common fields: cid, hook, tool, durationMs, exitCode, errorCount
- Subsystem loggers: tsc-runner, tsc-runner.tsc, tsc-runner.mcp
- File paths in: properties.file, properties.configDir, properties.files
