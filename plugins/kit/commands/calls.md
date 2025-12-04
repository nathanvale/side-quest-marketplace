---
description: Find all functions called by a given function
argument-hint: <function-name>
allowed-tools: Bash(jq:*), Bash(cat:*), Bash(test:*), Read
---

# Find Function Dependencies

Query PROJECT_INDEX.json to find what functions a given function calls.

## Pre-flight Check

```bash
test -f PROJECT_INDEX.json && echo "INDEX_EXISTS" || echo "INDEX_MISSING"
```

If INDEX_MISSING, tell user to run `/kit:prime` first.

## Strategy

1. First, find the function definition:

```bash
cat PROJECT_INDEX.json | jq --arg name "$ARGUMENTS" '
  [.symbols | to_entries[] | .value[] | select(.name == $name and .type == "function")] | .[0]
'
```

2. Get the file and line range for the function

3. Read that specific function from the source file

4. Parse the function body to identify called functions

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
