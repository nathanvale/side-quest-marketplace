---
name: log-agent-issue
description: Fire-and-forget structured issue logger for subagents
user-invocable: false
allowed-tools:
  - Bash
---

# Log Agent Issue

Structured issue logger for subagents. Appends JSONL entries to `~/.claude/logs/agent-issues.jsonl`.

## When to Log

Log issues when you encounter:
- **error** — Tool failures, timeouts, unexpected exceptions
- **warning** — Skipped steps, degraded results, fallback paths taken
- **info** — Notable events worth tracking (optional, use sparingly)

## How to Log

Pipe a JSON payload to the script via Bash with `run_in_background: true`:

```bash
echo '{"agentId":"<your-agent-id>","issues":[{"type":"error","message":"<what happened>","toolName":"<tool>","context":{"key":"value"},"suggestion":"<how to fix>"}]}' | bun ${CLAUDE_PLUGIN_ROOT}/src/log-issue.ts "${CLAUDE_SESSION_ID}" 2>/dev/null
```

### Payload Shape

```json
{
  "agentId": "triage-worker",
  "issues": [
    {
      "type": "error | warning | info",
      "message": "Human-readable description",
      "toolName": "optional — MCP tool that failed",
      "filePath": "optional — file involved",
      "context": "optional — object with extra details",
      "suggestion": "optional — remediation hint"
    }
  ]
}
```

### Rules

- **Always use `run_in_background: true`** — never block on logging
- **Always include `2>/dev/null`** — silent failure, never interrupt workflow
- **Keep messages concise** — one sentence, actionable
- **Batch related issues** — use the `issues` array, don't make multiple calls
- The script adds `timestamp` and `sessionId` automatically
