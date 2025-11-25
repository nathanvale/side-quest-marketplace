---
description: "[type] [title] - Create a new PARA note (project, area, resource)"
---

# Create New PARA Note

You create properly formatted notes in the user's Obsidian vault.

## Input Parsing

Parse $ARGUMENTS for:
- **Type**: project, area, resource (required)
- **Title**: Note title (required)

Examples:
- `/para:create project 2025 Tassie Holiday`
- `/para:create area Health & Fitness`
- `/para:create resource TypeScript Best Practices`

## Templates by Type

### Project Template

**Location**: `01_Projects/[Title].md`

```markdown
---
title: [Title]
created: [YYYY-MM-DD]
type: project
status: active
start_date: [YYYY-MM-DD]
target_completion: [Ask user]
area: "[[Ask user]]"
tags: [project]
---

# [Title]

> **Project = Has an end date = Can be finished**

## Project Overview

**Start Date**: [YYYY-MM-DD]
**Target Completion**: [date]
**Status**: Active
**Area**: [[Area Name]]

## Why This Matters

<!-- What problem does this solve? Why now? -->

## Success Criteria

<!-- How will I know this is DONE? Be specific! -->
- [ ]
- [ ]
- [ ]

## Objectives

- [ ]
- [ ]

## Key Resources

<!-- Links to relevant notes, documents -->
-

## Progress Log

### [YYYY-MM-DD] - Project Started
- Initial setup

## Next Actions

- [ ]

---
**When complete**: Update status to "completed" and move to `04_Archive/`
```

### Area Template

**Location**: `02_Areas/[Title].md`

```markdown
---
title: [Title]
created: [YYYY-MM-DD]
type: area
status: active
tags: [area]
---

# [Title]

> **Area = Ongoing responsibility = No end date**

## Overview

<!-- What does this area of your life encompass? -->

## Standards to Maintain

<!-- What level of quality/attention does this need? -->
-

## Current Projects

<!-- Dataview query or manual links -->
```dataview
TABLE status, target_completion
FROM "01_Projects"
WHERE contains(area, "[[{title}]]")
```

## Related Resources

-

## Review Questions

<!-- Ask yourself during weekly review -->
- Am I giving this area enough attention?
- What's one thing I could improve?

## Notes

```

### Resource Template

**Location**: `03_Resources/[Title].md`

```markdown
---
title: [Title]
created: [YYYY-MM-DD]
type: resource
source: [Ask: book|article|video|course|podcast|web]
tags: [resource]
---

# [Title]

## Source

**Type**: [source type]
**URL/Reference**: [if applicable]
**Author**: [if applicable]

## Summary

<!-- Key points in 2-3 sentences -->

## Key Insights

-
-
-

## Notable Quotes

>

## Connections

<!-- How does this relate to other notes? -->
- Related to: [[other note]]
- Useful for: [[project or area]]

## Action Items

- [ ]
```

## Process

1. Parse type and title from $ARGUMENTS
2. Ask any required follow-up questions:
   - **Project**: target_completion date, related area
   - **Resource**: source type
3. Create note using MCP tool
4. Confirm creation with path

## Output

```markdown
Created: [[Title]]
Location: [folder]/[filename].md
Type: [type]

[Any follow-up suggestions based on type]
```
