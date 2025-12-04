---
description: Find all functions called by a given function
argument-hint: <function-name>
allowed-tools: Bash(kit-index:*)
model: claude-haiku-4-5-20251001
---

# Find Function Dependencies

Query PROJECT_INDEX.json to find what functions a given function calls.

## Usage

```bash
bun run ${CLAUDE_PLUGIN_ROOT}/src/cli.ts calls $ARGUMENTS
```

The CLI will locate the function and analyze what it calls (local, imported, and external).

## Analysis

When reading the function body, identify:
- Direct function calls: `functionName(...)`
- Method calls: `this.method(...)` or `obj.method(...)`
- Imported functions being called

Cross-reference with the symbol index to determine:
- Which are local functions (defined in same file)
- Which are imported (from other files)
- Which are external (from node_modules)

## Output Format

```
`functionName` calls N functions:

Local (same file):
- helperFunction (line 45)
- validateInput (line 23)

Imported (from project):
- logger.info (from src/lib/logger.ts)
- createRecord (from src/services/dataverse.ts)

External:
- fs.readFile (node:fs)
- zod.parse (zod)
```

## Use Cases

- **Understanding complexity**: See what a function depends on
- **Refactoring**: Know what to mock or extract
- **Dependency analysis**: Identify tightly coupled code
