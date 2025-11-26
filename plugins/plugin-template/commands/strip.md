---
description: Strip TypeScript from a plugin, converting it to markdown-only
argument-hint: [plugin-name]
model: claude-sonnet-4-5-20250929
allowed-tools: Bash, Write, Edit, Read, Glob, AskUserQuestion
---

# Strip TypeScript from Plugin

Remove TypeScript setup from a plugin, converting it to markdown-only mode with stub scripts.

## Instructions

You are a plugin maintenance specialist. Safely strip TypeScript from plugins while preserving markdown content.

### Input

The plugin name is provided as `$1` (or `$ARGUMENTS`).

### Validation

1. **Verify plugin exists**:
   - Check `plugins/{name}` directory exists
   - If not found, show error and list available plugins

2. **Verify it's a TypeScript plugin**:
   - Check for `tsconfig.json` presence
   - If already markdown-only, inform user and exit

3. **Check for MCP server**:
   - If `mcp-servers/` exists, warn user that MCP requires TypeScript
   - Ask if they want to proceed anyway (will break MCP functionality)

### Confirmation Required

**CRITICAL**: Before making any changes, use `AskUserQuestion`:

**Question**: "Are you sure you want to strip TypeScript from '{name}'?"

Show what will be deleted:
- `tsconfig.json`
- `src/` directory (all files)
- `devDependencies` from package.json

Show what will be modified:
- `package.json` scripts will become stubs

Options:
1. **Yes, strip TypeScript** - Proceed with removal
2. **No, cancel** - Abort operation

### Files to Delete

```
plugins/{name}/
├── tsconfig.json        ❌ DELETE
└── src/                 ❌ DELETE (entire directory)
    ├── index.ts         ❌
    ├── index.test.ts    ❌
    └── ...              ❌
```

### Files to Modify

**package.json** - Replace scripts with stubs:

Before:
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

After:
```json
{
  "scripts": {
    "test": "echo 'No tests'",
    "typecheck": "echo 'No typecheck'"
  }
}
```

### Execution Steps

1. **Confirm with user** (AskUserQuestion)
2. **Delete tsconfig.json**:
   ```bash
   rm plugins/{name}/tsconfig.json
   ```
3. **Delete src/ directory**:
   ```bash
   rm -rf plugins/{name}/src
   ```
4. **Update package.json**:
   - Read current package.json
   - Replace scripts with stub versions
   - Remove devDependencies
   - Write updated package.json

### Files to Preserve

Do NOT touch these:
- `.claude-plugin/plugin.json`
- `commands/` directory
- `skills/` directory
- `hooks/` directory
- `mcp-servers/` directory (warn but preserve)
- `.mcp.json`

### Output Summary

After stripping:

```
Stripped TypeScript from 'my-plugin'

Deleted:
  - tsconfig.json
  - src/index.ts
  - src/index.test.ts

Modified:
  - package.json (scripts now use stubs)

Plugin is now markdown-only.

To add TypeScript back later:
  /plugin-template:upgrade my-plugin
```

### Error Handling

- If plugin doesn't exist, list available plugins
- If already markdown-only, inform user (no action needed)
- If deletion fails, show error and rollback suggestions
- If package.json update fails, show manual fix steps

### Example Usage

```
User: /plugin-template:strip my-plugin