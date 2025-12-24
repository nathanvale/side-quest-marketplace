# Obsidian Daily Note + Tasks Plugin Setup

Research and implementation plan for Nathan's ADHD-friendly daily note system.

---

## ✅ Getting Started (Your First Task)

Your daily note system is ready. Here's how to use it:

### Today: Add Your First Task

1. **Open an Area note** (e.g., `02 Areas/Command Center.md`)
2. **Find the Tasks section** (it's already there)
3. **Copy-paste this example**:

```markdown
- [ ] Review daily note setup  [due:: 2025-12-26]  [priority:: high]
```

4. **Open tomorrow's daily note** (2025-12-26)
5. **Look at the "Today" callout** - your task appears there! ✨

### That's It!

- Tasks auto-appear in your daily note on their due date
- Use `Cmd+Shift+T` for quick timestamps in the Log section
- The 4 task callouts show: Overdue, Today, Upcoming (7 days), Completed

### Next Steps

- [ ] Create a task in one of your Areas
- [ ] Try the timestamp hotkey: `Cmd+Shift+T` in the Log section
- [ ] Review the template structure below to understand how it works

---

## Overview

This document captures the research, decisions, and implementation details for integrating the Obsidian Tasks plugin with daily notes using the PARA method.

## Research Sources

### Key Articles & Posts

1. **Ryan Himmelwright** - [Started Using the Obsidian Tasks Plugin](https://ryan.himmelwright.net/post/started-using-obsidian-tasks-plugin/)
   - Callout-based task views (Overdue, Today, Done)
   - Global task filter using `#task` tag
   - Tasks live in project notes, daily note is a dashboard

2. **Dann Berg** - [My Obsidian Daily Note Template](https://dannb.org/blog/2022/obsidian-daily-note-template/)
   - Templater + Dataview setup
   - Cursor placement for immediate typing
   - Year/Month/Day folder structure

3. **Obsidian Forum** - [Displaying Overdue/To-Do/Done in Callouts](https://forum.obsidian.md/t/displaying-overdue-to-do-today-and-done-today-tasks-in-collapsible-callouts-containing-tasks-count-in-header-suitable-for-side-panel-in-obsidian/91804)
   - DataviewJS + Tasks plugin hybrid
   - Task counts in callout headers
   - CSS for compact display

4. **Ness Labs** - [Interstitial Journaling](https://nesslabs.com/interstitial-journaling)
   - Timestamp-based logging throughout the day
   - Combines notes, to-do, and time tracking
   - ADHD-friendly: captures context switches

5. **Forte Labs** - [Weekly Review Guide](https://fortelabs.com/blog/the-one-touch-guide-to-doing-a-weekly-review/)
   - Daily capture feeds weekly processing
   - "One touch" principle for inbox items

### Key Patterns from Community

- **Tasks live in project notes**, not daily notes
- **Daily note is a dashboard** that queries tasks
- **Collapsible callouts** reduce visual overwhelm
- **Interstitial journaling** suits ADHD better than structured sections
- **`group by filename`** shows which project each task belongs to

## Final Template Structure

```
Navigation (Yesterday · Week · Tomorrow)
─────────────────────────────────────────
Today's Focus (ONE thing)
─────────────────────────────────────────
Tasks
  ├─ [!danger] Overdue (collapsed)
  ├─ [!todo] Today (expanded)
  ├─ [!warning] Upcoming 7 days (collapsed)
  └─ [!success] Completed (collapsed)
─────────────────────────────────────────
Log (interstitial - use Cmd+Shift+T)
─────────────────────────────────────────
End of Day
  ├─ Gratitude (3 things)
  └─ Tomorrow (ONE thing)
─────────────────────────────────────────
Related Notes (Yesterday/Tomorrow/Week)
─────────────────────────────────────────
Dashboard
  ├─ Active Projects
  └─ Areas
```

## Quick Start: Adding Tasks (Dataview Format)

### The Simplest Way

1. Open any **Area** or **Project** note
2. Find the **Tasks** section
3. Type a task like this:

```markdown
- [ ] Call dentist  [due:: 2025-01-15]
```

That's it! The task will appear in your daily note on Jan 15.

### Key Rules

- **Start with** `- [ ]` (checkbox)
- **Add metadata** with `[field:: value]` (notice the `::`)
- **Use 2 spaces** between multiple fields
- **Date format** must be `YYYY-MM-DD` (2025-01-15, not Jan 15)

### Copy-Paste Examples

**Task with due date:**
```markdown
- [ ] Dentist appointment  [due:: 2025-01-20]
```

**Task with priority:**
```markdown
- [ ] Review PR  [priority:: high]
```

**Task scheduled for a future date (when you plan to start):**
```markdown
- [ ] Start API refactor  [scheduled:: 2025-01-15]
```

**Multiple fields (2 spaces between):**
```markdown
- [ ] Submit quarterly report  [due:: 2025-01-31]  [priority:: high]  [scheduled:: 2025-01-20]
```

**Recurring task (for areas):**
```markdown
- [ ] Weekly review  [repeat:: every Sunday]  [scheduled:: 2025-01-05]
```

### Where Tasks Show Up

When you create a task with `[due:: 2025-01-15]`, it automatically appears in your **Daily Note** on that date in the **"Today"** section.

---

## Creating Tasks (Dataview Format) - Full Reference

The Tasks plugin supports the **Dataview inline field format** for task metadata. This is cleaner than emoji-based syntax.

### Basic Task Syntax

```markdown
- [ ] Task description  [due:: 2024-01-15]  [priority:: high]
```

**Important**: Use **2 spaces** between fields to avoid Live Preview display issues.

### Supported Fields

| Field | Example | Notes |
|-------|---------|-------|
| **Due date** | `[due:: 2024-01-15]` | When task must be done |
| **Scheduled date** | `[scheduled:: 2024-01-15]` | When you plan to work on it |
| **Start date** | `[start:: 2024-01-15]` | When task becomes available |
| **Created date** | `[created:: 2024-01-15]` | When task was created |
| **Completion date** | `[completion:: 2024-01-15]` | Auto-set when done |
| **Priority** | `[priority:: high]` | lowest, low, medium, high, highest |
| **Recurrence** | `[repeat:: every day]` | Recurring tasks |
| **On completion** | `[onCompletion:: delete]` | keep or delete when done |

### Example Tasks

```markdown
# Simple task with due date
- [ ] Call dentist  [due:: 2024-01-20]

# Task with priority and scheduled date
- [ ] Review PR for API changes  [scheduled:: 2024-01-15]  [priority:: high]

# Recurring task
- [ ] Weekly review  [repeat:: every week on Sunday]  [scheduled:: 2024-01-14]

# Task with start date (won't show until that date)
- [ ] Prepare tax documents  [start:: 2024-03-01]  [due:: 2024-04-15]

# Full example with multiple fields
- [ ] Submit quarterly report  [created:: 2024-01-10]  [scheduled:: 2024-01-25]  [due:: 2024-01-31]  [priority:: high]
```

### Where to Create Tasks

Tasks should live in **project notes**, not daily notes. The daily note queries display them automatically.

```markdown
# In: 01 Projects/API Refactor.md

## Tasks

- [ ] Set up new endpoint structure  [due:: 2024-01-20]  [priority:: high]
- [ ] Write integration tests  [scheduled:: 2024-01-21]
- [ ] Update API documentation  [due:: 2024-01-25]
```

These tasks will appear in your daily note when their due/scheduled dates match.

### Auto-Suggest

The Tasks plugin has **auto-suggest** that works inside brackets:
1. Type `[` to start a field
2. Start typing the field name (e.g., `due`)
3. Select from suggestions

Enable `Settings > Editor > Autopair Brackets` for best experience.

### Quick Create Methods

1. **In project notes**: Just type the task with dataview fields
2. **Tasks plugin command**: `Tasks: Create or edit task` (brings up modal)
3. **Hotkey**: Assign a hotkey to the create task command

---

## Tasks Plugin Query Syntax

### Basic Filters

```tasks
not done
due today
scheduled on 2024-01-15
due before tomorrow
```

### Date Ranges

```tasks
(due after 2024-01-15) AND (due before 2024-01-22)
```

### Display Options

```tasks
short mode          # Compact display
hide tags           # Don't show task tags
hide task count     # Don't show count
group by filename   # Group by source note
group by due        # Group by due date
sort by priority    # Sort by priority
sort by due         # Sort by due date
```

### Example: Today's Tasks

```tasks
not done
(due on {{date:YYYY-MM-DD}}) OR (scheduled on {{date:YYYY-MM-DD}})
short mode
hide tags
group by filename
sort by priority
```

## Timestamp Automation

### Option 1: Templater Hotkey (Implemented)

Created `Templates/timestamp.md`:
```markdown
- <% tp.date.now("HH:mm") %> -
```

Setup:
1. Obsidian Settings → Templater → Template Hotkeys
2. Add `Templates/timestamp.md`
3. Assign `Cmd+Shift+T`

### Option 2: Natural Language Dates Plugin

Type `@now` or `@time` to insert current time.

### Option 3: QuickAdd Plugin

Create macro to insert timestamp at cursor or append to specific heading.

## Future Ideas

### Slash Command for Log Entry

Create a SideQuest skill `/daily:log` that:
1. Finds today's daily note
2. Appends timestamped entry to Log section
3. Works from CLI for quick capture

Implementation sketch:
```typescript
// Plugin skill: daily:log
// Usage: /daily:log "Starting API refactor"

async function addLogEntry(message: string) {
  const today = format(new Date(), 'yyyy-MM-dd');
  const dailyNotePath = `000 Timestamps/Daily Notes/${today}.md`;
  const timestamp = format(new Date(), 'HH:mm');
  const entry = `- ${timestamp} - ${message}`;

  // Append to Log section
  await appendToSection(dailyNotePath, '## Log', entry);
}
```

### CLI Tool for Programmatic Access

```bash
# Add log entry from terminal
sq daily log "Starting API refactor"

# Add task to today
sq daily task "Call dentist" --due today

# Quick capture to inbox
sq capture "Idea for new feature"
```

### Task Quick-Add Slash Command

`/daily:task` - Add a task with due date to a project note, automatically appears in daily note.

### Weekly Review Integration

`/weekly:process` - Skill to help process the week's daily notes:
- Extract unfinished tasks
- Summarize log entries
- Move actionable items to Inbox

### Voice Capture Integration

Integrate with SuperWhisper for voice-to-daily-note:
- Transcribe voice memo
- Auto-append to Log section with timestamp
- Tag with `#voice` for later review

## Design Decisions

### Removed from Template

| Section | Reason |
|---------|--------|
| Energy/Mood tracking | Too much friction daily |
| Morning Intentions | Merged into simpler "Today's Focus" |
| Separate Captures/Meetings/Progress/Blockers | Replaced with freeform Log |
| "What Could Be Improved" | Negative focus, cognitive overload |
| "Wins" section | Replaced with Gratitude (more ADHD-friendly) |

### Kept/Added

| Section | Reason |
|---------|--------|
| Related Notes (Yesterday/Tomorrow) | Easy navigation |
| Gratitude | Positive focus, less cognitive load than "wins" |
| Week link | Quick access to weekly review |
| 4 Task callouts | Comprehensive task visibility |
| Interstitial Log | ADHD-friendly freeform capture |

## Plugin Dependencies

- **Templater** - Template variables, cursor placement, hotkeys
- **Dataview** - Project/Area queries
- **Tasks** - Task queries with due dates, scheduling
- **Periodic Notes** (optional) - Auto-create daily notes

## Files Modified

- `Templates/daily.md` - Main daily note template (v3)
- `Templates/timestamp.md` - Timestamp insertion template (new)

## References

- [Obsidian Tasks Documentation](https://publish.obsidian.md/tasks/)
- [Templater Documentation](https://silentvoid13.github.io/Templater/)
- [Dataview Documentation](https://blacksmithgu.github.io/obsidian-dataview/)
- [PARA Method](https://fortelabs.com/blog/para/)
