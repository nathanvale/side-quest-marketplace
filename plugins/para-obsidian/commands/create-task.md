Create a new task note for actionable items.

Tasks are specific, actionable items with clear completion criteria.

## Required Arguments
- `$TITLE` - Task description
- `$PRIORITY` - Priority level: low | medium | high | urgent
- `$EFFORT` - Effort estimate: small | medium | large

## Optional Arguments
- `$TASK_TYPE` - Type: task (default) | reminder | habit | chore
- `$PROJECT` - Related project as wikilink (e.g. "[[Cinema Booking Tool]]")
- `$AREA` - Related area as wikilink (e.g. "[[Health]]")
- `$DEST` - Destination folder (default: 00_Inbox)

## Auto-filled Fields
- `created` - Today's date
- `status` - not-started
- `template_version` - 2
- `tags` - Always includes "task"

## Frontmatter Hints
- **task_type**: task | reminder | habit | chore
- **status**: not-started | in-progress | blocked | done | cancelled
- **priority**: low | medium | high | urgent
- **effort**: small | medium | large
- **Suggested tags**: task, work, family, health, home

## Command
```bash
para-obsidian create --template task \
  --title "$TITLE" \
  --dest "${DEST:-00_Inbox}" \
  --arg "Task title=$TITLE" \
  --arg "Priority=$PRIORITY" \
  --arg "Effort=$EFFORT" \
  --arg "Task type=${TASK_TYPE:-task}" \
  --arg "Project=${PROJECT:-}" \
  --arg "Area=${AREA:-}"
```

## Example Usage

For quick task: "Book dentist appointment"

```
TITLE: "Book Dentist Appointment"
PRIORITY: "medium"
EFFORT: "small"
AREA: "[[Health]]"
```

For project task: "Implement login screen"

```
TITLE: "Implement Login Screen"
PRIORITY: "high"
EFFORT: "large"
PROJECT: "[[Mobile App Redesign]]"
```
