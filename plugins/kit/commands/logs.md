---
description: View Kit plugin logs for debugging
argument-hint: [lines?] [correlation-id?]
model: claude-haiku-4-5-20251001
---

# Kit Logs Command

View and filter JSONL logs from the Kit MCP server.

## Your Task

View Kit MCP server logs with optional filtering: $ARGUMENTS

Log file location: `~/.claude/logs/kit.jsonl`

### Parse Arguments:
- No arguments → Show last 20 entries
- Number (e.g., `50`) → Show last N entries
- String (e.g., `a1b2c3d4`) → Filter by correlation ID

### Commands to use:

```bash
# Default: last 20 lines
tail -20 ~/.claude/logs/kit.jsonl | jq -r '.["@timestamp"] + " [" + .["@level"] + "] " + .["@category"] + ": " + .["@message"]'

# Last N lines
tail -N ~/.claude/logs/kit.jsonl | jq -r '.["@timestamp"] + " [" + .["@level"] + "] " + .["@category"] + ": " + .["@message"]'

# Filter by correlation ID
jq -r 'select(.cid == "CORRELATION_ID") | .["@timestamp"] + " [" + .["@level"] + "] " + .["@category"] + ": " + .["@message"]' ~/.claude/logs/kit.jsonl
```

Present logs showing timestamp, level, category, and message. If the file doesn't exist, inform the user no logs have been generated yet.
