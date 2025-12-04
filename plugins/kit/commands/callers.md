---
description: Find all call sites of a function (blast radius analysis)
argument-hint: <function-name>
allowed-tools: Bash(kit-index:*)
model: claude-haiku-4-5-20251001
---

# Find Function Callers

Query PROJECT_INDEX.json to find all places that call a function.

## Usage

```bash
bun run ${CLAUDE_PLUGIN_ROOT}/src/cli.ts callers $ARGUMENTS
```

The CLI will analyze the call graph and use grep fallback if needed.

## Output Format

```
Found N callers of `functionName`:

| File | Line | Context |
|------|------|---------|
| cli.ts | 42 | const result = functionName(args) |
| service.ts | 89 | await functionName() |

Impact Summary:
- Direct callers: N
- Files affected: M
- Test files: K (if including tests)
```

## Use Cases

- **Before refactoring**: Know what breaks if you change the signature
- **Deprecation planning**: Find all usages to migrate
- **Understanding code**: See how a function is used

## Limitations

Note to user: This finds direct calls only. For transitive callers (callers of callers), use `/kit:blast`.
