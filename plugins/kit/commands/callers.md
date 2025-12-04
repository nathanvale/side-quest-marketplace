---
description: Find all call sites of a function (blast radius analysis)
argument-hint: <function-name>
allowed-tools: Bash(jq:*), Bash(cat:*), Bash(test:*), Grep
---

# Find Function Callers

Query PROJECT_INDEX.json to find all places that call a function.

## Pre-flight Check

```bash
test -f PROJECT_INDEX.json && echo "INDEX_EXISTS" || echo "INDEX_MISSING"
```

If INDEX_MISSING, tell user to run `/kit:prime` first.

## Strategy

The kit index may have a call graph (`g` key) if available. Otherwise, fall back to grep.

### Option 1: Query Call Graph (if available)

```bash
cat PROJECT_INDEX.json | jq 'has("g")'
```

If the index has a call graph, query it for incoming edges to the function.

### Option 2: Grep Fallback

If no call graph, use targeted grep:

```bash
# Find files that likely call this function
cat PROJECT_INDEX.json | jq -r '.files[]' | head -100
```

Then use Grep tool to find call sites:
- Pattern: `$ARGUMENTS\s*\(`
- Exclude: the definition file itself
- Exclude: test files (optional, ask user)

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
