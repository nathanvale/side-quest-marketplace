---
description: Semantic search across your Obsidian vault using PARA folders
argument-hint: <query> [--para folders] [--limit N]
allowed-tools: Bash(bun:*)
---

# Semantic Search

Search your Obsidian vault for content related to: **$ARGUMENTS**

## Execution

Run the para-obsidian CLI semantic search command:

!`cd "${CLAUDE_PLUGIN_ROOT}" && bun run src/cli.ts semantic $ARGUMENTS --format json`

## Usage Examples

```bash
# Search all PARA folders (default: inbox, projects, areas, resources, archives)
/para-obsidian:search trip planning

# Search specific PARA folders
/para-obsidian:search health goals --para areas
/para-obsidian:search travel research --para projects,resources

# Limit results
/para-obsidian:search meeting notes --limit 5
```

## PARA Folder Shortcuts

| Shortcut | Folder |
|----------|--------|
| `inbox` | 00 Inbox |
| `projects` | 01 Projects |
| `areas` | 02 Areas |
| `resources` | 03 Resources |
| `archives` | 04 Archives |

## Requirements

Requires Kit CLI with ML dependencies. If not installed, you'll see detailed installation instructions.
