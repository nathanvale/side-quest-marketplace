---
description: Find potentially unused exports (dead code detection)
argument-hint: [path?]
allowed-tools: Bash(kit-index:*)
---

# Find Dead Code

Analyze PROJECT_INDEX.json to find exports with zero incoming references.

## Usage

```bash
cd plugins/kit && bun run src/cli.ts dead [$ARGUMENTS]
```

The CLI will scan for exported symbols with no references. Optional path argument scopes analysis to a directory.

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
