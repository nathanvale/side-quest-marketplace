---
description: Create a new task note for actionable items
argument-hint: <title> <priority> <effort> [task-type] [project] [area] [dest]
allowed-tools: Bash(para-obsidian:*)
---

## Variables

```bash
TITLE="$1"
PRIORITY="$2"
EFFORT="$3"
TASK_TYPE="${4:-task}"
PROJECT="${5:-}"
AREA="${6:-}"
DEST="${7:-00_Inbox}"
```

**priority options**: low | medium | high | urgent
**effort options**: small | medium | large
**task_type options**: task | reminder | habit | chore

## Command

```bash
para-obsidian create --template task \
  --title "$TITLE" \
  --dest "$DEST" \
  --arg "Task title=$TITLE" \
  --arg "Priority=$PRIORITY" \
  --arg "Effort=$EFFORT" \
  --arg "Task type=$TASK_TYPE" \
  --arg "Project=$PROJECT" \
  --arg "Area=$AREA"
```

## Frontmatter Hints

- **status**: not-started | in-progress | blocked | done | cancelled
- **Suggested tags**: task, work, family, health, home

## Examples

```
/para-obsidian:create-task "Book Dentist Appointment" medium small task "" "[[Health]]"
/para-obsidian:create-task "Implement Login Screen" high large task "[[Mobile App Redesign]]"
/para-obsidian:create-task "Pay electricity bill" medium small reminder "" "[[Finance]]"
```
