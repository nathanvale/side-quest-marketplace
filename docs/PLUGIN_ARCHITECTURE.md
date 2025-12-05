# Plugin Architecture

## Create a Plugin

```bash
/plugin-template:create my-plugin
```

Generates: `plugin.json`, `package.json`, `tsconfig.json`, source scaffold

---

## MCP Server Requirements

### Tool Naming (REQUIRED)

```
mcp__plugin_<plugin>_<server>__<tool>
```

Example: `mcp__plugin_git_git-intelligence__git_get_recent_commits`

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
