---
description: Enrich inbox notes with external data (YouTube transcripts, bookmarks, etc.)
argument-hint: <action> [target|--all] [--dry-run]
allowed-tools: Bash(para enrich*)
---

# Enrich Command

Enrich inbox notes by fetching external data based on note type.

## Usage

```
/para-obsidian:enrich <action> [target|--all] [--dry-run]
```

## Examples

```
/para-obsidian:enrich youtube "00 Inbox/my-video.md"
/para-obsidian:enrich youtube --all
/para-obsidian:enrich youtube --all --dry-run
```

## Available Actions

| Action | Description |
|--------|-------------|
| `youtube` | Fetch YouTube transcript for video clippings |

## Arguments

- `<action>` - The enrichment action to perform (youtube)
- `[target]` - File path to enrich (or use `--all` flag)
- `--all` - Enrich all eligible files in inbox
- `--dry-run` - Preview without executing

---

## Instructions

When the user invokes this command:

1. **Parse the action** from the first argument after "enrich"
2. **Extract target** (file path or `--all` flag)
3. **Execute the CLI** with `--format json` for structured output

```bash
bun ${CLAUDE_PLUGIN_ROOT}/src/cli.ts enrich <action> [target] [--all] [--dry-run] --format json
```

The CLI will:
- Identify eligible notes based on action type
- Fetch external data (e.g., YouTube transcripts)
- Update note content with enriched data
- Report success/failure with metrics

## Notes

- Slash commands cannot be interactive - always uses JSON mode
- Requires explicit target (file path or --all flag)
- Run BEFORE `para scan` to ensure notes are enriched before classification
- Respects dry-run mode for preview
