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
bun src/cli.ts create --template checklist \
  --title "$TITLE" \
  --dest "$DEST" \
  --arg "Checklist title=$TITLE" \
  --arg "Checklist type (packing/groceries/snacks/tasks)=$CHECKLIST_TYPE" \
  --arg "Project=$PROJECT" \
  --content '{
    "Category 1": "- [ ] ...\n- [ ] ...\n- [ ] ...",
    "Category 2": "- [ ] ...\n- [ ] ...\n- [ ] ...",
    "Category 3": "- [ ] ...\n- [ ] ...\n- [ ] ...",
    "Notes": "...",
    "Timeline": "| When | Action |\n|------|--------|\n| 2 weeks before | ... |\n| 1 week before | ... |"
  }'
```

## Content Sections

| Section | Purpose |
|---------|---------|
| `Category 1/2/3` | Grouped checklist items |
| `Notes` | Special considerations, reminders |
| `Timeline` | When to do what |

## Frontmatter Hints

- **status**: draft | active | completed
- **Suggested tags**: checklist, process, recurring

## Examples

```
/para-obsidian:create-checklist "Japan Trip Packing" packing "[[Japan 2025]]"
/para-obsidian:create-checklist "Production Deployment" deployment "[[Website Redesign]]"
/para-obsidian:create-checklist "Weekly Grocery List" shopping "[[Home Management]]"
```
