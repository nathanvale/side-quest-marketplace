---
description: Codebase overview and health metrics from the index
argument-hint: [index-path]
allowed-tools: Bash(kit-index:*)
model: claude-haiku-4-5-20251001
---

# Codebase Statistics

Quick snapshot of codebase health from PROJECT_INDEX.json without reading source files.

## Your Task

Execute the kit stats command with any provided arguments: $ARGUMENTS

Use the Bash tool to run:
```bash
bun run ${CLAUDE_PLUGIN_ROOT}/src/cli.ts stats $ARGUMENTS
```

What happens:
- Reads PROJECT_INDEX.json and analyzes codebase metrics
- Shows file counts, symbol distribution, and complexity hotspots
- Reports index freshness and health indicators

After execution, display the statistics and provide insights:
- **High complexity directories** may need refactoring
- **Files with many symbols** could be split
- **Stale index** → suggest running `/kit:prime`
