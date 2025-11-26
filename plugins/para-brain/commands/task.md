---
description: "[title] [--project name] [--area name] [--type] [--due] [--priority]" - Create task file in Tasks folder
argument-hint: [title] [--project name] [--area name]
allowed-tools: Read, mcp__MCP_DOCKER__obsidian_append_content, mcp__MCP_DOCKER__obsidian_list_files_in_dir, AskUserQuestion
---

# Create Task

Create a task file in `07_Tasks/` using the template at [templates/task.md](../templates/task.md).

## Arguments

- `$1` - Task title (required)
- `--project` - Link to project (optional)
- `--area` - Link to area (optional)
- `--type` - task, reminder, habit, chore (default: task)
- `--due` - Due date YYYY-MM-DD (optional)
- `--priority` - low, medium, high, urgent (default: medium)

**Examples:**
```
/para:task "Setup SDK wrapper" --project "Firecrawl Plugin Optimization"
/para:task "Take vitamins" --area "Health" --type habit
/para:task "Book flights" --project "2025 Tassie Holiday" --due 2025-01-15 --priority high
```

## Process

1. **Parse arguments** - Extract title, project, area, type, due, priority
2. **If title missing** → Ask user
3. **If no project/area** → List options from `01_Projects/` and `02_Areas/`, or "Standalone"
4. **Read template** at `templates/task.md`
5. **Replace Templater prompts** (`<% tp.system.prompt(...) %>`) with parsed values
6. **Create file** in `07_Tasks/[Title].md` using `obsidian_append_content`
7. **Confirm** with location and linked project/area
