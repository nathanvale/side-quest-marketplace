---
description: Generate or refresh PROJECT_INDEX.json for fast codebase queries
argument-hint: [path] [--force] [--format json]
allowed-tools: Bash(kit:*), Bash(test:*), Bash(wc:*), Bash(stat:*)
model: claude-haiku-4-5-20251001
---

# Prime the Codebase Index

Generate PROJECT_INDEX.json to enable token-efficient codebase queries with colorized output.

## Your Task

Execute the kit prime command with any provided arguments: $ARGUMENTS

Use the Bash tool to run:
```bash
bun run ${CLAUDE_PLUGIN_ROOT}/src/cli.ts prime $ARGUMENTS
```

If no arguments are provided, run without additional flags. Common arguments:
- `--force` - Regenerate index even if less than 24 hours old
- `--format json` - Output JSON instead of colorized markdown

What happens:
- Auto-detects git repository root
- Checks for existing index (warns if fresh < 24h)
- Generates new index if missing, stale, or `--force` used
- Reports file count, symbol count, and index size

After execution, display the output to the user showing the index status.
