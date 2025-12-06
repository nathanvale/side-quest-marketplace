Create a daily journal note.

Daily notes capture thoughts, reflections, and daily tracking.

## Required Arguments
- `$DATE` - Date for the daily note (YYYY-MM-DD format, default: today)

## Optional Arguments
- `$DEST` - Destination folder (default: 05_Journal/Daily)

## Auto-filled Fields
- `created` - The specified date
- `title` - Formatted as "Daily - YYYY-MM-DD"
- `template_version` - 2
- `tags` - Always includes "daily" and "journal"

## Frontmatter Hints
- **Suggested tags**: daily, journal, reflection, gratitude

## Command
```bash
para-obsidian create --template daily \
  --title "Daily - ${DATE:-$(date +%Y-%m-%d)}" \
  --dest "${DEST:-05_Journal/Daily}"
```

## Example Usage

For today's daily note:

```
DATE: "2025-12-06"
```

The note will be created as "Daily - 2025-12-06.md" with sections for:
- Morning intentions
- Daily log
- Evening reflection
- Gratitude
