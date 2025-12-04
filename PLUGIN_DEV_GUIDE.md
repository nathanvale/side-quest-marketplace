# Plugin Development Guide

Comprehensive guide for creating Claude Code plugins for the SideQuest Marketplace.

---

## Plugin Anatomy

Every Claude Code plugin follows this structure:

```
my-plugin/
├── .claude-plugin/
│   └── plugin.json          # Plugin metadata (REQUIRED)
├── commands/                # Slash commands (optional)
│   └── my-command.md
├── hooks/                   # Event hooks (optional)
│   ├── hooks.json
│   └── my-hook.ts
├── mcp-servers/             # MCP server implementations (optional)
│   └── my-server/
│       ├── index.ts
│       └── package.json
├── skills/                  # Agent skills (optional)
│   └── my-skill/
│       └── SKILL.md
├── src/                     # TypeScript source (if needed)
│   ├── index.ts
│   └── index.test.ts
├── package.json             # Plugin dependencies
├── tsconfig.json            # TypeScript config (extends base)
├── CLAUDE.md                # Plugin documentation (recommended)
└── README.md                # User-facing docs
```

---

## plugin.json Schema

```json
{
  "name": "my-plugin",
  "version": "1.0.0",
  "description": "Short description of what the plugin does",
  "author": "Your Name",
  "repository": "https://github.com/username/repo",
  "commands": ["my-command"],
  "skills": ["my-skill"],
  "hooks": ["hooks/hooks.json"],
  "mcpServers": ["my-server"]
}
```

---

## MCP Server Development

### Tool Naming Convention

```
mcp__plugin_<plugin-name>_<server-name>__<tool_name>
```

Example: `mcp__plugin_git_git-intelligence__get_recent_commits`

### Response Format Parameter

All tools should support:
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

### Structured Output Principles

- Use consistent schemas across similar operations
- Include metadata (count, path, etc.)
- Support both markdown (human-readable) and JSON (machine-parseable)

### Example MCP Server

```typescript
// plugins/my-plugin/mcp-servers/my-server/index.ts
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

const server = new Server(
  { name: "my-server", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "mcp__plugin_my-plugin_my-server__my_tool",
      description: "What this tool does",
      inputSchema: {
        type: "object",
        properties: {
          query: { type: "string", description: "Query parameter" },
          response_format: {
            type: "string",
            enum: ["markdown", "json"],
            description: "Output format"
          }
        },
        required: ["query"]
      }
    }
  ]
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (name === "mcp__plugin_my-plugin_my-server__my_tool") {
    const { query, response_format = "markdown" } = args;

    const result = await doSomething(query);

    if (response_format === "json") {
      return {
        content: [{ type: "text", text: JSON.stringify(result) }]
      };
    }

    return {
      content: [{ type: "text", text: formatAsMarkdown(result) }]
    };
  }

  throw new Error(`Unknown tool: ${name}`);
});

const transport = new StdioServerTransport();
await server.connect(transport);
```

### Server Configuration

Register via `.mcp.json` in the plugin root:

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

**IMPORTANT:** Always use `${CLAUDE_PLUGIN_ROOT}` to reference plugin files. Claude Code sets this environment variable to the absolute path of your plugin directory. Without it, the server will fail to start because it can't find the file.

### Tool Design Principles

1. **Single Responsibility:** Each tool does ONE thing well
2. **Consistent Schemas:** Use the same structure for similar operations
3. **Error Handling:** Always return structured errors with `isError: true`
4. **Response Format:** Support both markdown and JSON output
5. **Documentation:** Clear descriptions and input schemas

### Testing MCP Servers

```typescript
import { describe, test, expect } from "bun:test";

describe("my-server", () => {
  test("tool returns expected output", async () => {
    const result = await callTool("my_tool", { query: "test" });
    expect(result).toMatchObject({ count: 1 });
  });

  test("tool handles errors gracefully", async () => {
    const result = await callTool("my_tool", { query: "" });
    expect(result.isError).toBe(true);
  });
});
```

---

## Slash Commands

Create markdown files in `commands/`:

```markdown
# My Command

Brief description of what this command does.

## Usage

\`\`\`bash
/my-command [arg1] [arg2]
\`\`\`

## Arguments

- `arg1` - Description of first argument
- `arg2` - Description of second argument (optional)

## Examples

\`\`\`bash
/my-command foo bar
\`\`\`

---

[Command expansion - this is what Claude sees when the command runs]

You are now executing the my-command slash command.

Instructions for Claude...
```

---

## Event Hooks

Create `hooks/hooks.json`:

```json
{
  "hooks": [
    {
      "event": "PostToolUse",
      "command": "bun run hooks/my-hook.ts"
    }
  ]
}
```

### Available Events

| Event | When it Fires |
|-------|---------------|
| `SessionStart` | Session begins |
| `PreToolUse` | Before tool execution |
| `PostToolUse` | After tool execution |
| `Stop` | Session ends |

### Exit Codes

| Code | Meaning |
|------|---------|
| `0` | Success (continue) |
| `2` | Blocking error (Claude must address) |

---

## Skills

Create `skills/my-skill/SKILL.md`:

```markdown
# My Skill

This skill helps with [specific task].

Use this skill when users ask about [trigger phrases].

## Context

[Additional context, patterns, or reference materials]

## Usage

[Instructions for Claude on how to use this skill]
```

---

## Publishing Checklist

1. **Validate:** `bun run validate`
2. **Test:** `bun test`
3. **Document:** Update README.md and CLAUDE.md
4. **Commit:** Use conventional commits
5. **PR:** Open pull request to main

### Plugin Metadata

Update `.claude-plugin/marketplace.json` with:
- Plugin categories
- Search tags
- Installation instructions
- Prerequisites

---

## Reference Plugins

Study these existing plugins for patterns:

| Plugin | Demonstrates |
|--------|-------------|
| `git` | MCP server with multiple tools, hooks, slash commands |
| `atuin` | MCP server, hooks integration, shell history |
| `kit` | Complex MCP server with AST search |
| `bun-runner` | Test/lint integration hooks |
| `plugin-template` | Scaffolding and code generation |
