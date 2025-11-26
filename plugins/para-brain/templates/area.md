---
title: "<% tp.system.prompt("Area title") %>"
created: <% tp.date.now("YYYY-MM-DD") %>
type: area
status: active
reviewed: <% tp.date.now("YYYY-MM-DD") %>
review_period: 14d
tags:
  - area
---

# <% tp.system.prompt("Area title") %>

> **Area = Ongoing responsibility = No end date**

## Overview

<!-- What does this area encompass? -->


## Standards to Maintain

- [ ]
- [ ]

## Current Projects

```dataview
TABLE status, target_completion as "Due"
FROM "01_Projects"
WHERE contains(area, this.file.link) AND status = "active"
SORT target_completion ASC
```

## Tasks

```dataview
TASK
FROM "07_Tasks"
WHERE contains(area, this.file.link) AND !completed
GROUP BY file.link
```

## Related Resources

-

## Review Questions

- Am I giving this area enough attention?
- What projects should emerge from this area?

## Notes

<!-- Observations, ideas, improvements -->


---

**Areas are never "done"** - they represent ongoing standards.
