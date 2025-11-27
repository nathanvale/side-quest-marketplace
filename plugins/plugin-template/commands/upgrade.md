---
description: Add TypeScript setup to a markdown-only plugin
argument-hint: [plugin-name]
model: claude-sonnet-4-5-20250929
allowed-tools: Bash, Write, Edit, Read, Glob
---

# Upgrade Plugin to TypeScript

Add TypeScript setup to a markdown-only plugin, enabling CLI tools, utilities, and testable logic.

## Instructions

You are a plugin maintenance specialist. Safely upgrade plugins to TypeScript while preserving existing content.

### Input

The plugin name is provided as `$1` (or `$ARGUMENTS`).

### Validation

1. **Verify plugin exists**:
   - Check `plugins/{name}` directory exists
   - If not found, show error and list available plugins

2. **Verify it's a markdown-only plugin**:
   - Check for absence of `tsconfig.json`
   - If already TypeScript, inform user and exit

### Files to Create

```
plugins/{name}/
├── tsconfig.json        ✨ CREATE
└── src/                 ✨ CREATE
    ├── index.ts         ✨ CREATE
    └── index.test.ts    ✨ CREATE
```

### Files to Modify

**package.json** - Replace stub scripts with full TypeScript scripts:

Before:
```json
{
  "scripts": {
    "test": "echo 'No tests'",
    "typecheck": "echo 'No typecheck'"
  }
}
```

After:
```json
{
  "scripts": {
    "test": "bun test --recursive",
    "typecheck": "tsc --noEmit",
    "format": "biome format --write .",
    "format:check": "biome format .",
    "lint": "biome lint .",
    "check": "biome check --write ."
  },
  "devDependencies": {
    "@types/bun": "latest"
  }
}
```

### Template Content

**tsconfig.json**:
```json
{
  "extends": "../../tsconfig.base.json",
  "include": ["src/**/*.ts"],
  "exclude": ["**/node_modules/**"]
}
```

**src/index.ts** - Use template from `$PLUGIN_DIR/src/templates.ts`:
- Export interface for plugin result type
- Export sample function with JSDoc
- Ready for user to add their logic

**src/index.test.ts** - Use template from `$PLUGIN_DIR/src/templates.ts`:
- Import from bun:test
- Basic test for sample function
- Ready for user to add more tests

### Execution Steps

1. **Create tsconfig.json**
2. **Create src/ directory**
3. **Create src/index.ts** with template
4. **Create src/index.test.ts** with template
5. **Update package.json**:
   - Read current package.json
   - Add full scripts
   - Add devDependencies
   - Write updated package.json
6. **Run bun install**
7. **Run tests to verify**

### Files to Preserve

Do NOT touch these:
- `.claude-plugin/plugin.json`
- `commands/` directory
- `skills/` directory
- `hooks/` directory
- `mcp-servers/` directory
- `.mcp.json`

### Post-Upgrade Steps

```bash
cd plugins/{name} && bun install && bun test
```

### Output Summary

After upgrading:

```
Upgraded 'my-plugin' to TypeScript

Created:
  - tsconfig.json
  - src/index.ts
  - src/index.test.ts

Modified:
  - package.json (full scripts + devDependencies)

Next steps:
  1. Edit src/index.ts to add your logic
  2. Add tests to src/index.test.ts
  3. Run 'bun test' to verify

To strip TypeScript later:
  /plugin-template:strip my-plugin
```

### Error Handling

- If plugin doesn't exist, list available plugins
- If already TypeScript, inform user (no action needed)
- If file creation fails, show error and cleanup steps
- If bun install fails, show manual steps

### Example Usage

```
User: /plugin-template:upgrade my-plugin
```

Expected flow:
1. Validate plugin exists and is markdown-only
2. Create tsconfig.json
3. Create src/index.ts and src/index.test.ts
4. Update package.json with full scripts
5. Run bun install
6. Run bun test to verify
7. Show summary with next steps
