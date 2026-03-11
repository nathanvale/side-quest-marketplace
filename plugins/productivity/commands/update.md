---
description: Sync tasks and refresh memory from calendar, email, and project trackers
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

- **Default:** Sync from calendar, email, and project trackers (if connected), triage stale items, decode tasks, fill memory gaps
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

### 8. Report

```
Update complete:
- Sources: calendar (12 events), email (5 unread), Jira (8 tasks)
  Skipped: chat (not connected)
- Tasks: +3 from Jira, 1 completed, 2 triaged
- Memory: 2 gaps filled, 1 project enriched
- All tasks decoded
```

### 9. Suggest Deep Scan

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
