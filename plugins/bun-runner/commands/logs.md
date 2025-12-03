# Bun-Runner Logs

View recent bun-runner log entries or filter by correlation ID.

## Usage

```
/bun-runner:logs [count|correlation-id]
```

## Arguments

- `count` - Number of recent entries to show (default: 20)
- `correlation-id` - 8-character ID to filter related entries

## Examples

```
/bun-runner:logs              # Last 20 entries
/bun-runner:logs 50           # Last 50 entries
/bun-runner:logs a1b2c3d4     # Filter by correlation ID
```

---

Read the bun-runner log file at `~/.claude/logs/bun-runner/bun-runner.jsonl`.

Parse the argument: $ARGUMENTS

If the argument is:
- Empty or not provided: show last 20 entries
- A number (1-100): show that many recent entries
- 8 characters (alphanumeric): filter entries where `cid` field matches

For each log entry, format as:
```
[timestamp] [level] [category] message
  cid: <correlation-id>
  key: value
  ...
```

Group related entries by correlation ID when showing filtered results.

Important context about the log structure:
- Logs are JSONL format (one JSON object per line)
- Each entry has: @timestamp, @level, @category (array), @message, plus custom fields
- Common fields: cid (correlation ID), hook, tool, durationMs, exitCode
- Subsystem categories: bun-runner, bun-runner.biome, bun-runner.tsc, bun-runner.mcp
