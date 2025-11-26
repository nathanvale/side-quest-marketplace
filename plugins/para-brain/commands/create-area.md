---
description: Create a new PARA area note for ongoing responsibilities
argument-hint: [title]
allowed-tools: Read, mcp__MCP_DOCKER__obsidian_list_files_in_dir, mcp__MCP_DOCKER__obsidian_append_content, AskUserQuestion
---

# Create Area Note

Create an area in `02_Areas/` using the template at [templates/area.md](../templates/area.md).

Areas are **ongoing responsibilities** with **no end date**.

## Arguments

- `$1` - Title (required)

**Examples:**
```
/para:create-area "Health & Fitness"
/para:create-area "Career Development"
/para:create-area "Melanie & Relationship"
```

## Process

1. **Parse title** → Convert to Title Case (see `_shared/naming-convention.md`)
2. **Read template** at `templates/area.md`
3. **Replace Templater prompts** with parsed values
4. **Create file** in `02_Areas/[Title].md` using `obsidian_append_content`
5. **Confirm** with location
6. **Suggest**: "Would you like to create a project within this area?"
