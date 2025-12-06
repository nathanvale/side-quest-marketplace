---
description: Create a new project note in the Obsidian vault
argument-hint: <title> <target-date> <area> [dest]
allowed-tools: Bash(para-obsidian:*)
---

## Variables

```bash
TITLE="$1"
TARGET_DATE="$2"
AREA="$3"
DEST="${4:-01_Projects}"
```

## Command

```bash
para-obsidian create --template project \
  --title "$TITLE" \
  --dest "$DEST" \
  --arg "Project title=$TITLE" \
  --arg "Target completion date (YYYY-MM-DD)=$TARGET_DATE" \
  --arg "Area=$AREA"
```

## Frontmatter Hints

- **status**: active (default) | on-hold | completed | archived
- **Suggested tags**: project, work, family, health, learning, finance, home, career

## Examples

```
/para-obsidian:create-project "Cinema Booking Tool" 2025-12-31 "[[AI Practice]]"
/para-obsidian:create-project "Drivers License Renewal" 2025-02-28 "[[Admin]]"
```
