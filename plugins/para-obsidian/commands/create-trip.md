---
description: Create a new trip project note in the Obsidian vault
argument-hint: <title> <start-date> <end-date> <area> [dest]
allowed-tools: Bash(para-obsidian:*)
---

## Variables

```bash
TITLE="$1"
START_DATE="$2"
END_DATE="$3"
AREA="$4"
DEST="${5:-01 Projects}"
```

## Command

```bash
bun src/cli.ts create --template trip \
  --title "$TITLE" \
  --dest "$DEST" \
  --arg "title=$TITLE" \
  --arg "start_date=$START_DATE" \
  --arg "target_completion=$END_DATE" \
  --arg "area=$AREA" \
  --arg "status=active" \
  --content '{
    "Why This Matters": "...",
    "Success Criteria": "- [ ] All bookings confirmed\n- [ ] Itinerary finalized\n- [ ] Packing complete",
    "Objectives": "- [ ] Plan daily activities\n- [ ] Book accommodation\n- [ ] Organize transport",
    "Next Actions": "- [ ] ...",
    "Notes": "..."
  }'
```

## Content Sections

| Section | Purpose |
|---------|---------|
| `Why This Matters` | Why this trip? What are you celebrating or exploring? |
| `Success Criteria` | How will you know trip planning is DONE? |
| `Objectives` | Key milestones (bookings, itinerary, logistics) |
| `Next Actions` | Immediate next steps |
| `Notes` | Trip ideas, research notes |

## Frontmatter Hints

- **status**: active (default) | on-hold | completed | archived
- **Trip Details table**: Manually fill in Duration, Travelers, Route after creation
- **Wikilinks**: Area wikilinks are automatically quoted (e.g., `area: "[[Travel]]"`)
- **Dataview queries**: Automatically show All Bookings, Daily Itinerary, Research & Reference

## What Makes Trip Different from Project

- **Trip-specific sections**: Trip Details table, All Bookings, Daily Itinerary, Research & Reference
- **Required tags**: Both `project` and `trip` (auto-included)
- **Child note types**: booking, itinerary, research (link via `project: "[[Trip Name]]"`)
- **Default location**: `01 Projects` (same as project)

## Examples

```
/para-obsidian:create-trip "2025 Tassie Holiday" 2025-12-26 2026-01-01 "[[Travel]]"
/para-obsidian:create-trip "Japan Cherry Blossom 2026" 2026-03-28 2026-04-12 "[[Travel]]"
/para-obsidian:create-trip "Weekend Getaway Daylesford" 2025-02-14 2025-02-16 "[[Romance]]"
```

## After Creation

1. **Fill Trip Details**: Update Duration, Travelers, Route in the table
2. **Create bookings**: `/para-obsidian:create-booking` with `project: "[[Trip Name]]"`
3. **Create itineraries**: `/para-obsidian:create-itinerary` for each day
4. **Add research**: `/para-obsidian:create-research` for activities, dining, hiking
