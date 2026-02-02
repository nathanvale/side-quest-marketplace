# Plugin Architecture

## Create a Plugin

```bash
/plugin-template:create my-plugin
```

Generates: `plugin.json`, `package.json`, `tsconfig.json`, source scaffold

---

## MCP Server Requirements

### Tool Naming (REQUIRED)

**CRITICAL:** Use **short names only** in source code. Claude Code automatically adds `mcp__plugin_<plugin>_<server>__` prefix.

**In source code:**
```typescript
tool("my_tool", { ... });  // Short name
```

**Claude Code registers as:**
```
mcp__plugin_<plugin>_<server>__my_tool
```

**Why:** Final tool names have a 64-character limit. Using full prefixes in source causes double-prefixing and API errors.

**Examples:**
- `kit_index_find` → `mcp__plugin_kit_kit__kit_index_find`
- `tsc_check` → `mcp__plugin_tsc-runner_tsc-runner__tsc_check`
- `copy` → `mcp__plugin_clipboard_clipboard__copy`

### Required Parameters

```typescript
response_format?: "markdown" | "json"  // ALWAYS include, prefer "json"
```

### Error Response Format

```typescript
return {
  content: [{ type: "text", text: JSON.stringify({ error: "...", isError: true }) }],
  isError: true
};
```

### .mcp.json Configuration

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

**IMPORTANT:** Always use `${CLAUDE_PLUGIN_ROOT}` — absolute paths break portability.

---

## Validation

```bash
bun run validate              # All plugins
claude plugin validate plugins/my-plugin  # Single plugin
```

**Validates:** plugin.json schema, file references, MCP structure, TypeScript, hooks

---

## Reference

- Full guide: @../PLUGIN_DEV_GUIDE.md
- Example plugins: `plugins/git`, `plugins/kit`, `plugins/bun-runner`
