---
description: Find all definitions of a symbol without grepping files
argument-hint: <symbol-name> [index-path]
allowed-tools: Bash(kit-index:*)
model: claude-haiku-4-5-20251001
---

# Find Symbol Definitions

Find where a symbol is defined in PROJECT_INDEX.json without grepping files.

## Your Task

Execute the kit find command with the provided symbol name: $ARGUMENTS

Use the Bash tool to run:
```bash
bun run ${CLAUDE_PLUGIN_ROOT}/src/cli.ts find $ARGUMENTS
```

What happens:
- Searches PROJECT_INDEX.json for exact matches
- Falls back to fuzzy search if no exact match found
- Returns symbol location with file path and line number

After execution, display the results showing where the symbol is defined.
