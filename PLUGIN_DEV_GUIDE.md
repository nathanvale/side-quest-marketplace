# Plugin Development Guide

## Quick Start

```bash
/plugin-template:create my-plugin
```

Generates complete scaffold with plugin.json, tsconfig, package.json, MCP templates.

---

## MCP Server Example

```typescript
// plugins/my-plugin/mcp/my-server/index.ts
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

const server = new Server(
  { name: "my-server", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [{
    name: "mcp__my-plugin_my-server__my_tool",
    description: "What this tool does",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string" },
        response_format: { type: "string", enum: ["markdown", "json"] }
      },
      required: ["query"]
    }
  }]
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const { query, response_format = "markdown" } = args;

  try {
    const result = await doSomething(query);
    const text = response_format === "json"
      ? JSON.stringify(result)
      : formatAsMarkdown(result);
    return { content: [{ type: "text", text }] };
  } catch (error) {
    return {
      content: [{ type: "text", text: JSON.stringify({ error: error.message, isError: true }) }],
      isError: true
    };
  }
});

await server.connect(new StdioServerTransport());
```

---

## MCP Server Registration

`.mcp.json` in plugin root:

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

**CRITICAL:** Always use `${CLAUDE_PLUGIN_ROOT}` — absolute paths break portability.

---

## Tool Naming Convention

```
mcp__<plugin>_<server>__<tool>
```

---

## Hook Events

| Event | When | Use For |
|-------|------|---------|
| `SessionStart` | Session begins | Load context |
| `PreToolUse` | Before tool | Validation, auto-checks |
| `PostToolUse` | After tool | Auto-test, logging |
| `Stop` | Session ends | Cleanup, summary |

**Exit codes:** `0` = continue, `2` = blocking error

`hooks/hooks.json`:
```json
{
  "hooks": [{ "event": "PostToolUse", "command": "bun run hooks/my-hook.ts" }]
}
```

---

## Validation

```bash
bun run validate                        # All plugins
claude plugin validate plugins/my-plugin  # Single
```
