---
description: Create PARA notes with AI-powered metadata extraction
argument-hint: <template> <description of what you want to create>
allowed-tools: Bash(para-obsidian:*)
---

# Create PARA Notes

Create notes using AI to extract metadata from your description.

## Usage

```
/para-obsidian:create <template> <description>
```

## Examples

```
/para-obsidian:create area I need to manage my dog Muffin - vet visits, grooming every 6 weeks, food subscription, daily walks
/para-obsidian:create task Book the plumber to fix the kitchen sink, it's been leaking for a week
/para-obsidian:create project Planning our trip to Tasmania in January 2026
```

## Available Templates

| Template | Use For |
|----------|---------|
| `task` | Single actionable items |
| `project` | Multi-step goals with deadlines |
| `area` | Ongoing responsibilities |
| `resource` | Reference material |
| `trip` | Travel planning |
| `booking` | Reservations and tickets |
| `capture` | Quick notes to process later |
| `daily` | Daily journal entry |

---

## Instructions

When the user invokes this command:

1. **Extract the template** from the first argument
2. **Pass everything else** as `--source-text` to the CLI for AI extraction

```bash
bun ${CLAUDE_PLUGIN_ROOT}/src/cli.ts create \
  --template <template> \
  --source-text "<user's description>"
```

The CLI will:
- Run LLM extraction to determine title and metadata
- Create the note with proper frontmatter
- Place it in the correct PARA folder

**Model**: Uses `sonnet` by default. Override with `--model haiku` for faster/cheaper extraction.
