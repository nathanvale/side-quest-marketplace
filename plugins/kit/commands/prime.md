---
description: Generate or refresh PROJECT_INDEX.json for fast codebase queries
argument-hint: [path] [--force] [--format json]
allowed-tools: Bash(kit:*), Bash(test:*), Bash(wc:*), Bash(stat:*)
---

# Prime the Codebase Index

Generate PROJECT_INDEX.json to enable token-efficient codebase queries with colorized output.

## Instructions

Run the kit-index CLI prime command from anywhere - it automatically finds and indexes the git repository root:

```bash
bun run /Users/nathanvale/code/side-quest-marketplace/plugins/kit/src/cli.ts prime
```

The command will:
1. Auto-detect git repository root (or use CWD if not in a git repo)
2. Check for existing index and report age/stats if fresh (<24h)
3. Generate new index if missing, stale, or `--force` flag passed
4. Output colorized stats with ADHD-friendly visual hierarchy
5. Suggest installation if kit CLI is not found

## Arguments

- `[path]` - Optional directory to index (defaults to git root, then CWD)
- `--force` - Regenerate index even if less than 24 hours old
- `--format json` - Output JSON instead of colorized markdown

## Examples

```bash
# Generate index at git root (auto-detected)
bun run /Users/nathanvale/code/side-quest-marketplace/plugins/kit/src/cli.ts prime

# Generate index for specific directory
bun run /Users/nathanvale/code/side-quest-marketplace/plugins/kit/src/cli.ts prime /path/to/project

# Force regenerate at git root
bun run /Users/nathanvale/code/side-quest-marketplace/plugins/kit/src/cli.ts prime --force

# Index specific directory with JSON output
bun run /Users/nathanvale/code/side-quest-marketplace/plugins/kit/src/cli.ts prime ~/my-project --format json
```

## Output Features

- 🟢 Green checkmarks for success
- 🔵 Blue numbers for stats
- 📊 Clear visual hierarchy with colors
- ⚠️ Warnings for fresh index
- ❌ Error messages with installation hints
