Create an itinerary note for trip planning.

Itineraries organize daily activities for travel or events.

## Required Arguments
- `$TITLE` - Itinerary day title (e.g. "Tokyo Day 1 - Arrival")
- `$PROJECT` - Related trip project as wikilink
- `$TRIP_DATE` - Date of this itinerary day (YYYY-MM-DD)
- `$DAY_NUMBER` - Day number in the trip (e.g. "1", "2")

## Optional Arguments
- `$ENERGY_LEVEL` - Expected energy: high | medium | low (default: medium)
- `$DEST` - Destination folder (default: 00_Inbox)

## Auto-filled Fields
- `created` - Today's date
- `template_version` - 2
- `tags` - Always includes "itinerary"

## Frontmatter Hints
- **energy_level**: high | medium | low (helps plan activity intensity)
- **Suggested tags**: itinerary, travel, planning

## Command
```bash
para-obsidian create --template itinerary \
  --title "$TITLE" \
  --dest "${DEST:-00_Inbox}" \
  --arg "Itinerary title=$TITLE" \
  --arg "Project=$PROJECT" \
  --arg "Trip date (YYYY-MM-DD)=$TRIP_DATE" \
  --arg "Day number=$DAY_NUMBER" \
  --arg "Energy level=${ENERGY_LEVEL:-medium}"
```

## Example Usage

For arrival day: "Tokyo trip day 1"

```
TITLE: "Tokyo Day 1 - Arrival & Shibuya"
PROJECT: "[[Japan 2025]]"
TRIP_DATE: "2025-03-15"
DAY_NUMBER: "1"
ENERGY_LEVEL: "low"  # Jet lag expected
```

For active day: "Kyoto temples tour"

```
TITLE: "Kyoto Day 4 - Temple Circuit"
PROJECT: "[[Japan 2025]]"
TRIP_DATE: "2025-03-18"
DAY_NUMBER: "4"
ENERGY_LEVEL: "high"
```
