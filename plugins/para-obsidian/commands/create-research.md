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
para-obsidian create --template research \
  --title "$TITLE" \
  --dest "$DEST" \
  --arg "Research title=$TITLE" \
  --arg "Research type=$RESEARCH_TYPE" \
  --arg "Project=$PROJECT" \
  --arg "Status=$STATUS"
```

## Frontmatter Hints

- **Suggested tags**: research, analysis, decision

## Examples

```
/para-obsidian:create-research "Jest vs Vitest vs Bun Test Comparison" comparison "[[Website Redesign]]"
/para-obsidian:create-research "Cloud Provider Selection" decision "[[Infrastructure Migration]]" in-progress
/para-obsidian:create-research "WebAuthn and Passkeys Deep Dive" exploration "[[Auth System Upgrade]]"
```
