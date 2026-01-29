---
description: Create a resource note from any URL with automatic enrichment and Layer 1 content
argument-hint: <url> [--area '[[Area]]'] [--project '[[Project]]'] [--title 'Title']
---

# Quick Resource

Create a resource note from any URL in one step. Fetches content, classifies it, creates the note with Layer 1, and commits to vault.

## Usage

```
/para-obsidian:quick-resource <url>
/para-obsidian:quick-resource <url> --area '[[🌱 Area Name]]'
/para-obsidian:quick-resource <url> --project '[[🎯 Project Name]]' --title 'Custom Title'
```

## Examples

```
/para-obsidian:quick-resource https://www.youtube.com/watch?v=ey4u7OUAF3c
/para-obsidian:quick-resource https://kentcdodds.com/blog/aha-programming --area '[[🌱 AI Practice]]'
/para-obsidian:quick-resource https://x.com/housecor/status/1234567890 --title 'Cory on Testing'
```

## Arguments

| Argument | Required | Description |
|----------|----------|-------------|
| `<url>` | Yes | URL to create resource from |
| `--area` | No | Target area (wikilink format) |
| `--project` | No | Target project (wikilink format) |
| `--title` | No | Override auto-detected title |

## What This Does

1. **Enriches** - Fetches full content (YouTube transcript, article text, thread)
2. **Classifies** - Determines resource type, area, project, emoji prefix
3. **Proposes** - Shows proposal for review before creating
4. **Creates** - Resource note with frontmatter in `03 Resources/`
5. **Injects Layer 1** - Formatted content for progressive summarization
6. **Commits** - Auto-commits to vault git

## Instructions

This command invokes the `quick-resource` skill. The skill handles all orchestration inline, with access to conversation context for content reuse.

## Notes

- Reuses content already fetched in the current conversation (no duplicate scraping)
- For batch processing, use `/para-obsidian:triage` instead
- Created notes have `distilled: false` - use `/para-obsidian:distill-resource` for deeper analysis
- Supports YouTube, articles, X/Twitter threads, and any web page
