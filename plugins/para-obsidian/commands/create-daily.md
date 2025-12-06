---
description: Create a daily journal note
argument-hint: [date] [dest]
allowed-tools: Bash(para-obsidian:*)
---

## Variables

```bash
DATE="${1:-$(date +%Y-%m-%d)}"
DEST="${2:-Daily Notes}"
```

## Command

```bash
bun src/cli.ts create --template daily \
  --title "Daily - $DATE" \
  --dest "$DEST" \
  --content '{
    "Today'\''s Focus": "> ...",
    "Top 3 Priorities": "1. [ ] ...\n2. [ ] ...\n3. [ ] ...",
    "Captures": "- ...",
    "Progress Made": "- ...",
    "What Went Well?": "1. ...\n2. ...\n3. ...",
    "Gratitude": "1. ...\n2. ...\n3. ...",
    "Tomorrow'\''s Setup": "- [ ] Most important task: ..."
  }'
```

## Content Sections

| Section | Purpose |
|---------|---------|
| `Today's Focus` | ONE thing that would make today a success |
| `Top 3 Priorities` | Main tasks for the day |
| `Captures` | Quick thoughts, ideas throughout the day |
| `Progress Made` | What did you accomplish? |
| `What Went Well?` | Celebrate wins |
| `Gratitude` | Three things you're grateful for |
| `Tomorrow's Setup` | Set yourself up for success |

## Frontmatter Hints

- **Suggested tags**: daily, journal, reflection, gratitude

## Examples

```
/para-obsidian:create-daily
/para-obsidian:create-daily 2025-12-06
/para-obsidian:create-daily 2025-12-06 "05_Journal/Daily"
```
