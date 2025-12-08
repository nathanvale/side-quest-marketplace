---
description: Create a new area of responsibility note
argument-hint: <title> [dest]
allowed-tools: Bash(para-obsidian:*)
---

## Variables

```bash
TITLE="$1"
DEST="${2:-02 Areas}"
```

## Command

```bash
bun src/cli.ts create --template area \
  --title "$TITLE" \
  --dest "$DEST" \
  --arg "Area title=$TITLE" \
  --content '{
    "Overview": "...",
    "Standards to Maintain": "- [ ] ...\n- [ ] ...",
    "Review Questions": "- Am I giving this area enough attention?\n- What projects should emerge?",
    "Notes": "..."
  }'
```

## Content Sections

| Section | Purpose |
|---------|---------|
| `Overview` | What does this area encompass? |
| `Standards to Maintain` | Ongoing commitments |
| `Review Questions` | Reflection prompts |
| `Notes` | Observations, ideas, improvements |

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
