---
argument-hint: [count=N] [level=LEVEL] [cwd=PATH] [cid=ID] [errors]
description: View biome-runner logs with filtering (lint errors, format issues, project-specific)
model: claude-3-5-haiku-20241022
---

# Biome-Runner Logs

View recent biome-runner log entries with powerful filtering.

## Usage

```
/biome-runner:logs [options]
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
/biome-runner:logs                    # Last 20 entries from current project
/biome-runner:logs count=50           # Last 50 entries
/biome-runner:logs errors             # Only ERROR level entries
/biome-runner:logs level=WARN         # Only WARN and ERROR entries
/biome-runner:logs cid=a1b2c3d4       # All entries for correlation ID
/biome-runner:logs count=100 errors   # Last 100 errors
/biome-runner:logs cwd=/path/to/repo  # Filter to specific project
```

---

Read the biome-runner log file at `~/.claude/logs/biome-runner.jsonl`.

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
  code: <rule-code>
  error: <message>
  suggestion: <fix-suggestion>
  cid: <correlation-id>
  durationMs: <duration>
```

For error entries, highlight the key diagnostic fields:
- file path and line number
- Biome rule code (e.g., format, lint/suspicious/noDoubleEquals)
- error message
- suggestion (if available)

## Log Structure Reference

- Logs are JSONL format (one JSON object per line)
- Each entry has: @timestamp, level, logger, message, properties
- Common fields: cid, hook, tool, durationMs, exitCode, errors, warnings
- Subsystem loggers: biome-runner, biome-runner.biome, biome-runner.mcp
- File paths in: properties.file, properties.files
- Diagnostic fields: code, severity, message, suggestion, line
