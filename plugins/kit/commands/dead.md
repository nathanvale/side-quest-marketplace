---
description: Find potentially unused exports (dead code detection)
argument-hint: [path?]
allowed-tools: Bash(jq:*), Bash(cat:*), Bash(test:*), Grep
---

# Find Dead Code

Analyze PROJECT_INDEX.json to find exports with zero incoming references.

## Pre-flight Check

```bash
test -f PROJECT_INDEX.json && echo "INDEX_EXISTS" || echo "INDEX_MISSING"
```

If INDEX_MISSING, tell user to run `/kit:prime` first.

## Strategy

1. **Get all exported symbols**:

```bash
cat PROJECT_INDEX.json | jq '
  [.symbols | to_entries[] |
   .value[] |
   select(.type == "function" or .type == "class" or .type == "variable" or .type == "type" or .type == "interface")] |
  group_by(.name) |
  map({name: .[0].name, file: .[0].file, type: .[0].type, count: length})
'
```

2. **For each symbol, check if it's referenced elsewhere**:
   - Use Grep to search for usage
   - Exclude the definition file
   - Exclude test files
   - Exclude index/barrel files

3. **Filter to symbols with zero references**

## Filtering (Optional)

If `$ARGUMENTS` contains a path, limit analysis to that directory:
- `/kit:dead src/lib/utils` - Only check utils directory

## Output Format

```
Found N potentially unused exports:

| Symbol | File | Type | Last Modified |
|--------|------|------|---------------|
| legacyHelper | utils/old.ts | function | 3 months ago |
| DEPRECATED_CONST | constants.ts | variable | 6 months ago |
| UnusedType | types.ts | type | 2 months ago |

Recommendations:
1. Verify these aren't used via dynamic imports
2. Check if they're part of public API
3. Consider removing or deprecating
```

## Exclusions

Automatically exclude from "unused" detection:
- Symbols in `index.ts` files (barrel exports)
- Symbols starting with `_` (private by convention)
- Test utilities
- Type-only exports used in `.d.ts` files

## Caveats

Warn the user:
- Dynamic imports (`import()`) may not be detected
- Re-exports from barrel files need manual verification
- Some exports are intentionally public API
