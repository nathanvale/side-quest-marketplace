---
description: View Kit plugin logs for debugging
argument-hint: [lines?] [correlation-id?]
model: claude-haiku-4-5-20251001
---

# Kit Logs Command

View and filter JSONL logs from the Kit MCP server.

## Instructions

1. Log file location: `~/.claude/logs/kit.jsonl`
2. Default: Show last 20 log entries
3. With `lines` argument: Show last N entries
4. With `correlation-id`: Filter by specific operation

## Usage Examples

### View recent logs
```
/kit:logs
```
Shows the last 20 log entries formatted for readability.

### View more logs
```
/kit:logs 50
```
Shows the last 50 log entries.

### Filter by correlation ID
```
/kit:logs a1b2c3d4
```
Shows all log entries for a specific operation (useful for tracing failures).

## Log Format

Each log entry contains:
- `@timestamp` - When the event occurred
- `@category` - Log category (kit, kit.grep, kit.semantic, kit.symbols)
- `@level` - Log level (debug, info, warn, error)
- `@message` - Human-readable message
- `cid` - Correlation ID for tracing operations
- Additional context fields (query, pattern, matchCount, durationMs, etc.)

## Implementation

Read the log file and format entries:

```bash
# Default: last 20 lines
tail -20 ~/.claude/logs/kit.jsonl | jq '.'

# Filter by correlation ID
jq 'select(.cid == "CORRELATION_ID")' ~/.claude/logs/kit.jsonl

# Show only errors
jq 'select(.["@level"] == "error")' ~/.claude/logs/kit.jsonl
```

Present logs in a readable table or formatted list showing:
- Timestamp
- Level (with appropriate indicator)
- Category
- Message
- Key context (cid, matchCount, durationMs if present)

If the log file doesn't exist, inform the user that no logs have been generated yet.
