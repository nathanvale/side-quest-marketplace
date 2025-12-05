---
name: mcp-development
description: Build production-grade MCP servers with @sidequest/core/mcp, Bun, and marketplace patterns
---

# MCP Development Skill

Build production-grade MCP (Model Context Protocol) servers using `@sidequest/core/mcp` and Bun.

---

## Table of Contents

1. [Quick Start](#quick-start)
2. [Core Patterns](#core-patterns)
3. [Tool Registration](#tool-registration)
4. [Handler Pattern](#handler-pattern)
5. [Gold Standard Patterns](#gold-standard-patterns)
6. [Observability](#observability)
7. [Error Handling](#error-handling)
8. [Advanced Features](#advanced-features)
9. [Testing](#testing)
10. [Troubleshooting](#troubleshooting)
11. [Reference Links](#reference-links)

---

## Quick Start

Get a working MCP server running in 10 minutes using `@sidequest/core/mcp`.

### 1. Generate Scaffold

```bash
/plugin-template:create my-plugin
cd plugins/my-plugin
```

### 2. Create MCP Server

Create `mcp/index.ts`:

```typescript
#!/usr/bin/env bun

/**
 * My Plugin MCP Server
 *
 * ## Observability
 *
 * File logging enabled via MCP module's built-in observability layer.
 * Logs written to: ~/.claude/logs/my-plugin.jsonl
 */

import {
  createCorrelationId,
  log,
  startServer,
  tool,
  z,
} from "@sidequest/core/mcp";

// ============================================================================
// Hello Tool
// ============================================================================

tool(
  "hello",
  {
    description: "A simple greeting tool",
    inputSchema: z.object({
      name: z.string().describe("Name to greet"),
      response_format: z
        .enum(["markdown", "json"])
        .optional()
        .describe("Output format: 'markdown' (default) or 'json'"),
    }),
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  async (args: Record<string, unknown>) => {
    const { name, response_format } = args as {
      name: string;
      response_format?: string;
    };

    const cid = createCorrelationId();
    const startTime = Date.now();
    log.info({ cid, tool: "hello", args: { name } }, "greeting");

    const greeting = `Hello, ${name}!`;

    const durationMs = Date.now() - startTime;
    log.info({ cid, tool: "hello", success: true, durationMs }, "greeting");

    const text =
      response_format === "json"
        ? JSON.stringify({ greeting })
        : `# Hello\n\n${greeting}`;

    return { content: [{ type: "text" as const, text }] };
  },
);

// ============================================================================
// Start Server
// ============================================================================

startServer("my-plugin", {
  version: "1.0.0",
  fileLogging: {
    enabled: true,
    subsystems: ["greeting"],
    level: "debug",
  },
});
```

### 3. Register in .mcp.json

In plugin root, create `.mcp.json`:

```json
{
  "mcpServers": {
    "my-plugin": {
      "command": "bun",
      "args": ["run", "${CLAUDE_PLUGIN_ROOT}/mcp/index.ts"]
    }
  }
}
```

### 4. Test

```bash
bun run mcp/index.ts  # Should start without errors
```

**Congratulations!** You have a working MCP server with observability.

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

### Basic Tool

Use the `tool()` function from `@sidequest/core/mcp`:

```typescript
import { createCorrelationId, log, tool, z } from "@sidequest/core/mcp";

tool(
  "my_tool",
  {
    description: "What this tool does",
    inputSchema: z.object({
      query: z.string().describe("What to search for"),
      response_format: z
        .enum(["markdown", "json"])
        .optional()
        .describe("Output format: 'markdown' (default) or 'json'"),
    }),
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  async (args: Record<string, unknown>) => {
    const { query, response_format } = args as {
      query: string;
      response_format?: string;
    };
    const cid = createCorrelationId();
    log.info({ cid, tool: "my_tool", args: { query } }, "search");

    // Handler implementation
    const result = await doSearch(query);

    const text = response_format === "json"
      ? JSON.stringify(result)
      : formatAsMarkdown(result);

    return { content: [{ type: "text" as const, text }] };
  },
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

Every handler follows a 6-step pattern using `@sidequest/core/mcp`:

```typescript
async (args: Record<string, unknown>) => {
  const { query, response_format } = args as {
    query: string;
    response_format?: string;
  };

  // Step 1: Generate correlation ID for request tracing
  const cid = createCorrelationId();
  const startTime = Date.now();

  // Step 2: Log the request with subsystem
  log.info({ cid, tool: "my_tool", args: { query } }, "search");

  try {
    // Step 3: Execute business logic
    const result = await doSomething(query);

    // Step 4: Format output based on response_format
    const text = response_format === "json"
      ? JSON.stringify(result)
      : formatAsMarkdown(result);

    // Step 5: Log the response with subsystem
    const durationMs = Date.now() - startTime;
    log.info({ cid, tool: "my_tool", success: true, durationMs }, "search");

    // Step 6: Return MCP response
    return {
      content: [{ type: "text" as const, text }]
    };
  } catch (error) {
    // Step 5 (error): Log the error with subsystem
    const errorMessage = error instanceof Error ? error.message : String(error);
    log.error({ cid, tool: "my_tool", error: errorMessage }, "search");

    // Step 6 (error): Return error response
    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify({
          error: errorMessage,
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

- **Type assertion**: Extract and type args explicitly for type safety
- **Correlation ID**: Unique per request, links all log entries
- **Subsystem parameter**: Second argument to `log.*()` routes logs to named subsystem
- **Try/catch**: Always catch errors and return structured response
- **response_format**: Always respect user's format preference
- **Dual logging**: Logs go to both MCP protocol AND file automatically

---

## Gold Standard Patterns

The Kit plugin demonstrates production-ready MCP patterns validated across 18 tools and 9 plugins. These patterns ensure observability, maintainability, and consistency.

### Pattern 1: Declarative Tool Registration

**What:** Register tools using a declarative syntax with Zod schemas and MCP annotations

**Why:**
- Type-safe input validation at runtime
- Self-documenting through schema descriptions
- MCP annotations inform LLMs about tool behavior
- Zero boilerplate compared to raw SDK

**Example:**
```typescript
tool(
  "kit_index_find",
  {
    description: `Find symbol definitions from PROJECT_INDEX.json (token-efficient).

Searches the pre-built index instead of scanning files. Great for:
- Finding where a function/class/type is defined
- Quick symbol lookup without reading source files
- Understanding code structure with minimal tokens

Falls back to fuzzy matching if no exact match found.

NOTE: Requires PROJECT_INDEX.json. Run kit_index_prime first if not present.`,
    inputSchema: {
      symbol_name: z
        .string()
        .describe('Symbol name to search for. Example: "executeKitGrep"'),
      index_path: z
        .string()
        .optional()
        .describe("Path to PROJECT_INDEX.json or directory containing it (default: walks up to find it)"),
      response_format: z
        .enum(["markdown", "json"])
        .optional()
        .describe("Output format: 'markdown' (default) or 'json'"),
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  async (args) => { /* handler */ }
);
```

**Pitfalls:**
- Forgetting `.describe()` on schema fields → LLMs don't understand parameters
- Missing `response_format` parameter → Users can't choose output format
- Wrong annotation hints → LLMs may use tool incorrectly

**Best Practice:**
- Always include detailed multi-line descriptions for complex tools
- Document prerequisites, examples, and failure modes in description
- Use annotations to guide LLM behavior (read-only tools are safe to retry)

---

### Pattern 2: Correlation ID Tracing

**What:** Generate unique correlation IDs per request and attach to all related log entries

**Why:**
- Trace a request across all operations (validation → execution → formatting)
- Debug production issues by filtering logs by correlation ID
- Link errors back to their originating request
- Essential for troubleshooting in production with 18+ tools

**Example:**
```typescript
tool("kit_grep", {
  description: "Fast text search across repository files",
  inputSchema: { /* ... */ },
  annotations: { /* ... */ }
}, async (args) => {
  const { pattern, response_format } = args as {
    pattern: string;
    response_format?: string;
  };

  const mcpCid = createCorrelationId();
  const mcpStartTime = Date.now();
  log.info({ cid: mcpCid, tool: "kit_grep", args: { pattern } }, "grep");

  try {
    const result = await executeGrep(pattern);

    const mcpDuration = Date.now() - mcpStartTime;
    log.info({
      cid: mcpCid,
      tool: "kit_grep",
      success: true,
      durationMs: mcpDuration
    }, "grep");

    return { content: [{ type: "text", text: formatResult(result) }] };
  } catch (error) {
    log.error({
      cid: mcpCid,
      tool: "kit_grep",
      error: error.message,
      durationMs: Date.now() - mcpStartTime
    }, "grep");
    throw error;
  }
});
```

**Pitfalls:**
- Generating correlation ID inside try block → Lost if error occurs early
- Using random strings instead of `createCorrelationId()` → Not RFC-compliant
- Forgetting to log correlation ID → Can't trace requests
- Not including duration in final log → Can't measure performance

**Best Practice:**
- Generate correlation ID FIRST, before any operations
- Attach correlation ID to EVERY log entry (start, success, error)
- Include duration in final log entry for performance monitoring
- Use same variable name (`cid` or `mcpCid`) across all tools for consistency

---

### Pattern 3: Structured Error Responses

**What:** Return consistent error objects with `isError` flag, human-readable message, and recovery hints

**Why:**
- Machines can detect errors without parsing strings
- Users get actionable recovery suggestions
- Consistent error format across all 18 tools
- Enables automated error handling in calling code

**Example:**
```typescript
// Error response pattern from Kit plugin
const result = await executeIndexFind(symbol_name, index_path);

return {
  ...("isError" in result ? { isError: true } : {}),
  content: [
    { type: "text" as const, text: formatIndexFindResults(result, format) }
  ]
};

// Error object structure
{
  error: "PROJECT_INDEX.json not found",
  hint: "Run kit_index_prime first to generate the index",
  isError: true
}
```

**Pitfalls:**
- Returning plain strings for errors → Machines can't detect them
- Throwing exceptions instead of returning errors → Breaks MCP protocol
- Generic error messages without context → Users don't know how to fix
- Missing `isError: true` flag → Consumers can't detect failures

**Best Practice:**
- Always return errors as structured objects, never throw
- Include specific error message describing WHAT failed
- Provide actionable hint describing HOW to fix
- Add `isError: true` flag at top level AND in JSON object
- Format errors differently for markdown vs JSON:

```typescript
const text = format === "json"
  ? JSON.stringify({ error: "...", hint: "...", isError: true })
  : `**Error:** ...\n\n*Hint:* ...`;
```

---

### Pattern 4: Response Format Switching

**What:** Support both markdown (human-readable) and JSON (machine-parseable) output via `response_format` parameter

**Why:**
- Markdown for interactive exploration by users
- JSON for automated processing, hooks, and scripts
- 40-60% token savings with JSON format
- Consistent interface across all tools

**Example:**
```typescript
tool("kit_index_stats", {
  inputSchema: {
    // ... other params ...
    response_format: z
      .enum(["markdown", "json"])
      .optional()
      .describe("Output format: 'markdown' (default) or 'json'")
  }
}, async (args) => {
  const { response_format } = args as { response_format?: string };

  const result = await executeIndexStats(index_path, top_n);

  // Map to internal format enum
  const format = response_format === "json"
    ? ResponseFormat.JSON
    : ResponseFormat.MARKDOWN;

  return {
    content: [{
      type: "text" as const,
      text: formatIndexStatsResults(result, format)
    }]
  };
});
```

**Pitfalls:**
- Hard-coding format instead of checking parameter → Not flexible
- Using string comparison everywhere → Error-prone, not type-safe
- Different format names across tools → Inconsistent UX
- Forgetting to support JSON format → Breaks automated workflows

**Best Practice:**
- Always include `response_format` parameter with enum type
- Default to markdown (better for humans exploring)
- Use enum type for format internally to avoid string typos:
```typescript
enum ResponseFormat {
  MARKDOWN = "markdown",
  JSON = "json"
}
```
- Delegate formatting to dedicated functions (single responsibility)
- Document format differences in tool description

---

### Pattern 5: File Logging Configuration

**What:** Configure subsystem-based hierarchical logging with rotation and level controls

**Why:**
- Isolate logs by component (grep, semantic, symbols, ast, etc.)
- Filter logs during debugging (`jq 'select(.logger | contains("grep"))'`)
- Prevent disk exhaustion with rotation (max size, max files)
- Adjust verbosity per environment (debug in dev, info in prod)

**Example:**
```typescript
startServer("kit", {
  version: "1.0.0",
  fileLogging: {
    enabled: true,
    subsystems: [
      "grep",      // Text search operations
      "semantic",  // Semantic search with ML
      "symbols",   // Index-based symbol lookup
      "fileTree",  // File tree navigation
      "fileContent", // File content reading
      "usages",    // Symbol usage tracking
      "ast",       // AST pattern search
      "commit",    // Git commit generation
      "summarize"  // PR summarization
    ],
    level: "debug",      // Log everything during development
    maxSize: 10_000_000, // 10MB per file (default: 1MB)
    maxFiles: 5          // Keep 5 rotated files (default: 5)
  }
});
```

**Pitfalls:**
- No subsystems → All logs mixed together, hard to filter
- Generic subsystem names like "main" → Not useful for filtering
- Wrong log level → Too verbose (debug in prod) or silent (error in dev)
- No rotation configured → Logs fill disk over time
- Forgetting to enable file logging → No persistent logs for debugging

**Best Practice:**
- Create one subsystem per logical component (grep, semantic, ast, etc.)
- Use subsystem names that match tool names for easy correlation
- Use descriptive subsystem names matching domain concepts
- Set level to "debug" during development, "info" in production
- Configure rotation (maxSize, maxFiles) based on expected volume
- Enable file logging for all production tools (critical for debugging)

---

### Pattern 6: MCP Annotations

**What:** Add behavioral hints to tools via annotations field

**Why:**
- LLMs understand tool characteristics without executing them
- readOnlyHint → Safe to retry, no side effects
- destructiveHint → Requires confirmation, can't undo
- idempotentHint → Safe to run multiple times
- openWorldHint → Touches external systems (API calls, files)

**Example:**
```typescript
tool("kit_index_prime", {
  description: "Generate or refresh PROJECT_INDEX.json for the codebase",
  inputSchema: { /* ... */ },
  annotations: {
    readOnlyHint: false,    // Creates/modifies index file
    destructiveHint: false, // Doesn't delete data
    idempotentHint: true,   // Safe to run multiple times (same result)
    openWorldHint: false    // Only touches local filesystem
  }
}, handler);

tool("kit_grep", {
  description: "Fast text search across repository files",
  inputSchema: { /* ... */ },
  annotations: {
    readOnlyHint: true,     // Pure read operation
    destructiveHint: false, // Doesn't modify anything
    idempotentHint: true,   // Always returns same results for same query
    openWorldHint: false    // Local filesystem only
  }
}, handler);

tool("kit_commit", {
  description: "Generate AI-powered commit messages from staged changes",
  inputSchema: { /* ... */ },
  annotations: {
    readOnlyHint: false,    // Can modify git state (if dry_run=false)
    destructiveHint: false, // Not destructive (can be dry run)
    idempotentHint: false,  // Each commit is unique
    openWorldHint: false    // Local git only
  }
}, handler);
```

**Pitfalls:**
- All annotations set to false → LLMs can't optimize behavior
- readOnlyHint=true but tool modifies state → Incorrect assumptions
- destructiveHint=false for dangerous operations → Users lose data
- Not setting idempotentHint for safe-to-retry operations → Unnecessary caution

**Best Practice:**
- Think through each annotation carefully for every tool
- Read-only tools should set `readOnlyHint: true` (enables LLM retries)
- Destructive tools MUST set `destructiveHint: true` (forces confirmation)
- Idempotent operations should set `idempotentHint: true` (safe retries)
- Tools calling external APIs should set `openWorldHint: true`
- Document annotation choices in comments if non-obvious

---

### Pattern 7: No Nested Package.json

**What:** Avoid creating package.json files inside MCP server directories

**Why:**
- Nested package.json breaks Claude Code's MCP server discovery
- Causes server startup failures (documented in multiple bug fixes)
- Creates dependency conflicts between root and nested packages
- Violates monorepo workspace protocol

**Anti-Pattern (WRONG):**
```
plugins/kit/
├── mcp/
│   └── package.json  ❌ WRONG - breaks MCP discovery
│   └── index.ts
├── package.json
```

**Correct Pattern:**
```
plugins/kit/
├── mcp/
│   └── index.ts      ✅ CORRECT - no package.json
├── package.json      ✅ All dependencies here
```

**Pitfalls:**
- Creating `mcp/*/package.json` thinking it isolates dependencies
- Copying package.json from examples that aren't in monorepos
- Not testing server startup after creating package.json
- Ignoring MCP server startup errors

**Best Practice:**
- All dependencies go in plugin root `package.json`
- MCP servers import from workspace root
- Test server startup: `bun run mcp/index.ts`
- Check Claude Code logs if server doesn't appear
- Remove nested package.json immediately if created
- See git history commits:
  - `8e8069b` - "fix(mcp): remove nested package.json causing MCP server failures"
  - `b6bb797` - "fix(tsc-runner): remove nested package.json causing MCP server startup failure"

---

### Pattern 8: Dual Logging (MCP Protocol + File)

**What:** Log to both MCP protocol (for Claude Desktop inspector) AND JSONL files (for debugging)

**Why:**
- MCP protocol logs disappear when inspector disconnects
- File logs persist for post-mortem debugging
- Correlation IDs link MCP and file log entries
- File logs survive across Claude Code sessions

**Example:**
```typescript
// From Kit plugin - automatic dual logging
const mcpCid = createCorrelationId();
log.info({ cid: mcpCid, tool: "kit_grep", args: { pattern } }, "grep");

// This single log call:
// 1. Sends to MCP protocol (visible in Claude Desktop inspector)
// 2. Writes to ~/.claude/logs/kit.jsonl (persistent file)
// 3. Includes correlation ID in both destinations
// 4. Routes to "grep" subsystem logger
```

**Pitfalls:**
- Only logging to MCP protocol → Logs lost when inspector disconnects
- Only logging to file → No real-time visibility during development
- Different log formats between MCP and file → Hard to correlate
- Not including correlation ID in both → Can't link logs together

**Best Practice:**
- Use `log.info()`, `log.error()`, etc. from `@sidequest/core/mcp` (automatic dual logging)
- Always include correlation ID in log data
- Use consistent subsystem names across all log calls
- Enable file logging for all production tools
- View file logs: `tail -f ~/.claude/logs/<plugin>.jsonl | jq`
- Filter by correlation ID: `jq 'select(.cid == "abc123")'`
- Filter by subsystem: `jq 'select(.logger | contains("grep"))'`

---

### Pattern 9: Separation of Concerns (MCP Layer vs Business Logic)

**What:** Keep MCP server code separate from business logic implementation

**Why:**
- Business logic is testable without MCP server overhead
- Pure functions are easier to reason about and maintain
- MCP layer handles validation, logging, formatting only
- Enables reuse of business logic in other contexts (CLI, tests, etc.)

**Example:**
```typescript
// Business logic (pure function) - src/index.ts
export async function executeIndexFind(
  symbolName: string,
  indexPath?: string
): Promise<IndexFindResult | { error: string; hint: string; isError: true }> {
  // Pure function - no MCP dependencies
  // Testable with simple assertions
  // Can be called from CLI, tests, or MCP server
}

// MCP layer - mcp/index.ts
tool("kit_index_find", {
  description: "...",
  inputSchema: { /* ... */ },
  annotations: { /* ... */ }
}, async (args: Record<string, unknown>) => {
  // 1. Validate and extract arguments
  const { symbol_name, index_path, response_format } = args as {
    symbol_name: string;
    index_path?: string;
    response_format?: string;
  };

  // 2. Generate correlation ID and log request
  const mcpCid = createCorrelationId();
  log.info({ cid: mcpCid, tool: "kit_index_find", args: { symbol_name } }, "symbols");

  // 3. Call business logic (pure function)
  const result = await executeIndexFind(symbol_name, index_path);

  // 4. Format output based on response_format
  const format = response_format === "json" ? ResponseFormat.JSON : ResponseFormat.MARKDOWN;

  // 5. Log response with correlation ID
  log.info({ cid: mcpCid, tool: "kit_index_find", success: !("isError" in result) }, "symbols");

  // 6. Return formatted MCP response
  return {
    ...("isError" in result ? { isError: true } : {}),
    content: [{ type: "text" as const, text: formatIndexFindResults(result, format) }]
  };
});
```

**Pitfalls:**
- Mixing MCP server logic with business logic → Hard to test
- No clear boundary between layers → Tight coupling
- Business logic depends on MCP types → Can't reuse elsewhere
- Testing requires full MCP server → Slow tests

**Best Practice:**
- Business logic goes in `src/` directory (pure functions)
- MCP server goes in `mcp/` directory (thin wrapper)
- Business logic returns typed results, not MCP responses
- MCP layer handles: validation, correlation IDs, logging, formatting
- Test business logic independently without MCP server
- MCP layer integration tests use mocked business logic

---

## Observability

The `@sidequest/core/mcp` module provides built-in observability with dual-logging (MCP protocol + file).

### File Logging Configuration

Configure file logging in `startServer()`:

```typescript
startServer("my-plugin", {
  version: "1.0.0",
  fileLogging: {
    enabled: true,           // Enable file logging
    subsystems: ["search", "index", "api"],  // Named loggers
    level: "debug",          // Log level: "debug" | "info" | "warning" | "error"
    maxSize: 10_000_000,     // Max file size in bytes (default: 10MB)
    maxFiles: 5,             // Max rotated files (default: 5)
  },
});
```

### Log Location

Logs are written to: `~/.claude/logs/<plugin-name>.jsonl`

Each line is a JSON object with timestamp, level, subsystem, and data:

```json
{"timestamp":"2024-01-15T10:30:00.000Z","level":"info","logger":"my-plugin.search","cid":"abc123","tool":"search","args":{"query":"test"}}
```

### Subsystems

Subsystems are hierarchical loggers for filtering by component:

```typescript
// Register subsystems in startServer
startServer("kit", {
  fileLogging: {
    enabled: true,
    subsystems: ["grep", "semantic", "symbols", "ast"],
  },
});

// Use subsystem name as second argument to log.*()
log.info({ cid, tool: "kit_grep", pattern }, "grep");
log.info({ cid, tool: "kit_semantic", query }, "semantic");
log.debug({ cid, indexPath }, "symbols");
```

### Log Levels

```typescript
log.debug(data, "subsystem");   // Verbose debugging info
log.info(data, "subsystem");    // Normal operation events
log.warning(data, "subsystem"); // Warning conditions
log.error(data, "subsystem");   // Error conditions
```

### Viewing Logs

```bash
# View recent logs
tail -f ~/.claude/logs/my-plugin.jsonl | jq

# Filter by subsystem
cat ~/.claude/logs/kit.jsonl | jq 'select(.logger | contains("grep"))'

# Filter by correlation ID
cat ~/.claude/logs/kit.jsonl | jq 'select(.cid == "abc123")'
```

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
async (args: Record<string, unknown>) => {
  const { query } = args as { query: string };
  const cid = createCorrelationId();

  try {
    // Try primary implementation (requires ML)
    return await semanticSearch(query);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (errorMessage.includes("semantic search not available")) {
      // Fall back to grep-based search
      log.warning({ cid, fallback: "grep", reason: errorMessage }, "search");
      return await grepSearch(query);
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
- @./references/core-mcp-api.md — `@sidequest/core/mcp` API reference
- @./references/mcp-protocol.md — MCP protocol and marketplace conventions
- @./references/error-handling.md — Error taxonomy and recovery strategies

**CLI Tools:**
- `/plugin-template:create` — Generate plugin scaffold with MCP server
- `/review-mcp` — Validate server against 10-point checklist

**External:**
- [MCP SDK Docs](https://modelcontextprotocol.io)
- [Model Context Protocol Spec](https://spec.modelcontextprotocol.io)

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

MCP servers extend Claude Code's capabilities. Build with `@sidequest/core/mcp`:

1. **Import from `@sidequest/core/mcp`** — `tool`, `startServer`, `log`, `createCorrelationId`, `z`
2. **Register tools** with clear names, Zod schemas, and annotations
3. **Log with subsystems** — `log.info(data, "subsystemName")` for hierarchical filtering
4. **Use correlation IDs** — trace requests across all log entries
5. **Support both formats** — markdown (default) + JSON via `response_format`
6. **Handle errors** with structured responses and recovery hints
7. **Configure file logging** — JSONL files to `~/.claude/logs/<plugin>.jsonl`

Study Kit plugin for a production example: @../../kit/CLAUDE.md
