# Dataview Patterns for PARA

> Advanced Dataview queries for PARA-based task and project management

## Table of Contents
- [Core Concepts](#core-concepts)
- [Self-Referential Queries](#self-referential-queries)
- [Task Queries](#task-queries)
- [Project Queries](#project-queries)
- [Review Tracking](#review-tracking)
- [Dashboard Queries](#dashboard-queries)
- [Common Patterns](#common-patterns)
- [Troubleshooting](#troubleshooting)

---

## Core Concepts

### Query Types
| Type | Purpose | Level |
|------|---------|-------|
| `LIST` | Bullet list of pages | Page |
| `TABLE` | Tabular data | Page |
| `TASK` | Interactive task list | Task |
| `CALENDAR` | Date-based calendar view | Page |

### Key Difference: Page vs Task Level

**Page-level queries** (LIST, TABLE, CALENDAR):
```dataview
TABLE status, priority
FROM "07_Tasks"
WHERE status != "done"
```
Returns *files* matching criteria.

**Task-level queries** (TASK):
```dataview
TASK
FROM "07_Tasks"
WHERE !completed
```
Returns *individual tasks* from files, can be checked off interactively.

---

## Self-Referential Queries

### The `this.file.link` Pattern

**Problem**: Hardcoded names break when files are renamed.

```dataview
-- BAD: Breaks if "My Project" is renamed
WHERE contains(project, "[[My Project]]")
```

**Solution**: Use `this.file.link` for robust self-references.

```dataview
-- GOOD: Works even after rename
WHERE contains(project, this.file.link)
```

### In Project Notes

Show all tasks linked to this project:
```dataview
TASK
FROM "07_Tasks"
WHERE contains(project, this.file.link) AND !completed
SORT priority DESC
```

### In Area Notes

Show all tasks linked to this area:
```dataview
TASK
FROM "07_Tasks"
WHERE contains(area, this.file.link) AND !completed
GROUP BY file.link
```

Show all projects in this area:
```dataview
TABLE status, target_completion as "Due"
FROM "01_Projects"
WHERE contains(area, this.file.link) AND status = "active"
SORT target_completion ASC
```

---

## Task Queries

### All Open Tasks
```dataview
TASK
FROM "07_Tasks"
WHERE !completed
SORT priority DESC
```

### Tasks Due This Week
```dataview
TASK
FROM "07_Tasks"
WHERE due_date <= date(today) + dur(7 days)
  AND due_date >= date(today)
  AND !completed
SORT due_date ASC
```

### Overdue Tasks
```dataview
TASK
FROM "07_Tasks"
WHERE due_date < date(today) AND !completed
SORT due_date ASC
```

### Tasks by Priority
```dataview
TASK
FROM "07_Tasks"
WHERE !completed AND priority = "urgent"
GROUP BY file.link
```

### Tasks Grouped by Project
```dataview
TASK
FROM "07_Tasks"
WHERE !completed
GROUP BY project
SORT rows.priority DESC
```

### High Priority Tasks (Priority >= 42)

Using numeric priority for fine-grained control:
```dataview
TASK
FROM "07_Tasks"
WHERE !completed AND priority >= 42
SORT priority DESC
LIMIT 10
```

---

## Project Queries

### Active Projects Dashboard
```dataview
TABLE
  status,
  target_completion as "Due",
  area as "Area",
  length(filter(file.tasks, (t) => !t.completed)) AS "Open Tasks"
FROM "01_Projects"
WHERE status = "active"
SORT target_completion ASC
```

### Projects Needing Review

Show projects not reviewed in the last 7 days:
```dataview
TABLE
  status,
  reviewed as "Last Review",
  target_completion as "Due"
FROM "01_Projects"
WHERE status = "active"
  AND (reviewed < date(today) - dur(7 days) OR !reviewed)
SORT reviewed ASC
```

### Projects by Area
```dataview
LIST
FROM "01_Projects"
WHERE status = "active"
GROUP BY area
```

### Stalled Projects

Projects with no tasks or all tasks completed:
```dataview
TABLE status, target_completion
FROM "01_Projects"
WHERE status = "active"
  AND length(filter(file.tasks, (t) => !t.completed)) = 0
```

---

## Review Tracking

### The Review Pattern

Add these fields to frontmatter:
```yaml
reviewed: 2025-01-15      # Last review date
review_period: 7d         # How often to review (default: 7d)
```

### Projects Due for Review
```dataview
TABLE
  reviewed as "Last Review",
  (date(today) - reviewed).days + " days ago" as "Age"
FROM "01_Projects"
WHERE status = "active"
  AND (
    reviewed < (date(today) - dur(default(review_period, "7d")))
    OR !reviewed
  )
SORT reviewed ASC
```

### Tasks Due for Review
```dataview
TASK
FROM "07_Tasks"
WHERE !completed
  AND (reviewed < date(today) - dur(7 days) OR !reviewed)
GROUP BY file.link
```

### Weekly Review Dashboard

Notes modified in last 14 days that haven't been reviewed:
```dataview
TABLE file.mtime as "Modified"
FROM ""
WHERE file.mtime > (date(now) - dur(14 days))
  AND !reviewed
  AND file.folder != "templates"
SORT file.mtime DESC
```

---

## Dashboard Queries

### Master Dashboard

**Urgent Tasks**
```dataview
TASK
FROM "07_Tasks"
WHERE !completed AND priority = "urgent"
LIMIT 5
```

**Due This Week**
```dataview
TABLE project, due_date, priority
FROM "07_Tasks"
WHERE !completed
  AND due_date <= date(today) + dur(7 days)
SORT due_date ASC
LIMIT 10
```

**Projects Needing Attention**
```dataview
TABLE
  target_completion as "Due",
  (reviewed < date(today) - dur(7 days)) as "Needs Review"
FROM "01_Projects"
WHERE status = "active"
SORT target_completion ASC
LIMIT 5
```

**Inbox Count**
```dataview
LIST WITHOUT ID length(rows) + " items in inbox"
FROM "00_Inbox"
GROUP BY true
```

---

## Common Patterns

### Counting Items
```dataview
LIST WITHOUT ID length(rows) + " active projects"
FROM "01_Projects"
WHERE status = "active"
GROUP BY true
```

### Date Calculations
```dataview
TABLE
  target_completion as "Due",
  (target_completion - date(today)).days + " days left" as "Countdown"
FROM "01_Projects"
WHERE status = "active" AND target_completion
SORT target_completion ASC
```

### Filtering by Link Contains
```dataview
-- Check if frontmatter link contains a specific note
WHERE contains(project, [[Project Name]])

-- Self-referential (recommended)
WHERE contains(area, this.file.link)
```

### Default Values
```dataview
-- Use default() for missing fields
WHERE reviewed < (date(today) - dur(default(review_period, "7d")))
```

### Child Tasks

Child tasks (indented under parent) belong to parent:
```dataview
TASK
WHERE !completed
-- Will include completed children if parent is incomplete
```

To exclude specific children:
```dataview
TASK
WHERE !completed AND !contains(text, "optional")
```

---

## Troubleshooting

### Query Returns Nothing

1. **Check folder path**: `FROM "01_Projects"` - case sensitive!
2. **Check field names**: `status` vs `Status` matters
3. **Check field values**: `"active"` vs `active` (quotes matter for strings)

### Links Not Matching

**Problem**: `WHERE area = [[My Area]]` doesn't work

**Solution**: Use `contains()` for link fields:
```dataview
WHERE contains(area, [[My Area]])
-- or self-referential
WHERE contains(area, this.file.link)
```

### Tasks Not Appearing

1. **Check if using TASK query type** (not TABLE)
2. **Check if tasks are in the right folder**
3. **Check if `!completed` filter is correct**

### Slow Queries

1. **Add folder constraints**: `FROM "01_Projects"` instead of `FROM ""`
2. **Limit results**: `LIMIT 20`
3. **Enable lazy loading** in Dataview settings

---

*Reference compiled from Dataview documentation and community best practices.*
