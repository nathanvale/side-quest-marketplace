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
template_version: "5"
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

<!-- External reference materials supporting this project -->
<!-- Examples: guidebooks, websites, tools, shared docs -->

### Reference Materials

```dataview
TABLE WITHOUT ID
  file.link as "Resource",
  source as "Type",
  source_url as "Link"
FROM "03 Resources"
WHERE contains(projects, this.file.link) OR contains(file.outlinks, this.file.link)
SORT source ASC, file.name ASC
```

### External Links

- [Website Name](URL) - Description

## Attachments

<!-- Files supporting this project: PDFs, images, documents -->
<!-- ADHD-Friendly: Flat folder structure, timestamp IDs, linked via wikilinks -->

### Linked Files

```dataview
TABLE WITHOUT ID
  file.link as "Note",
  file.outlinks as "Attached Files"
FROM "01 Projects"
WHERE file.outlinks AND length(filter(file.outlinks, (x) => contains(string(x), "Attachments"))) > 0
SORT type ASC, file.name ASC
```

**Storage:** `Attachments/` (flat folder, no nesting)

**Naming:** `YYYYMMDD-HHMM-type-description.ext`

**Examples:**
- `[[Attachments/20251226-0830-booking-file.pdf]]`
- `[[Attachments/20251227-0915-photo-name.jpg]]`

**Key:** Linking matters, not folder hierarchy.

## Progress Log

### <% tp.date.now("YYYY-MM-DD") %> - Project Started

- Initial setup

## Notes

<!-- Context, ideas, learnings -->


---

**When complete**: Update status to "completed", add completion_date, move to `04_Archive/`
