---
created: 2026-03-04
title: LogTape MCP Server Observability
type: diagram
engine: markmap
tags: [logtape, mcp, observability, structured-logging, mindmap]
project: side-quest-marketplace
status: draft
source:
  - docs/research/2026-03-04-logtape-mcp-server-observability.md
---

## Mind Map

```markmap
---
markmap:
  color:
    - '#0072B2'
    - '#E69F00'
    - '#009E73'
    - '#D55E00'
    - '#56B4E9'
    - '#CC79A7'
    - '#F0E442'
  colorFreezeLevel: 2
  maxWidth: 320
  spacingVertical: 12
  spacingHorizontal: 80
  paddingX: 16
---

# LogTape MCP Server Observability

## The stdout Constraint
### stdout = JSON-RPC wire
- Any non-protocol data crashes connection
- console.log() breaks the server
- console.debug/info() also stdout
### Safe channels
- console.warn/error() -> stderr
- getStreamSink() -> stderr
- getConsoleSink() at warning+ only
### Key difference from CLI
- CLI: "logs should go to stderr"
- MCP: "logs MUST go to stderr or server dies"

## Two Logging Channels
### Channel 1: stderr
- Diagnostic/operational logs
- Captured by host apps
- Claude Desktop: mcp*.log
- Claude Code: --mcp-debug flag
### Channel 2: notifications/message
- MCP protocol logging
- Client-visible, level-controlled
- RFC 5424 syslog levels
- Requires logging: {} capability

## LogTape Configuration
### Sink setup
- getStreamSink() to process.stderr
- nonBlocking: true (long-lived)
- JSON Lines formatter (machine-parseable)
### What flips from CLI
- Non-blocking: dangerous -> essential
- Formatter: ANSI color -> JSON Lines
- Level control: CLI flags -> env vars
- Shutdown: immediate -> explicit dispose()
### Custom MCP sink
- Bridges to sendLoggingMessage()
- Maps LogTape levels to RFC 5424
- Dual-write: stderr + protocol

## Per-Request Context
### withContext() pattern
- requestId per tool call
- sessionId per MCP session
- toolName from JSON-RPC params
- AsyncLocalStorage propagation
### fingersCrossed + isolateByContext
- Per-tool-call debug buffering
- Silent on success (buffer discarded)
- Full trace on failure (buffer flushed)
- Zero --debug flag needed
### Category hierarchy
- mcp.lifecycle (start/shutdown)
- mcp.tools.* (per-tool logging)
- mcp.resources (reads/subscriptions)
- mcp.transport (wire-level events)

## Error Handling
### Two error paths
- JSON-RPC errors (protocol level)
- isError: true (application level)
### Internal vs external
- stderr: full stack traces, internal state
- Client: user-safe, recovery suggestions
- Never expose credentials or paths
### AI-readable errors
- What happened
- Why it happened
- What to do about it

## Observability Stack
### Development
- MCP Inspector (visual debugger)
- Claude Code /mcp command
- CLI pipe testing (raw JSON-RPC)
### Production
- Sentry + @logtape/sentry
- Sentry wrapMcpServerWithSentry()
- @logtape/otel (OpenTelemetry)
- Datadog LLM Observability
### Community status (Mar 2026)
- No @logtape/mcp package yet
- zeeg (Sentry CTO) uses LogTape on MCP
- OTel protocol proposal stalled (#269)
- The gap is an opportunity
```

**Export:** Markmap engine, A4 landscape.
