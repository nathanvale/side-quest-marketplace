Create a new area of responsibility note.

Areas represent ongoing standards you maintain throughout life - they have no end date.

## Required Arguments
- `$TITLE` - Area name (used for filename and title field)

## Optional Arguments
- `$DEST` - Destination folder (default: 02_Areas)

## Auto-filled Fields
- `created` - Today's date
- `status` - active
- `template_version` - 2
- `tags` - Always includes "area"

## Frontmatter Hints
- **status**: active (only valid value for areas)
- **Suggested tags**: area, work, family, health, learning, finance, home, career

## Command
```bash
para-obsidian create --template area \
  --title "$TITLE" \
  --dest "${DEST:-02_Areas}"
```

## Example Usage

For responsibility: "Managing my physical health and fitness"

```
TITLE: "Health"
```

For responsibility: "Personal financial management"

```
TITLE: "Finance"
```

## Notes
Areas are never "done" - they represent ongoing standards you maintain. Examples:
- Health, Fitness, Mental Wellbeing
- Family, Relationships, Parenting
- Career, Professional Development
- Finance, Home, Admin
