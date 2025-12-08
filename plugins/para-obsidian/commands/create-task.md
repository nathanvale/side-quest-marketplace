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
DEST="${7:-Tasks}"
```

**priority options**: low | medium | high | urgent
**effort options**: small | medium | large
**task_type options**: task | reminder | habit | chore

## Command

```bash
bun src/cli.ts create --template task \
  --title "$TITLE" \
  --dest "$DEST" \
  --arg "Task title=$TITLE" \
  --arg "Priority (low/medium/high/urgent)=$PRIORITY" \
  --arg "Effort (small/medium/large)=$EFFORT" \
  --arg "Task type (task/reminder/habit/chore)=$TASK_TYPE" \
  --arg "Project (optional)=$PROJECT" \
  --arg "Area (optional)=$AREA" \
  --content '{
    "Description": "...",
    "Success Criteria": "- [ ] ...",
    "Notes": "..."
  }'
```

## Content Sections

| Section | Purpose |
|---------|---------|
| `Description` | What is this task? Desired outcome? |
| `Success Criteria` | How will you know it's done? |
| `Notes` | Context, blockers, resources needed |

## Frontmatter Hints

- **status**: not-started | in-progress | blocked | done | cancelled
- **Suggested tags**: task, work, family, health, home
- **Wikilinks**: Project and area wikilinks are automatically quoted in YAML frontmatter for Dataview compatibility (e.g., `project: "[[Mobile App Redesign]]"`, `area: "[[Health]]"`)

## Examples

```
/para-obsidian:create-task "Book Dentist Appointment" medium small task "" "[[Health]]"
/para-obsidian:create-task "Implement Login Screen" high large task "[[Mobile App Redesign]]"
/para-obsidian:create-task "Pay electricity bill" medium small reminder "" "[[Finance]]"
```
