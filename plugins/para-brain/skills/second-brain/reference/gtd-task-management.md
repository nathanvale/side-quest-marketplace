# GTD + PARA Task Management

> Combining Getting Things Done with PARA for effective task management in Obsidian

## Table of Contents
- [The GTD + PARA Integration](#the-gtd--para-integration)
- [Task Properties](#task-properties)
- [The Review System](#the-review-system)
- [Daily Workflow](#daily-workflow)
- [Weekly Review](#weekly-review)
- [Task File vs Inline Tasks](#task-file-vs-inline-tasks)
- [Priority Systems](#priority-systems)
- [Frontmatter Schema](#frontmatter-schema)

---

## The GTD + PARA Integration

### Where GTD Concepts Live in PARA

| GTD Concept | PARA Location | Implementation |
|-------------|---------------|----------------|
| Next Actions | Within Projects | Tasks with `status: not-started` |
| Waiting For | Within Projects | Tasks with `status: blocked` |
| Someday/Maybe | Resources or Areas | Tasks with `priority: low` |
| Reference | Resources | Notes without tasks |
| Projects | Projects | Folders in `01_Projects/` |
| Calendar | Tasks | `due_date` and `start_date` fields |

### The Key Insight

> "Tasks should live in a global folder with frontmatter links to projects and areas. Dataview queries then show them in context."

**Why?**
- Single source of truth for all tasks
- Queryable from anywhere (dashboards, projects, areas)
- No duplicate task management
- Works with Obsidian's lack of a "move file" API

---

## Task Properties

### Essential Fields

```yaml
---
title: "Task Name"
created: 2025-01-15
type: task
status: not-started
project: "[[Project Name]]"
area: "[[Area Name]]"
due_date: 2025-01-20
priority: medium
---
```

### Status Values

| Status | Meaning | Query Filter |
|--------|---------|--------------|
| `not-started` | Ready to work on | `status = "not-started"` |
| `in-progress` | Currently working | `status = "in-progress"` |
| `blocked` | Waiting on something | `status = "blocked"` |
| `done` | Completed | `status = "done"` |
| `cancelled` | No longer needed | `status = "cancelled"` |

### Priority Values

| Priority | Use Case | Urgency |
|----------|----------|---------|
| `urgent` | Drop everything | Today |
| `high` | Important, time-sensitive | This week |
| `medium` | Normal priority | When possible |
| `low` | Someday/maybe | No rush |

### Optional Enhancement: Numeric Priority

For fine-grained sorting, use numeric priority:
- `priority: 42` = Urgent (threshold for "drop everything")
- `priority: 30` = High
- `priority: 20` = Medium
- `priority: 10` = Low

Query for urgent tasks:
```dataview
TASK WHERE priority >= 42 AND !completed
```

---

## The Review System

### Why Review Tracking Matters

Without tracking, you can't answer:
- When did I last look at this project?
- Is this task still relevant?
- Have I forgotten about something important?

### Review Fields

```yaml
reviewed: 2025-01-15        # Last review date
review_period: 7d           # Custom review frequency
```

### Review Cadence

| Item Type | Default Period | Override Example |
|-----------|----------------|------------------|
| Active Project | 7 days | `review_period: 3d` for urgent |
| Area | 14 days | `review_period: 30d` for stable |
| Task (in progress) | 3 days | - |
| Task (not started) | 7 days | - |

### What Happens During Review

**Project Review:**
1. Is this project still relevant?
2. Has anything changed since last review?
3. Are all tasks still accurate?
4. What's the next action?
5. Mark as reviewed: `reviewed: 2025-01-15`

**Task Review:**
1. Is this task still needed?
2. Is the due date still accurate?
3. Is the priority correct?
4. Am I blocked on anything?
5. Mark as reviewed or reschedule

---

## Daily Workflow

### Morning: Plan the Day

1. **Check urgent tasks**
   ```dataview
   TASK FROM "07_Tasks"
   WHERE priority = "urgent" AND !completed
   ```

2. **Check due today**
   ```dataview
   TASK FROM "07_Tasks"
   WHERE due_date = date(today) AND !completed
   ```

3. **Pick top 3** from remaining tasks

### During Day: Capture and Execute

1. **Quick capture** → Inbox (process later)
2. **Work from task list** → Update status as you go
3. **New tasks** → Create in `07_Tasks/` with project/area link

### Evening: Close Out

1. **Update task statuses** (in-progress → done, blocked notes)
2. **Quick inbox scan** (anything urgent for tomorrow?)
3. **Review tomorrow's calendar**

---

## Weekly Review

### The Weekly Review Checklist

Based on GTD's weekly review, adapted for PARA:

**1. Get Clear (Process Inbox)**
```dataview
LIST FROM "00_Inbox"
```
- Process each item → Project, Area, Resource, or Archive

**2. Get Current (Review Projects)**
```dataview
TABLE target_completion, reviewed
FROM "01_Projects"
WHERE status = "active"
  AND (reviewed < date(today) - dur(7d) OR !reviewed)
```
- Is this still active?
- Update tasks
- Mark reviewed

**3. Get Creative (Review Areas)**
```dataview
LIST FROM "02_Areas"
WHERE status = "active"
```
- Any new projects needed?
- Standards being maintained?

**4. Get Ready (Plan Next Week)**
- Review calendar
- Set priorities for top tasks
- Block time for important projects

---

## Task File vs Inline Tasks

### When to Use Task Files (`07_Tasks/`)

Use separate task files when:
- Task needs due date, priority, or other metadata
- Task should appear in Dataview queries
- Task has subtasks or notes
- Task should be linked to multiple projects/areas

**Example:**
```
07_Tasks/Book Tasmania Flights.md
```

### When to Use Inline Tasks

Use checkboxes in project/area notes when:
- Quick capture during project work
- Simple next actions
- No metadata needed
- Won't need to query separately

**Example in project note:**
```markdown
## Next Actions
- [ ] Email venue for quote
- [ ] Review contract draft
- [ ] Schedule team meeting
```

### Best Practice: Start Inline, Promote to File

1. Capture quickly as inline checkbox
2. If it needs metadata → create task file
3. If it's blocked or complex → create task file

---

## Priority Systems

### Simple (Recommended for Start)

```yaml
priority: low | medium | high | urgent
```

### Eisenhower Matrix

| | Urgent | Not Urgent |
|--|--------|------------|
| **Important** | Do First (`urgent`) | Schedule (`high`) |
| **Not Important** | Delegate (`medium`) | Eliminate (`low`) |

### Numeric (Advanced)

For fine-grained control:
```yaml
priority: 42    # 1-100 scale, higher = more urgent
```

Benefits:
- Sort by exact priority
- Threshold queries (`WHERE priority >= 42`)
- Gradual priority increase

---

## Frontmatter Schema

### Task Schema

```yaml
---
title: "Task Title"
created: 2025-01-15
type: task
task_type: task          # task, reminder, habit, chore
status: not-started      # not-started, in-progress, blocked, done, cancelled
project: "[[Project]]"   # Link to project (optional)
area: "[[Area]]"         # Link to area (optional)
due_date: 2025-01-20     # When it's due (optional)
start_date: 2025-01-18   # When to start (optional)
priority: medium         # low, medium, high, urgent
effort: medium           # small, medium, large
reviewed: 2025-01-15     # Last review date
depends_on: "[[Other Task]]"  # Blocking task
tags:
  - task
---
```

### Project Schema

```yaml
---
title: "Project Title"
created: 2025-01-15
type: project
status: active           # active, on-hold, completed, archived
start_date: 2025-01-15
target_completion: 2025-03-01
completion_date:         # Filled when done
area: "[[Parent Area]]"
reviewed: 2025-01-15
review_period: 7d        # Custom review frequency
tags:
  - project
---
```

### Area Schema

```yaml
---
title: "Area Title"
created: 2025-01-15
type: area
status: active
reviewed: 2025-01-15
review_period: 14d
tags:
  - area
---
```

### Resource Schema

```yaml
---
title: "Resource Title"
created: 2025-01-15
type: resource
source: book             # book, article, video, course, podcast, paper, web
source_url: ""           # Optional URL
author: ""               # Optional author
areas:                   # Required - links to one or more areas
  - "[[Primary Area]]"
  - "[[Secondary Area]]" # Optional additional areas
reviewed: 2025-01-15     # Last review date
tags:
  - resource
---
```

**Why `areas:` is an array:**
- Resources are reference material that can serve multiple areas
- A TypeScript book relates to both "Software Development" and "Learning"
- Unlike projects/tasks which belong to ONE area, resources cross-cut

**Querying resources by area:**
```dataview
TABLE source, author
FROM "03_Resources"
WHERE contains(areas, [[Health]])
```

---

## Quick Reference

### Daily Queries

**What's due today?**
```dataview
TASK FROM "07_Tasks" WHERE due_date = date(today) AND !completed
```

**What's urgent?**
```dataview
TASK FROM "07_Tasks" WHERE priority = "urgent" AND !completed
```

**What am I working on?**
```dataview
TASK FROM "07_Tasks" WHERE status = "in-progress"
```

### Weekly Queries

**Projects needing review?**
```dataview
TABLE reviewed FROM "01_Projects"
WHERE status = "active" AND (reviewed < date(today) - dur(7d) OR !reviewed)
```

**Overdue tasks?**
```dataview
TASK FROM "07_Tasks" WHERE due_date < date(today) AND !completed
```

**Blocked tasks?**
```dataview
TASK FROM "07_Tasks" WHERE status = "blocked"
```

---

*Reference compiled from GTD methodology, PARA system, and Obsidian community patterns.*
