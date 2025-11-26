---
description: Create a new PARA project note with deadline and area
argument-hint: [title] [target-date?] [area?]
allowed-tools: Read, mcp__MCP_DOCKER__obsidian_list_files_in_dir, mcp__MCP_DOCKER__obsidian_append_content, AskUserQuestion
---

# Create Project Note

Create a project in `01_Projects/` using the template at [templates/project.md](../templates/project.md).

Projects have **end dates** and can be **finished**.

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

## Process

1. **Parse arguments** - Title (→ Title Case), target date, area
2. **If target date missing** → Ask with options: "1 week", "1 month", "3 months", "Custom"
3. **If area missing** → List existing areas from `02_Areas/`, include "None / Create new"
4. **Read template** at `templates/project.md`
5. **Replace Templater prompts** with parsed values
6. **Create file** in `01_Projects/[Title].md` using `obsidian_append_content`
7. **Confirm** with location and suggest first action

**Naming**: See `_shared/naming-convention.md` for Title Case rules
