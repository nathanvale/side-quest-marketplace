Create a new project note in the Obsidian vault.

## Required Arguments
- `$TITLE` - Project name (used for filename and title field)
- `$TARGET_DATE` - Target completion date (YYYY-MM-DD format)
- `$AREA` - Related area as wikilink, e.g. `[[Health]]` or `[[AI Practice]]`

## Optional Arguments
- `$DEST` - Destination folder (default: 01_Projects)
- `$TAGS` - Additional tags, comma-separated (e.g. "automation,cinema")

## Auto-filled Fields
- `created` - Today's date
- `start_date` - Today's date
- `template_version` - 2
- `tags` - Always includes "project"

## Frontmatter Hints
- **status**: active (default) | on-hold | completed | archived
- **priority**: Inferred from content if not specified
- **Suggested tags**: project, work, family, health, learning, finance, home, career

## Command
```bash
para-obsidian create --template project \
  --title "$TITLE" \
  --dest "${DEST:-01_Projects}" \
  --arg "Project title=$TITLE" \
  --arg "Target completion date (YYYY-MM-DD)=$TARGET_DATE" \
  --arg "Area=$AREA"
```

## Example Usage

For task: "Build a CLI tool to automate cinema bookings by end of December"

```
TITLE: "Cinema Booking Tool"
TARGET_DATE: "2025-12-31"
AREA: "[[AI Practice]]"
TAGS: "automation,cinema"
```

For goal: "Get my driver's license renewed before it expires"

```
TITLE: "Drivers License Renewal"
TARGET_DATE: "2025-02-28"
AREA: "[[Admin]]"
```
