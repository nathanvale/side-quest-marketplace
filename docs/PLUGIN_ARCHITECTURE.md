# Plugin Architecture

Reference guide for Claude Code plugin structure and MCP server conventions.

---

## Standard Plugin Structure

```
my-plugin/
├── .claude-plugin/
│   ├── plugin.json          # Metadata (REQUIRED)
│   └── marketplace.json     # Marketplace info (optional)
├── commands/                # Slash commands (optional)
│   └── my-command.md
├── hooks/                   # Event hooks (optional)
│   ├── hooks.json
│   └── my-hook.ts
├── mcp-servers/             # MCP servers (optional)
│   └── my-server/
│       ├── index.ts
│       └── package.json
├── skills/                  # Agent skills (optional)
│   └── my-skill/
│       └── SKILL.md
├── src/                     # TypeScript source (optional)
│   ├── index.ts
│   └── index.test.ts
├── .mcp.json                # MCP server config (if MCP servers exist)
├── package.json             # Plugin dependencies
├── tsconfig.json            # TypeScript config (extends root)
└── CLAUDE.md                # Plugin documentation (recommended)
```

---

## MCP Server Conventions

### Tool Naming Pattern

```
mcp__plugin_<plugin-name>_<server-name>__<tool_name>
```

**Example:** `mcp__plugin_git_git-intelligence__git_get_recent_commits`

### Required Parameters

All MCP tools must include:
```typescript
response_format?: "markdown" | "json"  // Default: "markdown"
```

### Error Handling

```typescript
return {
  content: [{
    type: "text",
    text: JSON.stringify({ error: "...", isError: true })
  }],
  isError: true
};
```

### MCP Server Registration

`.mcp.json` in plugin root:
```json
{
  "mcpServers": {
    "my-server": {
      "command": "bun",
      "args": ["run", "${CLAUDE_PLUGIN_ROOT}/mcp-servers/my-server/index.ts"],
      "env": {}
    }
  }
}
```

**IMPORTANT:** Always use `${CLAUDE_PLUGIN_ROOT}` for plugin-relative paths. Claude Code sets this environment variable to the absolute path of your plugin directory.

---

## Plugin Creation

### Quick Start

```bash
/plugin-template:create my-plugin
# Generates scaffold with plugin.json, tsconfig, package.json, etc.
```

### Validation

```bash
# Validate all plugins
bun run validate

# Validate single plugin
claude plugin validate plugins/my-plugin
```

**What gets validated:**
- plugin.json schema compliance
- Referenced files exist (commands, skills, hooks)
- MCP server structure valid (.mcp.json)
- TypeScript compiles
- Hooks.json structure
- Marketplace metadata

---

## Plugin Components

### Slash Commands (commands/*.md)
- Markdown files that expand to prompts
- Format: Command documentation + separator + prompt expansion
- Referenced in plugin.json `commands` array

### Skills (skills/*/SKILL.md)
- AI context enhancement files
- Provide specialized knowledge or workflows
- Referenced in plugin.json `skills` array

### Hooks (hooks/hooks.json)
- Event-driven scripts
- Events: SessionStart, PreToolUse, PostToolUse, Stop
- Exit codes: 0 (continue), 2 (blocking error)

### MCP Servers (mcp-servers/*)
- Implement Model Context Protocol tools
- Each server is a separate Node.js/TypeScript process
- Communicate via stdio with JSON-RPC

---

## Best Practices

1. **Tool Design:**
   - Single responsibility per tool
   - Consistent schemas for similar operations
   - Always return structured errors with `isError: true`
   - Support both markdown and JSON output

2. **Naming:**
   - Follow `mcp__plugin_<name>_<server>__<tool>` pattern
   - Use kebab-case for files and directories
   - Use PascalCase for TypeScript types/interfaces

3. **Testing:**
   - Place `*.test.ts` files alongside source
   - Test both success and error paths
   - Mock external dependencies

4. **Documentation:**
   - Create CLAUDE.md for each plugin
   - Document tool parameters and examples
   - Include troubleshooting tips

---

## Reference Plugins

Study these for implementation patterns:

| Plugin | Demonstrates |
|--------|-------------|
| `git` | MCP server with multiple tools, hooks, slash commands |
| `atuin` | MCP server, hooks integration, shell history |
| `kit` | Complex MCP server with AST search (25+ tools) |
| `bun-runner` | Test/lint integration hooks |
| `plugin-template` | Scaffolding and code generation |

For complete guide, see: `@../PLUGIN_DEV_GUIDE.md`
