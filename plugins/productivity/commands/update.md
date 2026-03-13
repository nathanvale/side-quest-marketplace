---
description: Sync tasks and refresh memory from calendar, email, meeting notes, and project trackers
argument-hint: "[--deep]"
model: sonnet
disable-model-invocation: true
allowed-tools:
  - Read
  - Write
  - Glob
  - Grep
---

# Update Command

Keep your task list and memory current. Two modes:

- **Default:** Sync from calendar, email, meeting notes, and project trackers (if connected), triage stale items, decode tasks, fill memory gaps
- **`--deep`:** Everything in default, plus deep scan of chat, sent email, docs -- flag missed todos and suggest new memories

Reference the **connectors** skill for available MCP tool names. If a source is unavailable, skip it gracefully.

## Usage

```bash
/productivity:update
/productivity:update --deep
```

## Default Mode

### 1. Load Current State

Read `TASKS.md` and `memory/` directory. If they don't exist, suggest `/productivity:start` first.

### 2. Sync from Connected Sources

Check for available sources and sync each one. Reference the **connectors** skill for tool names. If a tool is unavailable, skip that source with a note.

**Calendar** (if available):
- Fetch events from the past 2 days + next 3 days
- Extract meeting titles, attendees, and notes
- Surface action items from meeting descriptions

**Email** (if available):
- Scan unread inbox messages
- Extract action items and commitments received
- Note senders for people cross-referencing

**Meeting notes** (if calendar + knowledge base available):

Create structured meeting notes from knowledge base transcriptions matched to calendar events. This follows the same sync pattern as Email -- pull data, extract action items, offer to add to TASKS.md.

1. **Get calendar events** -- Query the past 2 days of calendar events (reuse data from Calendar sync above). Filter out declined events and all-day events.

2. **Check for existing notes** -- Glob `docs/meetings/YYYY-MM-DD-*.md` for each date. Skip any event that already has a notes file (match by date + slug, or by checking the `transcription` frontmatter field for the same knowledge base page ID).

3. **Find transcriptions** -- Search the knowledge base for meeting transcriptions created on the same dates. Transcriptions are voice memos that get transcribed and summarized by the knowledge base tool, typically auto-titled with timestamps (e.g., `@Today 11:02 AM`). Reference the **connectors** skill for knowledge base tool names.

4. **Match transcriptions to events** -- Match by time alignment: extract the time from the transcription title and match to the calendar event whose start time is closest (within 15 minutes). Confirm by checking that the transcription content mentions keywords from the calendar event summary. Transcriptions that don't match any event are silently ignored.

5. **Create meeting notes** -- For each matched event, fetch the full transcription content from the knowledge base. Read the project's meeting template (typically `Templates/meeting.md`) and create `docs/meetings/YYYY-MM-DD-slug.md`. Fill frontmatter from calendar event data (attendees, meeting type, date) and content sections from the transcription (key discussion points, decisions, action items). Resolve attendee emails to full names using CLAUDE.md People section. Slug: lowercase kebab-case from event summary, strip common prefixes.

6. **Extract action items** -- Collect action items from all newly created meeting notes. These feed into the same "offer to add to TASKS.md" flow as Email and Project Tracker action items (presented in Step 9 report).

If calendar or knowledge base tools are unavailable, skip with a note.

**Project tracker** (if available -- Jira, Asana, Linear, GitHub Issues):
- Fetch tasks assigned to the user (open/in-progress)
- Compare against TASKS.md:

| External task | TASKS.md match? | Action |
|---------------|-----------------|--------|
| Found, not in TASKS.md | No match | Offer to add |
| Found, already in TASKS.md | Match by title (fuzzy) | Skip |
| In TASKS.md, not in external | No match | Flag as potentially stale |
| Completed externally | In active section | Offer to mark done |

Present diff and let user decide what to add/complete.

If no sources are available at all, note "No external sources connected -- skipping sync" and continue to Step 3.

### 3. Cross-Reference Attendees

If calendar data was fetched, cross-reference attendees against memory:
- Known people: note recent meetings in their context
- Unknown people: flag for memory gap filling in Step 6

### 4. Triage Stale Items

Review active tasks in TASKS.md and flag:
- Tasks with due dates in the past
- Tasks in active sections for 30+ days
- Tasks with no context (no person, no project)

Present each for triage: Mark done? Reschedule? Move to later?

### 5. Decode Tasks for Memory Gaps

For each task, attempt to decode all entities (people, projects, acronyms, tools, links):

```
Task: "Send PSR to Todd re: Phoenix blockers"

Decode:
- PSR -> Pipeline Status Report (in glossary)
- Todd -> Todd Martinez (in people/)
- Phoenix -> ? Not in memory
```

Track what's fully decoded vs. what has gaps.

### 6. Fill Gaps

Present unknown terms grouped:
```
I found terms in your tasks I don't have context for:

1. "Phoenix" (from: "Send PSR to Todd re: Phoenix blockers")
   -> What's Phoenix?

2. "Maya" (from: "sync with Maya on API design")
   -> Who is Maya?
```

Add answers to the appropriate memory files (people/, projects/, glossary.md).

### 7. Capture Enrichment

Tasks often contain richer context than memory. Extract and update:
- **Links** from tasks -- add to project/people files
- **Status changes** ("launch done") -- update project status, demote from CLAUDE.md
- **Relationships** ("Todd's sign-off on Maya's proposal") -- cross-reference people
- **Deadlines** -- add to project files

### 8. CLAUDE.md Health Check

Scan all CLAUDE.md files for token budget and scaffold markers.

**Token budget:**
- Count words in all CLAUDE.md files (`~/.claude/CLAUDE.md`, `./CLAUDE.md`, `.claude/CLAUDE.md`)
- Estimate tokens (words * 1.3)
- Compare against norms: global 1-3K, project 3-10K, local 500-2K

**Scaffold markers:**
- Grep all CLAUDE.md files for `<!-- scaffold:` comments
- Cross-reference against sync results from Steps 2-3:
  - If update synced from Jira and found assigned tasks -> flag "Jira pending" scaffold as actionable
  - If update synced personal Gmail -> flag "Gmail disconnected" scaffold as actionable
  - If no signal for a scaffold item, mark as "not yet actionable"
- Report count and any actionable items

Include in the report summary (Step 9).

### 9. Report

```
Update complete:
- Sources: calendar (12 events), email (5 unread), meetings (2 created, 1 skipped), Jira (8 tasks)
  Skipped: chat (not connected)
- Tasks: +3 from Jira, +2 from meeting notes, 1 completed, 2 triaged
- Memory: 2 gaps filled, 1 project enriched
- All tasks decoded
- CLAUDE.md: 3,311 tokens (22% of 15K budget), 4 scaffold items (1 actionable)
```

### 10. Suggest Deep Scan

If memory gaps remain or sources were skipped:
```
Some gaps remain. Run `/productivity:update --deep` for a comprehensive scan
of chat, sent email, and documents.
```

## Deep Mode (`--deep`)

Everything in Default Mode, plus a deep scan of recent activity.

### Extra Step: Scan Activity Sources

Gather data from all available MCP sources (reference the **connectors** skill):
- **Chat:** Search recent messages, read active channels and DMs
- **Sent email:** Search sent messages for commitments made
- **Documents:** List recently touched docs
- **Calendar:** Expand to full week scan (vs 2+3 day default)

### Extra Step: Flag Missed Todos

Compare activity against TASKS.md. Surface action items that aren't tracked:

```
## Possible Missing Tasks

From your activity, these look like todos you haven't captured:

1. From chat (Jan 18):
   "I'll send the updated mockups by Friday"
   -> Add to TASKS.md?

2. From meeting "Phoenix Standup" (Jan 17):
   You have a recurring meeting but no Phoenix tasks active
   -> Anything needed here?

3. From email (Jan 16):
   "I'll review the API spec this week"
   -> Add to TASKS.md?
```

Let user pick which to add.

### Extra Step: CLAUDE.md Deep Health

Everything from the default health check (Step 8), plus:

- **Show each scaffold marker** with surrounding context (2 lines above/below)
- **Interactive triage** for each: keep / update / delete
- **Scan for unmarked scaffold candidates** -- grep CLAUDE.md files for patterns like "pending", "TBD", "disconnected", "TODO", "not yet", "access needed" that aren't already marked as scaffold
- **Suggest new scaffold markers** for any matches found
- **Token trend** -- if a previous budget comment exists, compare current vs. previous and note direction

### Extra Step: Suggest New Memories

Surface new entities not in memory:

```
## New People (not in memory)
| Name | Frequency | Context |
|------|-----------|---------|
| Maya Rodriguez | 12 mentions | design, UI reviews |
| Alex K | 8 mentions | DMs about API |

## New Projects/Topics
| Name | Frequency | Context |
|------|-----------|---------|
| Starlight | 15 mentions | planning docs, product |

## Suggested Cleanup
- **Horizon project** -- No mentions in 30 days. Mark completed?
```

Present grouped by confidence. High-confidence items offered to add directly; low-confidence items asked about.

## Notes

- Never auto-add tasks or memories without user confirmation
- External source links are preserved when available
- Fuzzy matching on task titles handles minor wording differences
- Safe to run frequently -- only updates when there's new info
- `--deep` always runs interactively
- If a source tool is unavailable, skip it -- never fail the entire sync
