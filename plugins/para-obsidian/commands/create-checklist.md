---
description: Create a reusable checklist note
argument-hint: <title> <checklist-type> <project> [dest]
allowed-tools: Bash(para-obsidian:*)
---

## Variables

```bash
TITLE="$1"
CHECKLIST_TYPE="$2"
PROJECT="$3"
DEST="${4:-00_Inbox}"
```

**checklist_type options**: packing | deployment | review | shopping | travel | maintenance

## Command

```bash
para-obsidian create --template checklist \
  --title "$TITLE" \
  --dest "$DEST" \
  --arg "Checklist title=$TITLE" \
  --arg "Checklist type=$CHECKLIST_TYPE" \
  --arg "Project=$PROJECT"
```

## Frontmatter Hints

- **status**: draft | active | completed
- **Suggested tags**: checklist, process, recurring

## Examples

```
/para-obsidian:create-checklist "Japan Trip Packing Checklist" packing "[[Japan 2025]]"
/para-obsidian:create-checklist "Production Deployment Checklist" deployment "[[Website Redesign]]"
/para-obsidian:create-checklist "Weekly Grocery List" shopping "[[Home Management]]"
```
