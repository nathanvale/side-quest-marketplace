---
description: Create a research note for investigation and analysis
argument-hint: <title> <research-type> <project> [status] [dest]
allowed-tools: Bash(para-obsidian:*)
---

## Variables

```bash
TITLE="$1"
RESEARCH_TYPE="$2"
PROJECT="$3"
STATUS="${4:-in-progress}"
DEST="${5:-00_Inbox}"
```

**research_type options**: comparison | investigation | decision | exploration
**status options**: in-progress | completed | abandoned

## Command

```bash
bun src/cli.ts create --template research \
  --title "$TITLE" \
  --dest "$DEST" \
  --arg "Research title=$TITLE" \
  --arg "Research type (activities/dining/hike/gear/transport)=$RESEARCH_TYPE" \
  --arg "Project=$PROJECT" \
  --content '{
    "Overview": "...",
    "Option 1": "**Name**: ...\n**Why**: ...\n**Cost**: ...\n**Book**: ...",
    "Option 2": "**Name**: ...\n**Why**: ...\n**Cost**: ...\n**Book**: ...",
    "Details": "...",
    "Timing": "- **Hours**: ...\n- **Duration**: ...\n- **Best time**: ...",
    "Getting There": "...",
    "Sources": "- ...",
    "Decision": "**Chosen**: ...\n**Booked**: [[]]"
  }'
```

## Content Sections

| Section | Purpose |
|---------|---------|
| `Overview` | What is this research about? |
| `Option 1/2` | Recommendations with cost/booking |
| `Details` | Main research content |
| `Timing` | Hours, duration, best time |
| `Getting There` | Directions, parking, transport |
| `Sources` | Where did info come from? |
| `Decision` | What did you decide? |

## Frontmatter Hints

- **Suggested tags**: research, analysis, decision
- **Wikilinks**: Project wikilinks are automatically quoted in YAML frontmatter for Dataview compatibility (e.g., `project: "[[Website Redesign]]"`)

## Examples

```
/para-obsidian:create-research "Jest vs Vitest" comparison "[[Website Redesign]]"
/para-obsidian:create-research "Cloud Provider Selection" decision "[[Infrastructure]]" in-progress
/para-obsidian:create-research "WebAuthn Deep Dive" exploration "[[Auth Upgrade]]"
```
