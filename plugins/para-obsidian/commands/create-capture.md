---
description: Capture content to the inbox for later processing
argument-hint: <title> <content> <captured-from> [resonance] [urgency] [dest]
allowed-tools: Bash(para-obsidian:*)
---

## Variables

```bash
TITLE="$1"
CONTENT="$2"
CAPTURED_FROM="$3"
RESONANCE="${4:-useful}"
URGENCY="${5:-medium}"
DEST="${6:-00_Inbox}"
```

**captured_from options**: thought | conversation | article | book | video | podcast | email | meeting | voice
**resonance options**: inspiring | useful | personal | surprising
**urgency options**: high | medium | low

## Command

```bash
para-obsidian create --template capture \
  --title "$TITLE" \
  --dest "$DEST" \
  --arg "Title=$TITLE" \
  --arg "Captured from (thought/article/conversation/etc.)=$CAPTURED_FROM" \
  --arg "Resonance (inspiring/useful/personal/surprising)=$RESONANCE" \
  --arg "Urgency (high/medium/low)=$URGENCY" \
  --arg "Content=$CONTENT"
```

## Frontmatter Hints

- **Suggested tags**: inbox, capture, work, family, health, learning, finance

## Examples

```
/para-obsidian:create-capture "Playwright vs Puppeteer" "Consider switching to Playwright for web scraping" voice
/para-obsidian:create-capture "ADHD Time Boxing" "Use 25-minute blocks with 5-minute breaks" article useful medium
```
