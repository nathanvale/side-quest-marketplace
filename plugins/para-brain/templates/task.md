---
title: "<% tp.system.prompt("Task title") %>"
created: <% tp.date.now("YYYY-MM-DD") %>
type: task
task_type: <% tp.system.prompt("Task type (task/reminder/habit/chore)", "task") %>
status: not-started
project: "[[<% tp.system.prompt("Project (optional)", "") %>]]"
area: "[[<% tp.system.prompt("Area (optional)", "") %>]]"
start_date: <% tp.system.prompt("Start date (YYYY-MM-DD)", "") %>
due_date: <% tp.system.prompt("Due date (YYYY-MM-DD)", "") %>
priority: <% tp.system.prompt("Priority (low/medium/high/urgent)", "medium") %>
effort: <% tp.system.prompt("Effort (small/medium/large)", "medium") %>
reviewed: <% tp.date.now("YYYY-MM-DD") %>
depends_on:
tags:
  - task
---

# <% tp.system.prompt("Task title") %>

## Description

<!-- What is this task? What's the desired outcome? -->


## Success Criteria

- [ ]

## Notes

<!-- Context, blockers, resources needed -->


---

**Status**: not-started → in-progress → blocked → done → cancelled
