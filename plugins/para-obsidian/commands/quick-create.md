---
description: Create a note from any URL with automatic template routing (resource, meeting, invoice, booking)
argument-hint: <url> [--template resource|meeting|invoice|booking] [--area '[[Area]]'] [--project '[[Project]]'] [--title 'Title']
---

# Quick Create

Create a note from any URL in one step. Fetches content, auto-detects the correct template (resource, meeting, invoice, booking), creates the note, and commits to vault.

## Usage

```
/para-obsidian:quick-create <url>
/para-obsidian:quick-create <url> --template booking
/para-obsidian:quick-create <url> --area '[[🌱 Area Name]]'
/para-obsidian:quick-create <url> --project '[[🎯 Project Name]]' --title 'Custom Title'
```

## Examples

```
/para-obsidian:quick-create https://www.youtube.com/watch?v=ey4u7OUAF3c
/para-obsidian:quick-create https://kentcdodds.com/blog/aha-programming --area '[[🌱 AI Practice]]'
/para-obsidian:quick-create https://x.com/housecor/status/1234567890 --title 'Cory on Testing'
/para-obsidian:quick-create https://booking.example.com/confirm/abc --template booking
```

## Arguments

| Argument | Required | Description |
|----------|----------|-------------|
| `<url>` | Yes | URL to create note from |
| `--template` | No | Override auto-detected template (`resource`, `meeting`, `invoice`, `booking`) |
| `--area` | No | Target area (wikilink format) |
| `--project` | No | Target project (wikilink format) |
| `--title` | No | Override auto-detected title |

## What This Does

1. **Enriches** - Fetches full content (YouTube transcript, article text, thread)
2. **Classifies** - Auto-detects template type from content (or uses `--template` override)
3. **Proposes** - Shows template-specific proposal for review before creating
4. **Creates** - Note with appropriate frontmatter in the correct destination
5. **Injects content** - Layer 1 for resources, structured sections for meetings, frontmatter-only for invoices/bookings
6. **Commits** - Auto-commits to vault git

## Instructions

When invoked, load the `quick-create` skill for full workflow details:

```
@plugins/para-obsidian/skills/quick-create/SKILL.md
```

## Notes

- For batch processing, use `/para-obsidian:triage` instead
- Resource notes have `distilled: false` - use `/para-obsidian:distill-resource` for deeper analysis
- Supports YouTube, articles, X/Twitter threads, booking confirmations, invoices, and any web page
