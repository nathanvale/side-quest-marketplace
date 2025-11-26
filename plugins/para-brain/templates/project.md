---
title: "<% tp.system.prompt("Project title") %>"
created: <% tp.date.now("YYYY-MM-DD") %>
type: project
status: active
start_date: <% tp.date.now("YYYY-MM-DD") %>
target_completion: <% tp.system.prompt("Target completion date (YYYY-MM-DD)") %>
area: "[[<% tp.system.prompt("Area") %>]]"
depends_on:
blocks:
dependency_type: mandatory
tags:
  - project
---

# <% tp.system.prompt("Project title") %>

> **Project = Has an end date = Can be finished**

## Project Overview

| Field | Value |
|-------|-------|
| **Start Date** | <% tp.date.now("YYYY-MM-DD") %> |
| **Target Completion** | <% tp.system.prompt("Target completion date (YYYY-MM-DD)") %> |
| **Status** | Active |
| **Area** | [[<% tp.system.prompt("Area") %>]] |
| **Depends On** | [[Prerequisite Project]] |
| **Blocks** | [[Dependent Project]] |
| **Dependency Type** | Mandatory / Discretionary |

## Why This Matters

<!-- What problem does this solve? Why now? What happens if you don't do it? -->



## Success Criteria

<!-- How will you know this is DONE? Be specific and measurable! -->

- [ ]
- [ ]
- [ ]

## Objectives

<!-- Key milestones or deliverables -->

- [ ]
- [ ]
- [ ]

## Key Resources

<!-- Links to relevant notes, documents, tools -->

-

## Stakeholders

<!-- Who else is involved or affected? -->

-

## Progress Log

### <% tp.date.now("YYYY-MM-DD") %> - Project Started

- Initial setup complete
-

## Next Actions

<!-- What's the very next physical action? -->

- [ ]

## Risks & Blockers

<!-- What could prevent completion? -->

-

## Notes

<!-- Additional context, ideas, learnings -->



---

**When complete**:
1. Update status to "completed"
2. Add completion_date to frontmatter
3. Move to `04_Archive/<% tp.date.now("YYYY") %>/`
4. Celebrate!
