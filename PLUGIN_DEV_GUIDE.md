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
    name: "my_tool",  // Short name only - Claude Code adds prefix automatically
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

**CRITICAL:** Claude Code automatically prefixes plugin MCP tools with `mcp__plugin_<plugin>_<server>__`. You must use **short names only** in your source code.

### What You Write (Source Code)

```typescript
tool("my_tool", { ... });           // Short name only
startServer("my-server", { ... });  // Server name for prefix
```

### What Claude Code Registers (Final Name)

```
mcp__plugin_my-plugin_my-server__my_tool
```

### Why This Matters

- **64-character limit**: Final tool names cannot exceed 64 characters (API constraint)
- **Double-prefixing bug**: If you write `mcp__my-plugin_my-server__my_tool` in source, Claude Code adds another prefix, exceeding the limit
- **Correct pattern**: Short names like `git_get_status`, `tsc_check`, `copy`

### Examples

| Plugin | Short Name (Source) | Final Name (Registered) |
|--------|---------------------|-------------------------|
| git | `git_get_recent_commits` | `mcp__plugin_git_git-intelligence__git_get_recent_commits` |
| kit | `kit_index_find` | `mcp__plugin_kit_kit__kit_index_find` |
| clipboard | `copy` | `mcp__plugin_clipboard_clipboard__copy` |

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
