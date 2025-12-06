Create a reusable checklist note.

Checklists are templates for recurring processes or procedures.

## Required Arguments
- `$TITLE` - Checklist name
- `$CHECKLIST_TYPE` - Type of checklist (e.g. "packing", "deployment", "review")
- `$PROJECT` - Related project as wikilink

## Optional Arguments
- `$DEST` - Destination folder (default: 00_Inbox)

## Auto-filled Fields
- `created` - Today's date
- `status` - draft
- `template_version` - 2
- `tags` - Always includes "checklist"

## Frontmatter Hints
- **checklist_type**: packing, deployment, review, shopping, travel, maintenance
- **status**: draft | active | completed
- **Suggested tags**: checklist, process, recurring

## Command
```bash
para-obsidian create --template checklist \
  --title "$TITLE" \
  --dest "${DEST:-00_Inbox}" \
  --arg "Checklist title=$TITLE" \
  --arg "Checklist type=$CHECKLIST_TYPE" \
  --arg "Project=$PROJECT"
```

## Example Usage

For travel checklist: "Japan Trip Packing"

```
TITLE: "Japan Trip Packing Checklist"
CHECKLIST_TYPE: "packing"
PROJECT: "[[Japan 2025]]"
```

For deployment process: "Production Deploy Steps"

```
TITLE: "Production Deployment Checklist"
CHECKLIST_TYPE: "deployment"
PROJECT: "[[Website Redesign]]"
```
