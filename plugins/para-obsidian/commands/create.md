---
description: Create any note type dynamically by querying template fields
argument-hint: <template> [key=value pairs or positional args]
allowed-tools: Bash(para-obsidian:*)
---

## Dynamic Note Creation

This command discovers template fields at runtime and maps your arguments to them.

## Step 1: Discover Template Fields

First, query the template to see what arguments are needed:

!`bun src/cli.ts template-fields $1 --format json`

## Step 2: Parse User Arguments

User provided: `$ARGUMENTS`

The arguments after the template name can be:
- **Named**: `title="My Note" area="[[Work]]"`
- **Positional**: Values in order of required fields

Map the user's input to the discovered fields from Step 1.

## Step 3: Build and Run Command

Construct the `para-obsidian create` command:

```bash
para-obsidian create --template $1 \
  --title "<title from args>" \
  --dest "<appropriate PARA folder>" \
  --arg "Field1=value1" \
  --arg "Field2=value2" \
  --content '{
    "Section1": "content...",
    "Section2": "content..."
  }'
```

## Available Templates

| Template | Default Dest | Key Fields |
|----------|--------------|------------|
| `project` | 01 Projects | title, target_date, area |
| `area` | 02 Areas | title |
| `resource` | 03 Resources | title, source, areas |
| `task` | Tasks | title, priority, effort |
| `capture` | 00 Inbox | title, content, captured_from |
| `daily` | Daily Notes | date |
| `checklist` | 00 Inbox | title, checklist_type, project |
| `booking` | 00 Inbox | title, booking_type, project, date, cost, currency |
| `itinerary` | 00 Inbox | title, project, trip_date, day_number |
| `research` | 00 Inbox | title, research_type, project |

## Examples

```
/para-obsidian:create project title="Cinema Tool" target_date="2025-12-31" area="[[AI Practice]]"
/para-obsidian:create task "Book Dentist" priority=medium effort=small area="[[Health]]"
/para-obsidian:create daily
/para-obsidian:create capture title="Quick idea" content="..." captured_from=thought
```

## Notes

- Use `para-obsidian template-fields <template> --format json` to see exact field names
- Field names must match Templater prompt text exactly (case-sensitive)
- For simpler usage, prefer the static `/para-obsidian:create-<type>` commands
