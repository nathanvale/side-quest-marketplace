---
description: Create an itinerary note for trip planning
argument-hint: <title> <project> <trip-date> <day-number> [energy-level] [dest]
allowed-tools: Bash(para-obsidian:*)
---

## Variables

```bash
TITLE="$1"
PROJECT="$2"
TRIP_DATE="$3"
DAY_NUMBER="$4"
ENERGY_LEVEL="${5:-medium}"
DEST="${6:-00_Inbox}"
```

**energy_level options**: high | medium | low (helps plan activity intensity)

## Command

```bash
para-obsidian create --template itinerary \
  --title "$TITLE" \
  --dest "$DEST" \
  --arg "Itinerary title=$TITLE" \
  --arg "Project=$PROJECT" \
  --arg "Trip date (YYYY-MM-DD)=$TRIP_DATE" \
  --arg "Day number=$DAY_NUMBER" \
  --arg "Energy level=$ENERGY_LEVEL"
```

## Frontmatter Hints

- **Suggested tags**: itinerary, travel, planning

## Examples

```
/para-obsidian:create-itinerary "Tokyo Day 1 - Arrival & Shibuya" "[[Japan 2025]]" 2025-03-15 1 low
/para-obsidian:create-itinerary "Kyoto Day 4 - Temple Circuit" "[[Japan 2025]]" 2025-03-18 4 high
/para-obsidian:create-itinerary "Melbourne Day 2 - Great Ocean Road" "[[Road Trip]]" 2025-04-10 2
```
