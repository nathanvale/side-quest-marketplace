---
description: Create a new plugin scaffold with configurable components
argument-hint: [plugin-name]
model: claude-sonnet-4-5-20250929
allowed-tools: Bash, Write, Edit, Read, Glob, AskUserQuestion
---

# Create New Plugin

Generate a new plugin scaffold with configurable components following the SideQuest marketplace patterns.

## Instructions

You are a plugin scaffolding specialist. Create well-structured Claude Code plugins using the established patterns.

### Input

The plugin name is provided as `$1` (or `$ARGUMENTS`).

### Validation

1. **Plugin name** must be in kebab-case format:
   - Lowercase letters, numbers, and hyphens only
   - Must start with a letter
   - No consecutive hyphens
   - Examples: `my-plugin`, `code-analyzer`, `git-helper`

2. **Check for conflicts**:
   - Verify `plugins/{name}` directory doesn't already exist
   - Check marketplace.json for existing plugin with same name

### Step 1: Component Selection

Use `AskUserQuestion` to ask the user which components to include:

**Question**: "Which components should this plugin include?"

| Component | Description |
|-----------|-------------|
| commands | Slash commands (e.g., `/plugin:action`) |
| mcp-server | MCP server with tools for Claude to call |
| hooks | Event hooks (PostToolUse, PreToolUse, etc.) |
| skills | Autonomous capabilities Claude can invoke |

Enable multi-select. Default to all components if user doesn't specify.

### Step 2: Implementation Type Selection

Use `AskUserQuestion` to ask about implementation type:

**Question**: "What implementation type?"

| Type | Description |
|------|-------------|
| Markdown only | Commands/skills are just prompts, no code (stub scripts) |
| TypeScript | Includes CLI tools, utilities, or testable logic (full scripts + src/) |

**Auto-select TypeScript** if `mcp-server` component was chosen (MCP always needs code).

### Directory Structure

Based on selections, create:

```
MARKDOWN ONLY:                     TYPESCRIPT:

plugins/{name}/                    plugins/{name}/
├── .claude-plugin/                ├── .claude-plugin/
│   └── plugin.json                │   └── plugin.json
├── package.json    ←(stubs)       ├── package.json    ←(full)
├── commands/                      ├── tsconfig.json
│   └── sample.md                  ├── src/
└── skills/                        │   ├── index.ts
    └── {name}/                    │   └── index.test.ts
        └── SKILL.md               ├── commands/
                                   │   └── sample.md
                                   └── skills/
                                       └── {name}/
                                           └── SKILL.md
```

### Package.json Differences

**Markdown only (stub scripts):**
```json
{
  "scripts": {
    "test": "echo 'No tests'",
    "typecheck": "echo 'No typecheck'"
  }
}
```

**TypeScript (full scripts):**
```json
{
  "scripts": {
    "test": "bun test --recursive",
    "typecheck": "bunx tsc --noEmit",
    "format": "bunx @biomejs/biome format --write .",
    "lint": "bunx @biomejs/biome lint .",
    "check": "bunx @biomejs/biome check --write ."
  },
  "devDependencies": {
    "@types/bun": "latest"
  }
}
```

### Author Information

Default to git config:
- Name: `git config user.name`
- Email: `git config user.email`

### File Generation

Use templates from `$PLUGIN_DIR/src/templates.ts`:

1. **package.json**: Use `packageJsonForType()` based on implementation type
2. **plugin.json**: Metadata with name, description, version, author
3. **tsconfig.json**: Only for TypeScript type
4. **src/index.ts**: Only for TypeScript type
5. **src/index.test.ts**: Only for TypeScript type
6. **sample.md**: Command with frontmatter and usage example
7. **index.ts**: MCP server using `mcpez` library
8. **.mcp.json**: Server configuration with `${CLAUDE_PLUGIN_ROOT}`
9. **hooks.json**: Empty hooks structure with comments
10. **SKILL.md**: Skill with frontmatter and instructions

### Marketplace Registration

After generating files, update `.claude-plugin/marketplace.json`:

1. Read current marketplace.json
2. Add new plugin entry to the `plugins` array:
   ```json
   {
     "name": "{name}",
     "source": "./plugins/{name}",
     "description": "{description}",
     "version": "1.0.0",
     "author": { "name": "{author}" },
     "category": "development",
     "keywords": ["{name}"]
   }
   ```
3. Write updated marketplace.json

### Post-Generation Steps

After creating the plugin:

1. **Run setup commands** (TypeScript only):
   ```bash
   cd plugins/{name} && bun install
   ```

2. **Verify generation** (TypeScript only):
   ```bash
   bun test --recursive
   ```

3. **Output summary**:
   - List all created files
   - Show implementation type chosen
   - Show next steps for the user
   - Mention `/plugin-template:strip` if they want to remove TypeScript later
   - Mention `/plugin-template:upgrade` if they want to add TypeScript later

### Example Usage

```
User: /plugin-template:create my-awesome-plugin
```

Expected flow:
1. Validate plugin name
2. Ask which components to include (multi-select)
3. Ask implementation type (unless mcp-server forces TypeScript)
4. Create directory structure
5. Generate all files
6. Register in marketplace
7. Run bun install (if TypeScript)
8. Show summary with next steps

### Error Handling

- If plugin name is invalid, explain the format requirements
- If directory already exists, ask user if they want to overwrite
- If marketplace.json update fails, show manual steps
- Always clean up partial generation on failure

### Important Notes

- Follow the @sidequest namespace convention
- Use Biome for formatting (configured in root biome.json)
- MCP servers use mcpez library
- All paths should use `${CLAUDE_PLUGIN_ROOT}` for portability
- Generated code should pass typecheck and lint
- If user chose mcp-server, TypeScript is auto-selected

Now create the plugin scaffold based on the provided name and user preferences.
