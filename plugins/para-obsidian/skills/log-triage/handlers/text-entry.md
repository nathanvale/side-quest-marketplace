# Text Entry Handler

Process plain text log entries and short voice memos into clipping notes.

## Step 0 — Discover Template Metadata

Before creating notes, query the clipping template for its current structure:

```
para_template_fields({ template: "clipping", response_format: "json" })
```

Extract from response:
- `validArgs` → which args to pass to `para_create` (e.g., `source`, `clipped`)
- `creation_meta.dest` → destination folder
- `creation_meta.contentTargets` → section heading for content injection (e.g., `["Content"]`)

Use these discovered values instead of hardcoding them.

## Detection

**Pattern:** `- [time] - [text]` (no 🎤 or URL)
**Or:** `- [time] - 🎤 [short text]` (< 200 words)

## Entry Classification

### Reminder/Task Signals → Clipping with Task

Look for these patterns:
- "remind me to..."
- "don't forget..."
- "remember to..."
- "I need to..."
- "tomorrow I should..."
- "should probably..."
- "have to..."

Create clipping note with Obsidian Tasks checkbox.

### Thought/Idea → Clipping Note

General thoughts, ideas, observations without task signals.

Create clipping note with `source: thought`.

### Noise → Delete

Filler entries, incomplete thoughts, audio artifacts.

Just delete from daily note, don't create a note.

## Note Creation

**For reminders/tasks:**

```
para_create({
  template: "clipping",
  title: "Take out the trash",
  dest: "<discovered-dest>",
  args: {
    source: "reminder",
    clipped: "2026-01-06"
  },
  content: {
    "<discovered-content-target>": "- [ ] Take out the trash 🔔 2026-01-06 22:00"
  },
  response_format: "json"
})
```

**For thoughts/ideas:**

```
para_create({
  template: "clipping",
  title: "Tomorrow is a new day",
  dest: "<discovered-dest>",
  args: {
    source: "thought",
    clipped: "2026-01-06"
  },
  content: {
    "<discovered-content-target>": "Don't forget tomorrow is a new day."
  },
  response_format: "json"
})
```

**CRITICAL:** Use the content target heading discovered from `creation_meta.contentTargets[0]` in Step 0. Do not hardcode section names.

## Task Emoji Format (Obsidian Tasks)

| Emoji | Meaning |
|-------|---------|
| `📅` | Due date |
| `🔔` | Reminder/scheduled |
| `⏳` | Scheduled date |
| `🔁` | Recurring |

Example: `- [ ] Call dentist 📅 2026-01-10`

## Template Output

**Reminder:**
```markdown
---
type: clipping
source: reminder
clipped: 2026-01-06
template_version: 1
---

# Take out the trash

## Content

- [ ] Take out the trash 🔔 2026-01-06 22:00
```

**Thought:**
```markdown
---
type: clipping
source: thought
clipped: 2026-01-06
template_version: 1
---

# Tomorrow is a new day

## Content

Don't forget tomorrow is a new day.
```
