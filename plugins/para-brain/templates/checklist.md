---
title: "<% tp.system.prompt("Checklist title") %>"
created: <% tp.date.now("YYYY-MM-DD") %>
type: checklist
checklist_type: <% tp.system.prompt("Checklist type (packing/groceries/snacks/tasks)") %>
project: "[[<% tp.system.prompt("Project") %>]]"
status: draft
depends_on:
blocks:
dependency_type: mandatory
tags:
  - checklist
---

# <% tp.system.prompt("Checklist title") %>

> **Checklist** for [[<% tp.system.prompt("Project") %>]]

## Status

| Field | Value |
|-------|-------|
| **Type** | |
| **Status** | Draft |
| **Last Updated** | <% tp.date.now("YYYY-MM-DD") %> |
| **Depends On** | [[Prerequisite Checklist]] |
| **Blocks** | [[Dependent Checklist]] |
| **Dependency Type** | Mandatory / Discretionary |

## Checklist

### Category 1

- [ ]
- [ ]
- [ ]

### Category 2

- [ ]
- [ ]
- [ ]

### Category 3

- [ ]
- [ ]
- [ ]

## Notes

<!-- Special considerations, reminders -->



## Timeline

| When | Action |
|------|--------|
| 2 weeks before | |
| 1 week before | |
| Day before | |
| Day of | |

---

**Project**: [[<% tp.system.prompt("Project") %>]]
