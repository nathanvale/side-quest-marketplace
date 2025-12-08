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
bun src/cli.ts create --template itinerary \
  --title "$TITLE" \
  --dest "$DEST" \
  --arg "Day title=$TITLE" \
  --arg "Project=$PROJECT" \
  --arg "Trip date (YYYY-MM-DD)=$TRIP_DATE" \
  --arg "Day number=$DAY_NUMBER" \
  --arg "Energy level=$ENERGY_LEVEL" \
  --content '{
    "Overview": "| Field | Value |\n|-------|-------|\n| **Location** | ... |\n| **Accommodation** | ... |",
    "Morning": "- [ ] ...",
    "Afternoon": "- [ ] ...",
    "Evening": "- [ ] ...",
    "Meals": "| Meal | Plan | Booked? |\n|------|------|---------|",
    "Transport": "...",
    "What to Bring": "- [ ] ...",
    "Important Notes": "..."
  }'
```

## Content Sections

| Section | Purpose |
|---------|---------|
| `Overview` | Location, accommodation |
| `Morning/Afternoon/Evening` | Activities by time |
| `Meals` | Breakfast, lunch, dinner plans |
| `Transport` | Driving times, transfers |
| `What to Bring` | Day-specific items |
| `Important Notes` | Weather, reservations, timing |

## Frontmatter Hints

- **Suggested tags**: itinerary, travel, planning
- **Wikilinks**: Project wikilinks are automatically quoted in YAML frontmatter for Dataview compatibility (e.g., `project: "[[Japan 2025]]"`)

## Examples

```
/para-obsidian:create-itinerary "Tokyo Day 1 - Arrival" "[[Japan 2025]]" 2025-03-15 1 low
/para-obsidian:create-itinerary "Kyoto Day 4 - Temples" "[[Japan 2025]]" 2025-03-18 4 high
/para-obsidian:create-itinerary "Great Ocean Road" "[[Road Trip]]" 2025-04-10 2
```
