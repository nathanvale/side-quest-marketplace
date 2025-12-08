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
DEST="${4:-01 Projects}"
```

## Command

```bash
bun src/cli.ts create --template project \
  --title "$TITLE" \
  --dest "$DEST" \
  --arg "Project title=$TITLE" \
  --arg "Target completion date (YYYY-MM-DD)=$TARGET_DATE" \
  --arg "Area=$AREA" \
  --content '{
    "Why This Matters": "...",
    "Success Criteria": "- [ ] ...\n- [ ] ...",
    "Next Actions": "- [ ] ...",
    "Key Resources": "- ...",
    "Notes": "..."
  }'
```

## Content Sections

| Section | Purpose |
|---------|---------|
| `Why This Matters` | What problem does this solve? Why now? |
| `Success Criteria` | How will you know this is DONE? |
| `Next Actions` | Immediate next steps |
| `Key Resources` | Links, docs, references |
| `Notes` | Context, ideas, learnings |

## Frontmatter Hints

- **status**: active (default) | on-hold | completed | archived
- **Suggested tags**: project, work, family, health, learning, finance, home, career
- **Wikilinks**: Area wikilinks are automatically quoted in YAML frontmatter for Dataview compatibility (e.g., `area: "[[AI Practice]]"`)

## Examples

```
/para-obsidian:create-project "Cinema Booking Tool" 2025-12-31 "[[AI Practice]]"
/para-obsidian:create-project "Drivers License Renewal" 2025-02-28 "[[Admin]]"
```
