---
description: Create a new PARA project note with deadline and area
argument-hint: [title] [target-date?] [area?]
allowed-tools: mcp__MCP_DOCKER__obsidian_list_files_in_dir, mcp__MCP_DOCKER__obsidian_append_content, AskUserQuestion
---

# Create Project Note

Create a project in `01_Projects/`. Projects have **end dates** and can be **finished**.

## Arguments

- `$1` - Title (required)
- `$2` - Target completion date (optional, ask if missing)
- `$3` - Related area (optional, ask if missing)

**Examples:**
```
/para:create-project "2025 Tassie Holiday" 2025-12-20 Travel
/para:create-project "Website Redesign" 2025-03-01
/para:create-project "Learn Piano"
```

## Template

**Location**: `01_Projects/[Title].md`

```markdown
---
title: "$1"
created: [TODAY YYYY-MM-DD]
type: project
status: active
start_date: [TODAY YYYY-MM-DD]
target_completion: [$2 or ask]
area: "[[$3 or ask]]"
tags: [project]
---

# $1

> **Project = Has an end date = Can be finished**

## Project Overview

**Start Date**: [TODAY]
**Target Completion**: [$2]
**Status**: Active
**Area**: [[$3]]

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

### [TODAY] - Project Started
- Initial setup

## Next Actions

- [ ]

---
**When complete**: Update status to "completed" and move to `04_Archive/`
```

## Process

1. Parse `$1` (title), `$2` (target date), `$3` (area)

2. **If `$2` missing** → Ask: "What's the target completion date?"
   - Offer suggestions: "1 week", "1 month", "3 months", "Custom date"

3. **If `$3` missing** → Ask: "Which area does this relate to?"
   - List existing areas from `02_Areas/` as options
   - Include "None / Create new area"

4. **Create note** in `01_Projects/` root using `mcp__MCP_DOCKER__obsidian_append_content`
   - Per PARA: Don't over-organize. Let structure emerge naturally.

5. **Confirm** with location and suggest first action
