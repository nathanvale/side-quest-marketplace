---
description: View biome-runner MCP server and hook logs
model: haiku
allowed-tools: Read
argument-hint: "[count=N] [level=LEVEL] [errors] [cid=ID]"
---

Read the log file at `~/.claude/logs/biome-runner.jsonl` and display recent entries. $ARGUMENTS

**Arguments:**
- `count=N` -- Show last N entries (default: 20)
- `level=LEVEL` -- Filter by log level (DEBUG, INFO, WARN, ERROR)
- `errors` -- Shorthand for `level=ERROR`
- `cid=ID` -- Filter by correlation ID

**Format:** Each line is a JSON object with fields: `timestamp`, `level`, `message`, `cid`, and additional context fields.

Display results in a compact table format showing timestamp, level, and message.
