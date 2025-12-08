---
description: Create PARA notes from templates with optional AI-powered field extraction
argument-hint: <template> [title or --source file] [key=value args]
allowed-tools: Bash(para-obsidian:*)
---

# Create PARA Notes

Universal note creation command supporting all templates with two modes:

1. **Manual mode**: Provide title and args directly
2. **AI mode**: Extract metadata from existing note with `--source`

---

## Usage Patterns

### Pattern 1: Quick Create (Title + Args)

```bash
/para-obsidian:create <template> <title> [key=value...]
```

Example:
```bash
/para-obsidian:create task "Fix shed door" priority=high effort=small area="[[Home]]"
/para-obsidian:create project "Garden Redesign" target_completion=2025-06-30 area="[[Home]]"
```

### Pattern 2: AI-Powered Create (Extract from Source)

```bash
/para-obsidian:create <template> --source <file> [--preview] [--arg key=value...]
```

Example:
```bash
/para-obsidian:create task --source "inbox/rough-notes.md"
/para-obsidian:create project --source "inbox/ideas.md" --preview
/para-obsidian:create task --source "inbox/todo.md" --arg "priority=high"
```

---

## Template Quick Reference

| Template | Required Fields | Common Args |
|----------|-----------------|-------------|
| `task` | title | priority, effort, area, project |
| `project` | title | target_completion, area, status |
| `area` | title | responsibility |
| `resource` | title | source, type, areas |
| `trip` | title, start_date, end_date | area, status |
| `booking` | title | booking_type, project, date, cost |
| `capture` | title | content, captured_from, tags |

**Tip**: Run without args to see template-specific field requirements:
```bash
bun src/cli.ts template-fields <template> --format json
```

---

## How to Use

When the user invokes this command, analyze their arguments and construct the appropriate CLI call:

### Parse the arguments provided by the user:

1. **First argument** is always the template name
2. **Detect mode**:
   - If second arg is `--source`: AI mode (extract from file)
   - Otherwise: Manual mode (title + args)

### AI Mode (when --source is present):

```bash
bun src/cli.ts create \
  --template <template> \
  --source <file> \
  [--preview] \
  [--arg key=value ...]
```

- `--preview`: Show suggestions without creating (75% token savings)
- `--arg`: Override AI suggestions (e.g., `--arg "priority=high"`)

### Manual Mode (title + args):

```bash
bun src/cli.ts create \
  --template <template> \
  --title "<title>" \
  [--arg key=value ...]
```

- Parse remaining args as `key=value` pairs
- Add each as `--arg "key=value"`

---

## Examples

### Manual Mode

```bash
# Task with priority and effort
/para-obsidian:create task "Book dentist appointment" priority=high effort=small area="[[Health]]"

# Project with completion date
/para-obsidian:create project "Kitchen Renovation" target_completion=2025-08-15 area="[[Home]]" status=planning

# Trip with dates
/para-obsidian:create trip "Tassie 2026" start_date=2026-01-05 end_date=2026-01-15 area="[[Travel]]"

# Daily note (no args needed)
/para-obsidian:create daily
```

### AI Mode

```bash
# Preview AI suggestions without creating
/para-obsidian:create task --source "inbox/rough-notes.md" --preview

# Create task from rough notes
/para-obsidian:create task --source "inbox/brainstorm.md"

# Override AI suggestions
/para-obsidian:create project --source "inbox/idea.md" --arg "area=[[Work]]" --arg "status=active"

# Extract trip from email
/para-obsidian:create trip --source "inbox/holiday-plans.md"
```

---

## Field Discovery

To see exactly what fields a template needs:

```bash
bun src/cli.ts template-fields <template> --format json
```

Returns:
```json
{
  "template": "task",
  "version": 1,
  "fields": {
    "required": ["Task title", "Priority", "Effort estimate"],
    "auto": ["created"],
    "body": []
  }
}
```

**Important**: Field names must match Templater prompt text exactly (case-sensitive).

---

## Default Destinations

Notes are placed in PARA folders automatically unless `--dest` specified:

| Template | Default Folder |
|----------|----------------|
| project, trip | `01 Projects` |
| area | `02 Areas` |
| resource | `03 Resources` |
| task | `Tasks` |
| booking, checklist, itinerary, research, capture, daily | `00 Inbox` |

---

## Notes

- **Wikilinks**: Area/project wikilinks are automatically quoted for Dataview compatibility
- **AI models**: Default is `sonnet`, override with `--model haiku` or `--model qwen2.5:14b`
- **Token savings**: Use `--preview` to see suggestions without creating (75% token reduction)
- **Overrides**: `--arg` flags override AI suggestions in AI mode
