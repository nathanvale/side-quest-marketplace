---
title: "<% tp.system.prompt("Area title") %>"
created: <% tp.date.now("YYYY-MM-DD") %>
type: area
status: active
tags:
  - area
---

# <% tp.system.prompt("Area title") %>

> **Area = Ongoing responsibility = No end date**

## Overview

<!-- What does this area of your life encompass? What responsibilities does it include? -->



## Standards to Maintain

<!-- What level of quality, attention, or frequency does this area need? -->

- [ ]
- [ ]
- [ ]

## Current Projects

<!-- Active projects in this area (Dataview auto-populates if installed) -->

```dataview
TABLE status, target_completion as "Due Date"
FROM "01_Projects"
WHERE contains(area, "[[<% tp.system.prompt("Area title") %>]]")
SORT target_completion ASC
```

## Key Metrics

<!-- How do you measure success in this area? -->

| Metric | Target | Current |
|--------|--------|---------|
|  |  |  |

## Related Resources

<!-- Reference materials, guides, tools for this area -->

-

## Routines & Habits

<!-- Regular activities that maintain this area -->

- **Daily**:
- **Weekly**:
- **Monthly**:

## Review Questions

<!-- Ask yourself during weekly review -->

- Am I giving this area enough attention?
- What's working well?
- What's one thing I could improve?
- Are there any projects that should emerge from this area?

## Notes

<!-- Ongoing observations, ideas, improvements -->



---

**Areas are never "done"** - they represent ongoing standards you maintain throughout life.
