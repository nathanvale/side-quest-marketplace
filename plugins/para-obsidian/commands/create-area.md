---
description: Create a new area of responsibility note
argument-hint: <title> [dest]
allowed-tools: Bash(para-obsidian:*)
---

## Variables

```bash
TITLE="$1"
DEST="${2:-02_Areas}"
```

## Command

```bash
para-obsidian create --template area \
  --title "$TITLE" \
  --dest "$DEST"
```

## Frontmatter Hints

- **status**: active (only valid value for areas)
- **Suggested tags**: area, work, family, health, learning, finance, home, career

## Notes

Areas are never "done" - they represent ongoing standards you maintain:
- Health, Fitness, Mental Wellbeing
- Family, Relationships, Parenting
- Career, Professional Development
- Finance, Home, Admin

## Examples

```
/para-obsidian:create-area "Health"
/para-obsidian:create-area "Finance"
/para-obsidian:create-area "Career" "02_Areas/Work"
```
