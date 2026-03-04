---
created: 2026-03-04
title: LogTape Observability for MCP Servers
type: research
tags: [logtape, mcp, observability, structured-logging, sentry, opentelemetry, bun, typescript, json-rpc]
project: side-quest-marketplace
status: draft
---

# LogTape Observability for MCP Servers

Supplementary research to the [CLI observability spec](./2026-02-25-logtape-cli-observability.md). That doc covers LogTape fundamentals and short-lived CLI patterns. This doc covers what changes for long-running MCP servers -- the stdout constraint, per-request context, protocol-level logging, and the community landscape.

## Summary

MCP servers are long-running processes that communicate via JSON-RPC over stdio. This fundamentally changes the logging architecture: stdout is the protocol wire (not a logging channel), processes live for hours (not seconds), and each tool invocation needs isolated context. LogTape is arguably the best-fitting logging library for this use case -- its library-first silent-by-default design prevents accidental stdout pollution, and `withContext()` + `AsyncLocalStorage` gives per-tool-call context propagation for free. Nobody has written the definitive "LogTape for MCP servers" guide yet -- this is that document.

## Key Findings

- **stdout is sacred** -- any non-JSON-RPC data on stdout corrupts the protocol and crashes the connection. `console.log()` and even `getConsoleSink()` at debug/info levels write to stdout. Use `getStreamSink()` targeting stderr, or `getConsoleSink()` locked to warning+ only.
- **Two logging channels exist** -- stderr for diagnostic logs (always available), and MCP protocol logging via `notifications/message` (client-visible, level-controlled). A custom LogTape sink can bridge both.
- **Sentry's CTO (zeeg) confirmed** he migrated to LogTape on his MCP service -- the only publicly confirmed LogTape-in-MCP production use. No `@logtape/mcp` package or community guide exists yet.
- **Non-blocking sinks flip from dangerous (CLI) to essential (server)** -- long-lived processes benefit from buffered writes. The opposite of the CLI guidance.
- **`fingersCrossed` + `isolateByContext`** is the killer feature -- per-tool-call debug buffering with automatic memory cleanup. Silent on success, full trace on failure.
- **MCP's protocol-level OTel story is stalled** (GitHub Discussion #269) -- application-level solutions like LogTape + Sentry have room to matter right now.

## Details

### The Fundamental Constraint: stdout is the Protocol Wire

MCP stdio transport uses stdout exclusively for JSON-RPC 2.0 messages. Any non-JSON-RPC data written to stdout corrupts the protocol stream and crashes the connection. This is not a suggestion -- it is an architectural invariant.

What breaks your MCP server:

| Code | Problem |
|------|---------|
| `console.log()` | Writes to stdout in Node/Bun |
| `console.debug()` | Writes to stdout in Node/Bun |
| `console.info()` | Writes to stdout in Node/Bun |
| `getConsoleSink()` at debug/info level | Uses console.debug/info internally |
| ORM query logging (some default to stdout) | Silent protocol corruption |
| `print()` in Python without `file=sys.stderr` | Writes to stdout |

What's safe:

| Code | Why |
|------|-----|
| `console.warn()` | Writes to stderr |
| `console.error()` | Writes to stderr |
| `getStreamSink()` targeting process.stderr | Explicit stderr |
| `getConsoleSink()` with `lowestLevel: "warning"` | Only uses warn/error (stderr) |

This is the single most important difference from CLI tools. The CLI spec's "Rule #1: logs go to stderr" becomes "if you violate this rule, the entire server crashes."

### Two Logging Channels

MCP defines two separate logging paths. Both are useful; they serve different audiences.

**Channel 1: stderr (diagnostic/operational logs)**

Captured automatically by host applications. On macOS with Claude Desktop: `tail -n 20 -F ~/Library/Logs/Claude/mcp*.log`. Claude Code's `--mcp-debug` flag enables detailed MCP communication logging.

This is where LogTape should write by default. The developer running the MCP server sees these logs. The AI host may capture them but doesn't parse them structurally.

**Channel 2: MCP protocol logging via `notifications/message`**

Defined in the [MCP Logging specification](https://modelcontextprotocol.io/specification/2025-03-26/server/utilities/logging). Sends structured log messages to the client through the JSON-RPC protocol itself. The server must declare `logging: {}` in capabilities. The client can set minimum log level via `logging/setLevel`.

```json
{
  "jsonrpc": "2.0",
  "method": "notifications/message",
  "params": {
    "level": "error",
    "logger": "database",
    "data": {
      "error": "Connection failed",
      "details": { "host": "localhost", "port": 5432 }
    }
  }
}
```

Uses RFC 5424 syslog severity levels: debug, info, notice, warning, error, critical, alert, emergency.

**Why both matter:** stderr logs are for the developer debugging the server. Protocol logs are for the AI host (Claude Code, Cursor) to understand what happened during a tool call. A well-instrumented MCP server writes to both.

### The MCP TypeScript SDK Logging API

The official `@modelcontextprotocol/sdk` exposes protocol logging through the underlying `Server` instance:

```typescript
// Note: server.server -- you type "server" twice
server.server.sendLoggingMessage({
  level: "info",
  data: "Tool execution completed",
});
```

You must declare the logging capability at init time or calls throw at runtime:

```typescript
const server = new Server(
  { name: "my-server", version: "1.0.0" },
  {
    capabilities: {
      logging: {},  // Required -- omitting causes runtime errors
      tools: {},
    },
  }
);
```

This was a common gotcha -- see [typescript-sdk issue #311](https://github.com/modelcontextprotocol/typescript-sdk/issues/311).

### LogTape Configuration for MCP Servers

The safe configuration pattern for stdio transport:

```typescript
import { AsyncLocalStorage } from "node:async_hooks";
import stream from "node:stream";
import {
  configure,
  getStreamSink,
  jsonLinesFormatter,
} from "@logtape/logtape";

await configure({
  contextLocalStorage: new AsyncLocalStorage(),
  sinks: {
    // Safe: explicitly targets stderr
    stderr: getStreamSink(
      stream.Writable.toWeb(process.stderr),
      {
        formatter: jsonLinesFormatter,
        nonBlocking: true,  // Safe for long-lived servers
      }
    ),
  },
  loggers: [
    {
      category: ["mcp"],
      sinks: ["stderr"],
      lowestLevel: "info",
    },
  ],
});
```

**Key differences from the CLI configuration:**

| Concern | CLI | MCP Server |
|---------|-----|------------|
| Default sink | `getConsoleSink()` | `getStreamSink()` to stderr |
| Non-blocking | Never (short-lived, logs lost on crash) | Yes (long-lived, throughput matters) |
| Default formatter | ANSI color (interactive) | JSON Lines (machine-parseable) |
| Level control | CLI flags (--debug, --verbose) | Hardcoded or env var |
| Shutdown | Process exits immediately | Explicit `dispose()` on SIGTERM |

**Bun note:** On Bun, `process.stderr` isn't a `WritableStream`. Use `stream.Writable.toWeb(process.stderr)` for the stream sink, or use `getConsoleSink()` locked to `lowestLevel: "warning"` as a simpler alternative.

### Per-Request Context Propagation

The core challenge: MCP servers handle many tool invocations across a session. You need to correlate logs from a single tool call without manually threading a logger through every function.

**Recommended context properties for MCP servers:**

| Property | Source | Purpose |
|----------|--------|---------|
| `requestId` | Generated per tool call | Correlate all logs from one invocation |
| `sessionId` | MCP session lifecycle | Group tool calls within one session |
| `toolName` | From JSON-RPC params | Know which tool is executing |
| `duration` | Computed at completion | Performance tracking |

**The `withContext()` pattern for tool handlers:**

```typescript
import { getLogger, withContext } from "@logtape/logtape";

const logger = getLogger(["mcp", "tools"]);

server.tool("my-tool", schema, async (params) => {
  const requestId = crypto.randomUUID();

  return withContext({ requestId, toolName: "my-tool" }, async () => {
    logger.info("Tool invocation started", { params });
    const start = performance.now();

    try {
      const result = await doWork(params);
      logger.info("Tool completed", {
        duration: performance.now() - start,
      });
      return result;
    } catch (error) {
      logger.error("Tool failed", {
        error: error.message,
        duration: performance.now() - start,
      });
      throw error;
    }
  });
});
```

Every log inside `doWork()` -- no matter how deep in the call stack -- automatically carries `requestId` and `toolName` via `AsyncLocalStorage`. No logger parameter threading required.

### Category Hierarchy for MCP Servers

Design categories around functional boundaries:

```
mcp                           # Root -- catch-all
├── mcp.lifecycle             # Server start, shutdown, session events
├── mcp.tools                 # Tool invocation orchestration
│   ├── mcp.tools.my-tool     # Specific tool execution
│   └── mcp.tools.other-tool
├── mcp.resources             # Resource reads, subscriptions
├── mcp.prompts               # Prompt template resolution
├── mcp.transport             # JSON-RPC wire-level events
└── mcp.cache                 # Cache hits, misses, stale fallbacks
```

This lets you dial `["mcp", "tools", "my-tool"]` to debug while keeping everything else at warning.

### Bridging LogTape to MCP Protocol Logging

A custom LogTape sink that forwards to the MCP client via `notifications/message`:

```typescript
import type { LogRecord, Sink } from "@logtape/logtape";
import type { Server } from "@modelcontextprotocol/sdk/server/index.js";

function getMcpProtocolSink(server: Server): Sink {
  const levelMap: Record<string, string> = {
    debug: "debug",
    info: "info",
    warning: "warning",
    error: "error",
    fatal: "critical",
  };

  return (record: LogRecord) => {
    server.sendLoggingMessage({
      level: levelMap[record.level] ?? "info",
      logger: record.category.join("."),
      data: {
        message: record.message
          .map((part) =>
            typeof part === "string" ? part : String(part)
          )
          .join(""),
        ...record.properties,
      },
    });
  };
}
```

Configure both sinks together:

```typescript
await configure({
  contextLocalStorage: new AsyncLocalStorage(),
  sinks: {
    stderr: getStreamSink(
      stream.Writable.toWeb(process.stderr),
      { formatter: jsonLinesFormatter, nonBlocking: true }
    ),
    mcpProtocol: getMcpProtocolSink(server.server),
  },
  loggers: [
    {
      category: ["mcp"],
      sinks: ["stderr", "mcpProtocol"],
      lowestLevel: "info",
    },
  ],
});
```

Now every log goes to stderr (developer) AND the MCP client (AI host) simultaneously.

### Fingers Crossed for MCP Servers

The `fingersCrossed` sink is even more valuable for MCP servers than CLIs. In a CLI, it buffers per-process. In an MCP server, it can buffer per-tool-call using `isolateByContext`:

```typescript
import { configure, fingersCrossed, getStreamSink } from "@logtape/logtape";

await configure({
  contextLocalStorage: new AsyncLocalStorage(),
  sinks: {
    stderr: fingersCrossed(
      getStreamSink(stream.Writable.toWeb(process.stderr), {
        formatter: jsonLinesFormatter,
      }),
      {
        triggerLevel: "error",
        maxBufferSize: 200,
        // Isolate buffers by requestId -- each tool call gets its own buffer
        isolateByContext: { keys: ["requestId"] },
      }
    ),
  },
  loggers: [
    { category: ["mcp"], sinks: ["stderr"], lowestLevel: "debug" },
  ],
});
```

**How it works in practice:**
1. Tool call A starts -- debug/info logs buffered silently for requestId A
2. Tool call B starts -- separate buffer for requestId B
3. Tool call A completes successfully -- buffer A discarded, zero noise
4. Tool call B hits an error -- buffer B flushes the full debug trace to stderr
5. Subsequent logs for B pass through immediately

This is the ideal MCP server pattern: zero debug noise on success, full diagnostic trace on failure, isolated per tool call. No `--debug` flag needed.

### Graceful Shutdown and Log Flushing

Unlike CLIs that exit immediately, MCP servers need to flush logs on shutdown. LogTape doesn't register signal handlers -- you must wire them explicitly:

```typescript
import { dispose } from "@logtape/logtape";

async function shutdown() {
  logger.info("Server shutting down");
  await dispose();  // Flushes all sink buffers
  process.exit(0);
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
```

**Why this matters:** With non-blocking sinks, unflushed logs in the buffer are lost if the process exits without `dispose()`. For fingersCrossed sinks, buffered debug context for in-flight requests is also lost.

### Error Handling: Two Error Paths

MCP has a critical distinction between protocol errors and tool errors. Getting this wrong confuses both the host and the LLM.

**JSON-RPC errors (protocol level)** -- the request itself was invalid:

| Code | Meaning |
|------|---------|
| `-32700` | Parse error (invalid JSON) |
| `-32600` | Invalid request (missing fields) |
| `-32601` | Method not found |
| `-32602` | Invalid params |
| `-32603` | Internal error |

**Tool result with `isError: true` (application level)** -- the request was valid, the tool ran, but the operation failed:

```typescript
return {
  isError: true,
  content: [{
    type: "text",
    text: "Database connection failed: timeout after 5000ms. Check that the database is running.",
  }],
};
```

**The rule:** Log full diagnostic context internally (stderr/LogTape). Return user-safe context to the client. Never expose credentials, internal paths, or stack traces in `isError` responses.

```typescript
try {
  const result = await externalApi.call(params);
  return { content: [{ type: "text", text: JSON.stringify(result) }] };
} catch (error) {
  // Full context to stderr
  logger.error("External API call failed", {
    error: error.message,
    stack: error.stack,
    endpoint: externalApi.endpoint,
    statusCode: error.response?.status,
  });

  // Safe message to client/LLM
  return {
    isError: true,
    content: [{
      type: "text",
      text: `API request failed (${error.response?.status ?? "unknown"}). ${getRecoverySuggestion(error)}`,
    }],
  };
}
```

**Error messages for AI consumers** need to answer three questions: what happened, why it happened, and what to do about it. The LLM reads these messages and decides what to try next.

### Sentry Integration

LogTape + Sentry is the most production-validated stack for MCP server observability. The `@logtape/sentry` sink gives trace-connected structured logging -- logs automatically inherit `trace_id` and `span_id` from active Sentry spans.

```typescript
import * as Sentry from "@sentry/bun";
import { getSentrySink } from "@logtape/sentry";

// CRITICAL: Sentry before LogTape (see CLI spec gotchas)
Sentry.init({ dsn: "...", enableLogs: true });

await configure({
  contextLocalStorage: new AsyncLocalStorage(),
  sinks: {
    stderr: getStreamSink(stream.Writable.toWeb(process.stderr), {
      formatter: jsonLinesFormatter,
      nonBlocking: true,
    }),
    sentry: getSentrySink(),
  },
  loggers: [
    {
      category: ["mcp"],
      sinks: ["stderr", "sentry"],
      lowestLevel: "info",
    },
  ],
});
```

Sentry also offers one-line MCP server instrumentation since August 2025 via `wrapMcpServerWithSentry(McpServer)` -- tracks tool call frequency, execution duration, error rates, and transport types.

### OpenTelemetry

`@logtape/otel` (now maintained in the main LogTape monorepo, standalone repo archived) exports log records as OTel log signals. For MCP servers, this enables:

- Spans for each tool invocation
- Trace propagation across the host-server boundary (aspirational -- not yet standardized)
- Integration with backends like Axiom, Honeycomb, Datadog

The MCP community is actively debating protocol-level OTel support ([GitHub Discussion #269](https://github.com/modelcontextprotocol/modelcontextprotocol/discussions/269)). The proposal for `notifications/otel/trace` is stalled -- OTel experts argue servers should export directly to collectors, not through clients. No consensus yet.

In the meantime, application-level OTel via LogTape is the pragmatic solution.

### Debugging Tools

| Tool | Purpose | How |
|------|---------|-----|
| MCP Inspector | Interactive tool testing, raw JSON-RPC inspection | `npx @modelcontextprotocol/inspector` |
| Claude Code `--mcp-debug` | Detailed MCP communication logging | Launch flag |
| Claude Code `/mcp` | Runtime inspection of configured servers | Slash command |
| Claude Desktop logs | Connection events, errors, message exchanges | `tail -F ~/Library/Logs/Claude/mcp*.log` |
| MCP-Analyzer | Meta-MCP server that makes logs queryable from within Claude | [GitHub](https://github.com/klara-research/MCP-Analyzer) |
| CLI pipe testing | Raw JSON-RPC testing without a host | `echo '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' \| node server.js \| jq` |

### Recommended Observability Stack

| Layer | Tool | Purpose |
|-------|------|---------|
| Structured logging | LogTape to stderr | Diagnostic logs with per-request context |
| Protocol logging | `notifications/message` via custom sink | Client-visible log events |
| Per-request isolation | `fingersCrossed` + `isolateByContext` | Silent on success, full trace on failure |
| Development debugging | MCP Inspector | Interactive tool testing |
| Error tracking | Sentry + `@logtape/sentry` | Trace-connected error reporting |
| Production monitoring | Sentry MCP / Datadog | Tool performance, error rates |

### Community Landscape (March 2026)

**The gap is real and named.** No `@logtape/mcp` package exists. No community guide connects the two. The only confirmed production use is zeeg (Sentry CTO) who publicly stated he "coerced the Sentry team into supporting LogTape" and migrated to it on his MCP service.

**Key community signals:**

- **@zeeg** (2026-02-11): "I did coerce the Sentry team into supporting logtape as I liked it and migrated to it on the MCP service." -- Direct production confirmation.
- **@TechSquidTV** (2026-02-12): "Using LogTape for structured logs and @sentry for traces... for you AND your AI." -- AI-era debugging framing.
- **@izhongyuting** (2026-02-26): "most MCP chains don't emit structured progress by default -- they complete silently." -- The pain articulated.
- **r/mcp** (2026-02-26): "3 out of 12 tools on our MCP server were never called. We only found out by accident." -- The audit trail gap.
- **@rauchg** (2026-02-11, 483 likes): Vercel shipped `get_runtime_logs` in their MCP server. Infrastructure logging via MCP is a mainstream concern.
- **LogTape on Sentry's official YouTube** (2026-02-22, @hongminhee, 63 likes) -- Enterprise validation.

**The OTel debate:** MCP's protocol-level observability story is unsettled (Discussion #269). OTel experts want servers to export directly to collectors. Practitioners like zeeg solve it application-side with LogTape + Sentry. These approaches aren't mutually exclusive, but right now, application-level wins on pragmatism.

**LogTape's integration ecosystem** (2026): Official packages for Express, Fastify, Hono, Elysia, Koa, Drizzle ORM, OpenTelemetry, Sentry, CloudWatch. No MCP-specific integration. The gap is an opportunity.

## Sources

- [MCP Logging Specification](https://modelcontextprotocol.io/specification/2025-03-26/server/utilities/logging) -- protocol-level logging
- [MCP Debugging Guide](https://modelcontextprotocol.io/legacy/tools/debugging) -- debugging tools and patterns
- [MCP Inspector](https://modelcontextprotocol.io/docs/tools/inspector) -- official visual debugging tool
- [MCP TypeScript SDK issue #311](https://github.com/modelcontextprotocol/typescript-sdk/issues/311) -- logging capability gotcha
- [OpenTelemetry Trace Support for MCP -- Discussion #269](https://github.com/modelcontextprotocol/modelcontextprotocol/discussions/269) -- protocol-level OTel debate
- [Trace-Connected Structured Logging with LogTape and Sentry](https://blog.sentry.io/trace-connected-structured-logging-with-logtape-and-sentry/) -- Sentry integration guide
- [Sentry MCP Monitoring](https://blog.sentry.io/introducing-mcp-server-monitoring/) -- one-line MCP instrumentation
- [Datadog LLM Observability](https://www.datadoghq.com/blog/mcp-client-monitoring/) -- MCP tracing
- [MCP-Analyzer](https://github.com/klara-research/MCP-Analyzer) -- meta-MCP server for log querying
- [LogTape Integrations](https://logtape.org/manual/integrations) -- ecosystem packages
- [LogTape GitHub](https://github.com/dahlia/logtape) -- source and discussions
- [MCP Server Best Practices 2026](https://www.cdata.com/blog/mcp-server-best-practices-2026) -- general patterns
- [Monitoring, Logging & Observability in MCP Servers](https://www.dataknobs.com/agent-ai/mcp/10-monitoring-logging-observability-mcp-servers.html) -- structured logging recommendations
- [zeeg on LogTape + MCP](https://x.com/zeeg/status/2021690203300331559) -- production confirmation
- [TechSquidTV on LogTape + Sentry](https://x.com/TechSquidTV/status/2021999136539804061) -- AI-era debugging
- [Vercel get_runtime_logs MCP](https://x.com/rauchg/status/2021409454047232430) -- infrastructure logging

## Open Questions

- Should we build a `@logtape/mcp` sink package that bridges to `notifications/message` with proper level mapping?
- How should `fingersCrossed` buffer size be tuned for MCP servers that handle hundreds of tool calls per session?
- When the MCP OTel proposal lands, how does it interact with application-level LogTape + OTel?
- Can the `getConsoleSink()` stdout trap be caught at init time with a runtime check, rather than relying on developer knowledge?
- What's the right pattern for correlating logs across the host-server boundary (the host's requestId vs the server's requestId)?
