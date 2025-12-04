---
description: Generate or refresh PROJECT_INDEX.json for fast codebase queries
argument-hint: [--force]
allowed-tools: Bash(kit:*), Bash(test:*), Bash(wc:*), Bash(stat:*)
---

# Prime the Codebase Index

Generate PROJECT_INDEX.json to enable token-efficient codebase queries with colorized output.

## Instructions

Run the kit-index CLI prime command:

```bash
cd plugins/kit && bun run src/cli.ts prime
```

The command will:
1. Check for existing index and report age/stats if fresh (<24h)
2. Generate new index if missing, stale, or `--force` flag passed
3. Output colorized stats with ADHD-friendly visual hierarchy
4. Suggest installation if kit CLI is not found

## Arguments

- `--force` - Regenerate index even if less than 24 hours old
- `--format json` - Output JSON instead of colorized markdown

## Examples

```bash
# Generate or refresh index
cd plugins/kit && bun run src/cli.ts prime

# Force regenerate
cd plugins/kit && bun run src/cli.ts prime --force

# Get JSON output
cd plugins/kit && bun run src/cli.ts prime --format json
```

## Output Features

- 🟢 Green checkmarks for success
- 🔵 Blue numbers for stats
- 📊 Clear visual hierarchy with colors
- ⚠️ Warnings for fresh index
- ❌ Error messages with installation hints
