---
description: Create a daily journal note
argument-hint: [date] [dest]
allowed-tools: Bash(para-obsidian:*)
---

## Variables

```bash
DATE="${1:-$(date +%Y-%m-%d)}"
DEST="${2:-05_Journal/Daily}"
```

## Command

```bash
para-obsidian create --template daily \
  --title "Daily - $DATE" \
  --dest "$DEST"
```

## Frontmatter Hints

- **Suggested tags**: daily, journal, reflection, gratitude

## Notes

The note will be created with sections for:
- Morning intentions
- Daily log
- Evening reflection
- Gratitude

## Examples

```
/para-obsidian:create-daily
/para-obsidian:create-daily 2025-12-06
/para-obsidian:create-daily 2025-12-06 "05_Journal/Daily"
```
