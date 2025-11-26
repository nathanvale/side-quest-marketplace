---
title: "<% tp.system.prompt("Task title") %>"
created: <% tp.date.now("YYYY-MM-DD") %>
type: task
task_type: <% tp.system.prompt("Task type (task/reminder/habit/chore)") %>
status: not-started
project: "[[<% tp.system.prompt("Project (optional)", "") %>]]"
area: "[[<% tp.system.prompt("Area (optional)", "") %>]]"
due_date: <% tp.system.prompt("Due date (YYYY-MM-DD)", "") %>
priority: <% tp.system.prompt("Priority (low/medium/high/urgent)", "medium") %>
effort: <% tp.system.prompt("Effort (small/medium/large)", "medium") %>
depends_on:
blocks:
dependency_type: mandatory
tags:
  - task
---

# <% tp.system.prompt("Task title") %>

> **Task** = Actionable item with a specific outcome

## Quick Info

| Field | Value |
|-------|-------|
| **Type** | <% tp.system.prompt("Task type (task/reminder/habit/chore)") %> |
| **Status** | Not Started |
| **Due Date** | <% tp.system.prompt("Due date (YYYY-MM-DD)", "") %> |
| **Priority** | <% tp.system.prompt("Priority (low/medium/high/urgent)", "medium") %> |
| **Effort** | <% tp.system.prompt("Effort (small/medium/large)", "medium") %> |
| **Project** | [[<% tp.system.prompt("Project (optional)", "") %>]] |
| **Area** | [[<% tp.system.prompt("Area (optional)", "") %>]] |

## Description

<!-- What is this task? What's the desired outcome? -->


## Success Criteria

<!-- How will you know this is DONE? -->

- [ ]
- [ ]

## Dependencies

| Field | Value |
|-------|-------|
| **Depends On** | [[Other Task]] |
| **Blocks** | [[Blocked Task]] |
| **Type** | Mandatory / Discretionary / External |

## Task Details

### For Tasks:
- **Effort**: S (1-2 hours) / M (half day) / L (full day+)
- **Next Action**: What's the very first physical action?

### For Reminders:
- **Alert Time**:
- **Recurrence**: One-time / Daily / Weekly / Monthly / Custom

### For Habits:
- **Frequency**: Daily / Weekly / Custom
- **Streak**: (auto-tracked)
- **Best Time**: Morning / Afternoon / Evening / Any

### For Chores:
- **Seasonal**: Spring / Summer / Fall / Winter / Year-round
- **Frequency**:
- **Approximate Duration**:

## Notes

<!-- Context, gotchas, resources needed -->


## Related

- **Project**: [[<% tp.system.prompt("Project (optional)", "") %>]]
- **Area**: [[<% tp.system.prompt("Area (optional)", "") %>]]
- **Linked Tasks**:

---

**Task Types**: task (project work), reminder (time-sensitive), habit (recurring), chore (maintenance)
**Status Options**: not-started, in-progress, blocked, done, cancelled
**Priority**: low, medium, high, urgent
