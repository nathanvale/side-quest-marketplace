---
description: Create a new PARA area note for ongoing responsibilities
argument-hint: [title]
allowed-tools: mcp__MCP_DOCKER__obsidian_list_files_in_dir, mcp__MCP_DOCKER__obsidian_append_content, AskUserQuestion
---

# Create Area Note

Create an area in `02_Areas/`. Areas are **ongoing responsibilities** with **no end date**.

## Arguments

- `$1` - Title (required)

**Examples:**
```
/para:create-area "Health & Fitness"
/para:create-area "Career Development"
/para:create-area "Melanie & Relationship"
```

## Template

**Location**: `02_Areas/[Title].md`

```markdown
---
title: "$1"
created: [TODAY YYYY-MM-DD]
type: area
status: active
tags: [area]
---

# $1

> **Area = Ongoing responsibility = No end date**

## Overview

<!-- What does this area of your life encompass? -->

## Standards to Maintain

<!-- What level of quality/attention does this need? -->
-

## Current Projects

```dataview
TABLE status, target_completion
FROM "01_Projects"
WHERE contains(area, "[[$1]]")
```

## Related Resources

-

## Review Questions

<!-- Ask yourself during weekly review -->
- Am I giving this area enough attention?
- What's one thing I could improve?

## Notes

```

## Process

1. Parse `$1` (title)

2. **Create note** in `02_Areas/` root using `mcp__MCP_DOCKER__obsidian_append_content`
   - Per PARA: Don't over-organize. Let structure emerge naturally.

3. **Confirm** with location

4. **Suggest**: "Would you like to create a project within this area?"
