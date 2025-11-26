---
title: "<% tp.system.prompt("Project title") %>"
created: <% tp.date.now("YYYY-MM-DD") %>
type: project
status: active
start_date: <% tp.date.now("YYYY-MM-DD") %>
target_completion: <% tp.system.prompt("Target completion date (YYYY-MM-DD)") %>
completion_date:
area: "[[<% tp.system.prompt("Area") %>]]"
reviewed: <% tp.date.now("YYYY-MM-DD") %>
review_period: 7d
tags:
  - project
---

# <% tp.system.prompt("Project title") %>

> **Project = Has an end date = Can be finished**

## Why This Matters

<!-- What problem does this solve? Why now? -->


## Success Criteria

<!-- How will you know this is DONE? Be specific! -->

- [ ]
- [ ]

## Tasks

```dataview
TASK
FROM "07_Tasks"
WHERE contains(project, this.file.link) AND !completed
SORT priority DESC
```

## Next Actions

- [ ]

## Key Resources

-

## Progress Log

### <% tp.date.now("YYYY-MM-DD") %> - Project Started

- Initial setup

## Notes

<!-- Context, ideas, learnings -->


---

**When complete**: Update status to "completed", add completion_date, move to `04_Archive/`
