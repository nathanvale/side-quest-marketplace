# MCP Development Skill

Build production-grade MCP (Model Context Protocol) servers using mcpez and Bun.

---

## Table of Contents

1. [Quick Start](#quick-start)
2. [Core Patterns](#core-patterns)
3. [Tool Registration](#tool-registration)
4. [Handler Pattern](#handler-pattern)
5. [Error Handling](#error-handling)
6. [Advanced Features](#advanced-features)
7. [Testing](#testing)
8. [Troubleshooting](#troubleshooting)
9. [Reference Links](#reference-links)

---

## Quick Start

Get a working MCP server running in 10 minutes.

### 1. Generate Scaffold

```bash
/plugin-template:create my-plugin
cd plugins/my-plugin
```

### 2. Create MCP Server Directory

```bash
mkdir -p mcp/my-server
cd mcp/my-server
```

### 3. Create package.json

```json
{
  "name": "my-server",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "start": "node index.ts"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "latest",
    "zod": "latest"
  }
}
```

### 4. Create index.ts

```typescript
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const server = new Server({
  name: "my-server",
  version: "1.0.0"
}, {
  capabilities: { tools: {} }
});

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [{
    name: "mcp__plugin_my-plugin_my-server__hello",
    description: "A simple greeting tool",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string" },
        response_format: { type: "string", enum: ["markdown", "json"] }
      },
      required: ["name"]
    }
  }]
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (name === "mcp__plugin_my-plugin_my-server__hello") {
    const { name: userName, response_format = "markdown" } = args;
    const text = response_format === "json"
      ? JSON.stringify({ greeting: `Hello, ${userName}!` })
      : `# Hello\n\nGreeting: Hello, ${userName}!`;

    return { content: [{ type: "text", text }] };
  }

  return {
    content: [{ type: "text", text: JSON.stringify({ error: "Unknown tool", isError: true }) }],
    isError: true
  };
});

await server.connect(new StdioServerTransport());
```

### 5. Register in .mcp.json

In plugin root, create `.mcp.json`:

```json
{
  "mcpServers": {
    "my-server": {
      "command": "bun",
      "args": ["run", "${CLAUDE_PLUGIN_ROOT}/mcp/my-server/index.ts"]
    }
  }
}
```

### 6. Test

```bash
bun install
bun run index.ts  # Should start without errors
```

**Congratulations!** You have a working MCP server.

---

## Core Patterns

All MCP servers follow these 4 patterns:

### 1. Tool Registration

Register tools with the MCP server. Each tool has:
- **name**: Unique identifier following `mcp__plugin_<plugin>_<server>__<tool>` pattern
- **description**: What the tool does
- **inputSchema**: Zod schema or JSON schema for parameters
- **annotations**: readOnlyHint, destructiveHint, idempotentHint, openWorldHint

### 2. Handler Function

Process tool calls. Every handler:
1. **Generate correlation ID** - Unique ID for request tracing
2. **Log request** - Input with correlation ID
3. **Execute logic** - Call business logic function
4. **Format output** - Respect response_format parameter
5. **Log response** - Success/error with correlation ID
6. **Return MCP response** - Structured result with isError flag

### 3. Output Formats

Support both markdown (default) and JSON:

**Markdown:**
```markdown
# Tool Results

Content here
```

**JSON:**
```json
{
  "result": "data",
  "metadata": {}
}
```

### 4. Error Handling

All errors return structured response:

```typescript
{
  content: [{
    type: "text",
    text: JSON.stringify({
      error: "Human-readable error message",
      hint: "Recovery suggestion",
      isError: true
    })
  }],
  isError: true
}
```

---

## Tool Registration

### Basic Tool (mcpez)

```typescript
tool(
  "mcp__plugin_myapp_server__my_tool",
  {
    description: "What this tool does",
    inputSchema: z.object({
      query: z.string().describe("What to search for"),
      response_format: z.enum(["markdown", "json"]).optional()
    }),
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false
    }
  },
  async (args) => {
    // Handler implementation
  }
);
```

### Annotations Explained

- **readOnlyHint**: Does not modify system state (default: false)
- **destructiveHint**: Deletes or modifies data (default: false)
- **idempotentHint**: Safe to call multiple times with same inputs (default: false)
- **openWorldHint**: Affects systems outside the scope (default: false)

### Schema Best Practices

```typescript
z.object({
  // Required parameter with description
  query: z.string().describe("Search query"),

  // Optional parameter
  limit: z.number().optional().describe("Max results"),

  // Enum with default
  response_format: z.enum(["markdown", "json"]).default("markdown"),

  // Array
  tags: z.array(z.string()).optional(),

  // Nested object
  filters: z.object({
    minScore: z.number().optional(),
    maxPrice: z.number().optional()
  }).optional()
})
```

---

## Handler Pattern

Every handler follows a 6-step pattern:

```typescript
async (args, _extra: unknown) => {
  // Step 1: Generate correlation ID for request tracing
  const cid = createCorrelationId();

  // Step 2: Log the request
  mcpLogger.info("Tool invoked", {
    cid,
    tool: "my_tool",
    args,
    timestamp: new Date().toISOString()
  });

  try {
    // Step 3: Execute business logic
    const result = await doSomething(args.query);

    // Step 4: Format output based on response_format
    const text = args.response_format === "json"
      ? JSON.stringify(result)
      : formatAsMarkdown(result);

    // Step 5: Log the response
    mcpLogger.info("Tool completed", {
      cid,
      tool: "my_tool",
      success: true,
      durationMs: Date.now() - startTime
    });

    // Step 6: Return MCP response
    return {
      content: [{ type: "text", text }]
    };
  } catch (error) {
    // Step 5 (error): Log the error
    mcpLogger.error("Tool failed", {
      cid,
      tool: "my_tool",
      error: error.message
    });

    // Step 6 (error): Return error response
    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          error: error.message,
          hint: "Suggested recovery action",
          isError: true
        })
      }],
      isError: true
    };
  }
}
```

### Key Points

- **_extra parameter**: Added by mcpez for protocol compliance
- **Correlation ID**: Unique per request, links all log entries
- **Try/catch**: Always catch errors and return structured response
- **response_format**: Always respect user's format preference
- **Logging**: Every request and response should be logged

---

## Error Handling

### Error Categories

Define error types for consistent handling:

```typescript
enum ToolError {
  // Input validation
  InvalidInput = "INVALID_INPUT",
  MissingRequired = "MISSING_REQUIRED",

  // Not found
  NotFound = "NOT_FOUND",

  // Permission
  Unauthorized = "UNAUTHORIZED",

  // System
  InternalError = "INTERNAL_ERROR",
  Unavailable = "UNAVAILABLE",
  Timeout = "TIMEOUT"
}
```

### Error Response Pattern

```typescript
const handleError = (error: unknown, context: string) => {
  const errorMessage = error instanceof Error ? error.message : String(error);

  let errorType = ToolError.InternalError;
  let hint = "Contact support if this persists";

  if (errorMessage.includes("not found")) {
    errorType = ToolError.NotFound;
    hint = "Verify the resource exists";
  } else if (errorMessage.includes("timeout")) {
    errorType = ToolError.Timeout;
    hint = "Try again with fewer results or smaller inputs";
  }

  return {
    content: [{
      type: "text",
      text: JSON.stringify({
        error: errorMessage,
        errorType,
        hint,
        context,
        isError: true
      })
    }],
    isError: true
  };
};
```

### Type Guard Pattern

```typescript
type Success<T> = { ok: true; data: T };
type Failure = { ok: false; error: string; hint?: string };
type Result<T> = Success<T> | Failure;

const isSuccess = <T>(result: Result<T>): result is Success<T> => result.ok;

// Usage in handler
const result = await executeLogic(args);
if (!isSuccess(result)) {
  return {
    content: [{
      type: "text",
      text: JSON.stringify({
        error: result.error,
        hint: result.hint,
        isError: true
      })
    }],
    isError: true
  };
}

// Continue with result.data
```

---

## Advanced Features

### Graceful Degradation

When a feature isn't available, fall back gracefully:

```typescript
async (args) => {
  try {
    // Try primary implementation (requires ML)
    return await semanticSearch(args.query);
  } catch (error) {
    if (error.message.includes("semantic search not available")) {
      // Fall back to grep-based search
      mcpLogger.warn("Semantic search unavailable, using grep fallback", { cid });
      return await grepSearch(args.query);
    }
    throw error;
  }
}
```

### Timeout Hierarchy

Different timeouts per operation:

```typescript
const TIMEOUTS = {
  fast: 10_000,      // ~10 seconds (simple operations)
  normal: 30_000,    // ~30 seconds (typical operations)
  slow: 60_000       // ~60 seconds (building indexes)
};

const withTimeout = (promise: Promise<T>, ms: number) => {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Timeout")), ms)
    )
  ]);
};
```

### Response Format Factory

```typescript
const formatResponse = (result: unknown, format: "markdown" | "json") => {
  if (format === "json") {
    return JSON.stringify(result, null, 2);
  }

  // Markdown formatting
  if (typeof result === "string") return result;
  if (Array.isArray(result)) {
    return result.map(item => `- ${item}`).join("\n");
  }
  return JSON.stringify(result, null, 2);
};
```

---

## Testing

### Test Structure

```typescript
import { describe, expect, test } from "bun:test";

describe("my-server", () => {
  test("executes hello tool", async () => {
    const args = { name: "Nathan", response_format: "json" };
    const result = await callTool("mcp__plugin_my-plugin_my-server__hello", args);

    expect(result).toEqual({
      content: [{
        type: "text",
        text: JSON.stringify({ greeting: "Hello, Nathan!" })
      }]
    });
  });

  test("returns markdown by default", async () => {
    const args = { name: "Nathan" };
    const result = await callTool("mcp__plugin_my-plugin_my-server__hello", args);

    expect(result.content[0].text).toContain("Hello, Nathan!");
  });

  test("handles errors gracefully", async () => {
    const args = { query: "" }; // Empty query
    const result = await callTool("mcp__plugin_my-plugin_my-server__search", args);

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("isError");
  });
});
```

### Integration Test

```typescript
test("server starts without errors", async () => {
  const server = createTestServer();
  await expect(server.connect()).resolves.toBeUndefined();

  const tools = await server.listTools();
  expect(tools).toHaveLength(expectedCount);
});
```

---

## Troubleshooting

### Server won't start

```bash
# Check syntax errors
bun run index.ts

# Check dependencies
bun install
```

### Tool not appearing

1. Check tool name matches pattern: `mcp__plugin_<plugin>_<server>__<tool>`
2. Verify ListToolsRequestSchema is implemented
3. Check .mcp.json path is correct

### Handler crashes

1. Add try/catch to handler
2. Check correlation ID setup
3. Verify Zod schema matches actual parameters
4. Log args before processing

### Tests failing

```bash
bun test mcp/my-server/index.test.ts
```

Check:
- Mock data is valid
- Async/await is correct
- No unhandled promise rejections

---

## Reference Links

**Full Documentation:**
- @./references/kit-case-study.md — Deep dive into Kit's 18-tool production server
- @./references/mcpez-patterns.md — Complete mcpez API reference
- @./references/mcp-protocol.md — MCP protocol and marketplace conventions
- @./references/error-handling.md — Error taxonomy and recovery strategies

**CLI Tools:**
- `/scaffold-mcp` — Generate MCP server scaffold
- `/review-mcp` — Validate server against 10-point checklist

**External:**
- [MCP SDK Docs](https://modelcontextprotocol.io)
- [Model Context Protocol Spec](https://spec.modelcontextprotocol.io)
- [mcpez Library](https://github.com/elizaos/mcpez)

---

## Pro Tips

**1. Correlation IDs matter.** Use them to trace requests across logs. One ID per request, attached to all related log entries.

**2. Support both formats.** Even if JSON seems "standard," users appreciate markdown for exploration.

**3. Document failure modes.** In error hints, tell users how to recover (verify input, check permissions, try again).

**4. Test error paths.** Most bugs hide in error handlers. Test with invalid input, timeouts, network failures.

**5. Think about timeout.** A 60-second timeout that builds an index is better than a 10-second timeout that times out.

**6. Log strategically.** Log at start and end of long operations. Skip logging inside tight loops.

**7. Fail fast with validation.** Catch schema errors early, before expensive operations.

**FAQ**

**Q: Do I need to create multiple MCP servers per plugin?**
A: No. Typically one server per plugin is sufficient. Use multiple tools within the server for different operations.

**Q: Can I use ES6 modules?**
A: Yes. Set `"type": "module"` in package.json and use ESM imports.

**Q: What if a tool is destructive?**
A: Set `destructiveHint: true` and add clear warnings in description and error messages.

**Q: How do I handle tools that take a long time?**
A: Use longer timeouts (60s), log progress with correlation IDs, and provide intermediate results if possible.

---

## Summary

MCP servers are tools that extend Claude Code's capabilities. Follow these principles:

1. **Register tools** with clear names and schemas
2. **Log everything** with correlation IDs
3. **Support both formats** (markdown + JSON)
4. **Handle errors** with recovery hints
5. **Test thoroughly** including error paths
6. **Respect response_format** parameter

Study Kit plugin for a production example: @../../kit/CLAUDE.md
