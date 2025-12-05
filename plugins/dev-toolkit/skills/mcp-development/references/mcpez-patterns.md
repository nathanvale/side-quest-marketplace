# mcpez Patterns Reference

Complete API reference for mcpez, the MCP (Model Context Protocol) toolkit for TypeScript/JavaScript.

---

## Installation

```bash
npm install @modelcontextprotocol/sdk zod
# or
bun add @modelcontextprotocol/sdk zod
```

---

## Server Creation

### Basic Server

```typescript
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

const server = new Server(
  {
    name: "my-server",
    version: "1.0.0"
  },
  {
    capabilities: { tools: {} }
  }
);

// Define handlers here...

await server.connect(new StdioServerTransport());
```

### Server Configuration

```typescript
interface ServerConfig {
  name: string;           // Server identifier
  version: string;        // Semantic version
}

interface ServerCapabilities {
  tools?: {};             // Enable tools capability
  resources?: {};         // Enable resources capability
  prompts?: {};          // Enable prompts capability
  logging?: {};          // Enable logging capability
}
```

---

## Tool Registration

### Pattern 1: Using tool() Helper (Recommended)

```typescript
import { tool } from "@modelcontextprotocol/sdk/shared/index.js";
import { z } from "zod";

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    tool(
      "mcp__plugin_myapp_myserver__search",
      {
        description: "Search the codebase for patterns",
        inputSchema: z.object({
          query: z.string()
            .describe("Search query"),
          limit: z.number()
            .optional()
            .describe("Maximum results"),
          response_format: z.enum(["markdown", "json"])
            .optional()
            .default("markdown")
        }),
        annotations: {
          readOnlyHint: true,
          destructiveHint: false,
          idempotentHint: true,
          openWorldHint: false
        }
      },
      async (args, _extra: unknown) => {
        // Implementation
      }
    )
  ]
}));
```

### Pattern 2: Manual Tool Definition

```typescript
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [{
    name: "mcp__plugin_myapp_myserver__search",
    description: "Search the codebase",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Search query"
        },
        response_format: {
          type: "string",
          enum: ["markdown", "json"],
          description: "Output format"
        }
      },
      required: ["query"]
    }
  }]
}));
```

---

## Handlers

### Tool Handler

```typescript
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (name === "mcp__plugin_myapp_myserver__search") {
    try {
      const results = await search(args.query, args.limit);
      const text = args.response_format === "json"
        ? JSON.stringify(results)
        : formatAsMarkdown(results);

      return {
        content: [{ type: "text", text }]
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            error: error.message,
            isError: true
          })
        }],
        isError: true
      };
    }
  }

  return {
    content: [{
      type: "text",
      text: JSON.stringify({ error: "Unknown tool", isError: true })
    }],
    isError: true
  };
});
```

### List Tools Handler

```typescript
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "tool_name_1",
      description: "Description",
      inputSchema: { /* ... */ }
    },
    {
      name: "tool_name_2",
      description: "Description",
      inputSchema: { /* ... */ }
    }
  ]
}));
```

---

## Input Schemas

### Zod Schema (Recommended)

```typescript
import { z } from "zod";

const searchSchema = z.object({
  // String
  query: z.string()
    .min(1)
    .max(1000)
    .describe("Search query"),

  // Number with range
  limit: z.number()
    .int()
    .min(1)
    .max(100)
    .optional()
    .describe("Max results"),

  // Enum
  type: z.enum(["file", "function", "class"])
    .optional(),

  // Boolean
  caseSensitive: z.boolean()
    .optional()
    .default(false),

  // Array
  tags: z.array(z.string())
    .optional(),

  // Nested object
  filters: z.object({
    minSize: z.number().optional(),
    maxSize: z.number().optional(),
    extension: z.string().optional()
  }).optional(),

  // Refinement (custom validation)
  regex: z.string()
    .refine((pattern) => {
      try {
        new RegExp(pattern);
        return true;
      } catch {
        return false;
      }
    }, "Invalid regex pattern"),

  // Union
  source: z.union([
    z.literal("file"),
    z.literal("web"),
    z.literal("api")
  ])
});

// Convert to JSON Schema for MCP
const inputSchema = zodToJsonSchema(searchSchema);
```

### JSON Schema

```json
{
  "type": "object",
  "properties": {
    "query": {
      "type": "string",
      "description": "Search query",
      "minLength": 1,
      "maxLength": 1000
    },
    "limit": {
      "type": "number",
      "description": "Max results",
      "minimum": 1,
      "maximum": 100
    },
    "type": {
      "type": "string",
      "enum": ["file", "function", "class"],
      "description": "What to search for"
    },
    "response_format": {
      "type": "string",
      "enum": ["markdown", "json"],
      "description": "Output format"
    }
  },
  "required": ["query"]
}
```

---

## Annotations

### Annotation Types

```typescript
interface ToolAnnotations {
  // Does tool read-only access system (no modifications)?
  readOnlyHint?: boolean;        // default: false

  // Does tool delete or modify data?
  destructiveHint?: boolean;     // default: false

  // Safe to call multiple times with same inputs?
  idempotentHint?: boolean;      // default: false

  // Affects external systems?
  openWorldHint?: boolean;       // default: false
}
```

### Examples

```typescript
// Safe read-only tool
tool("search", {
  annotations: {
    readOnlyHint: true,          // ✓ No modifications
    destructiveHint: false,      // ✓ No deletions
    idempotentHint: true,        // ✓ Can call multiple times
    openWorldHint: false         // ✓ No external effects
  },
  // ...
});

// Destructive tool
tool("delete_file", {
  annotations: {
    readOnlyHint: false,         // ✗ Modifies system
    destructiveHint: true,       // ✓ Deletes data
    idempotentHint: true,        // ✓ Safe if file exists
    openWorldHint: true          // ✓ File system effects
  },
  // ...
});

// Unsafe tool
tool("update_api", {
  annotations: {
    readOnlyHint: false,         // ✗ Makes changes
    destructiveHint: false,      // ? Updates, not deletes
    idempotentHint: false,       // ✗ Side effects each call
    openWorldHint: true          // ✓ External API changes
  },
  // ...
});
```

---

## Response Format

### MCP Response Structure

```typescript
interface ToolResponse {
  content: Array<{
    type: "text" | "image" | "resource";
    text?: string;               // For text content
    mimeType?: string;           // For image/resource
    url?: string;                // For resource
  }>;
  isError?: boolean;             // Optional error flag
}
```

### Success Response

```typescript
return {
  content: [{
    type: "text",
    text: "Tool execution successful"
  }]
};
```

### JSON Response

```typescript
const result = {
  status: "success",
  data: { /* ... */ }
};

return {
  content: [{
    type: "text",
    text: JSON.stringify(result, null, 2)
  }]
};
```

### Error Response

```typescript
return {
  content: [{
    type: "text",
    text: JSON.stringify({
      error: "Human-readable error message",
      errorCode: "SPECIFIC_ERROR",
      hint: "How to recover from this error",
      isError: true
    })
  }],
  isError: true
};
```

### Multi-Content Response

```typescript
return {
  content: [
    {
      type: "text",
      text: "Markdown summary"
    },
    {
      type: "text",
      mimeType: "application/json",
      text: JSON.stringify(detailedData)
    }
  ]
};
```

---

## Transport

### Stdio Transport (Standard)

```typescript
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

const transport = new StdioServerTransport();
await server.connect(transport);
```

**When to use:** Most common, works with any host that spawns a subprocess.

### HTTP Transport

```typescript
import { HTTPServerTransport } from "@modelcontextprotocol/sdk/server/http.js";

const transport = new HTTPServerTransport({
  port: 3000
});

await server.connect(transport);
```

**When to use:** Web-based hosts, REST API integration.

### SSE Transport

```typescript
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";

const transport = new SSEServerTransport({
  port: 3000
});

await server.connect(transport);
```

**When to use:** Real-time updates, browser-based clients.

---

## Error Handling

### Try/Catch Pattern

```typescript
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    // Validate inputs
    const validated = inputSchema.parse(args);

    // Execute
    const result = await execute(validated);

    // Return success
    return {
      content: [{ type: "text", text: JSON.stringify(result) }]
    };
  } catch (error) {
    // Handle validation error
    if (error instanceof z.ZodError) {
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            error: "Validation failed",
            details: error.errors,
            isError: true
          })
        }],
        isError: true
      };
    }

    // Handle execution error
    const message = error instanceof Error ? error.message : String(error);
    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          error: message,
          isError: true
        })
      }],
      isError: true
    };
  }
});
```

### Custom Error Types

```typescript
class ToolError extends Error {
  constructor(
    message: string,
    public code: string,
    public hint?: string
  ) {
    super(message);
    this.name = "ToolError";
  }
}

// Usage
if (!validated) {
  throw new ToolError(
    "Invalid query",
    "INVALID_INPUT",
    "Query must be at least 1 character"
  );
}
```

---

## Testing

### Unit Test Example

```typescript
import { describe, test, expect } from "bun:test";

describe("search tool", () => {
  test("returns results for valid query", async () => {
    const args = { query: "test", limit: 10 };
    const response = await callTool("search", args);

    expect(response.content).toHaveLength(1);
    expect(response.isError).toBeFalsy();
  });

  test("returns error for empty query", async () => {
    const args = { query: "" };
    const response = await callTool("search", args);

    expect(response.isError).toBe(true);
    expect(response.content[0].text).toContain("error");
  });
});
```

### Mock Transport

```typescript
class MockTransport {
  async send(message: any): Promise<void> {
    // Mock implementation
  }

  async receive(): Promise<any> {
    // Mock implementation
  }
}

const mockServer = new Server(config, capabilities);
await mockServer.connect(new MockTransport());
```

---

## Common Patterns

### Pattern: Output Format Negotiation

```typescript
const inputSchema = z.object({
  query: z.string(),
  response_format: z.enum(["markdown", "json"])
    .optional()
    .default("markdown")
});

// In handler
const format = args.response_format || "markdown";
const text = format === "json"
  ? JSON.stringify(result)
  : formatMarkdown(result);
```

### Pattern: Timeout Handling

```typescript
const withTimeout = async (promise: Promise<T>, ms: number) => {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Timeout")), ms)
    )
  ]);
};

// Usage
try {
  const result = await withTimeout(execute(args), 30_000);
  return { content: [{ type: "text", text: JSON.stringify(result) }] };
} catch (error) {
  if (error.message === "Timeout") {
    throw new ToolError("Operation timed out", "TIMEOUT");
  }
  throw error;
}
```

### Pattern: Pagination

```typescript
const inputSchema = z.object({
  query: z.string(),
  limit: z.number().optional().default(20),
  offset: z.number().optional().default(0)
});

// In handler
const results = await search(args.query);
const paginated = results.slice(args.offset, args.offset + args.limit);
const hasMore = args.offset + args.limit < results.length;

return {
  content: [{
    type: "text",
    text: JSON.stringify({
      results: paginated,
      total: results.length,
      hasMore,
      offset: args.offset,
      limit: args.limit
    })
  }]
};
```

### Pattern: Streaming Results

```typescript
// Note: Streaming not directly supported in MCP
// Workaround: Return results in batches

const inputSchema = z.object({
  query: z.string(),
  batch_size: z.number().optional().default(10)
});

// Return first batch, user can paginate
const results = await search(args.query);
const batch = results.slice(0, args.batch_size);
return {
  content: [{
    type: "text",
    text: JSON.stringify({
      results: batch,
      total: results.length,
      more_available: batch.length < results.length
    })
  }]
};
```

---

## Best Practices

### 1. Always Validate Input

```typescript
// ✓ Good
const validated = inputSchema.parse(args);
const result = await execute(validated);

// ✗ Bad
const result = await execute(args);  // Assumes valid!
```

### 2. Support response_format

```typescript
// ✓ Good
const response_format = args.response_format || "markdown";
const text = response_format === "json"
  ? JSON.stringify(result)
  : formatMarkdown(result);

// ✗ Bad
const text = JSON.stringify(result);  // Only JSON!
```

### 3. Provide Recovery Hints

```typescript
// ✓ Good
throw new ToolError(
  "File not found",
  "NOT_FOUND",
  "Check the file path and try again"
);

// ✗ Bad
throw new Error("File not found");  // No context!
```

### 4. Use Descriptive Tool Names

```typescript
// ✓ Good
"mcp__plugin_search_fileserver__search_code"
"mcp__plugin_git_intelligence__get_recent_commits"

// ✗ Bad
"search"           // Too generic
"tool1"           // Not meaningful
```

### 5. Document Tool Behavior

```typescript
// ✓ Good
{
  name: "mcp__plugin_git_git-intelligence__get_recent_commits",
  description: "Retrieve recent git commits with author, timestamp, and message. Returns up to 20 commits by default, ordered newest first.",
  inputSchema: {
    type: "object",
    properties: {
      limit: { type: "number", description: "Max commits to return (1-100)" },
      since: { type: "string", description: "ISO 8601 date to filter commits after" }
    }
  }
}

// ✗ Bad
{
  name: "commits",
  description: "Get commits"
}
```

---

## Summary

mcpez provides:

- ✅ Server creation and configuration
- ✅ Tool registration with annotations
- ✅ Type-safe schemas with Zod
- ✅ Multiple transport options
- ✅ Error handling framework
- ✅ Response formatting

**Key takeaways:**

1. Always validate inputs with Zod
2. Always support response_format parameter
3. Always return structured errors with hints
4. Always follow naming convention
5. Always annotate tools for discovery

See Kit plugin for comprehensive examples: @./kit-case-study.md
