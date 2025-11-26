---
description: "[title] [project]" - Quick task checkbox added to project's Next Actions
argument-hint: [title] [project]
allowed-tools: mcp__MCP_DOCKER__obsidian_get_file_contents, mcp__MCP_DOCKER__obsidian_patch_content, mcp__MCP_DOCKER__obsidian_list_files_in_dir
---

# Quick Task (Checkbox)

Add a task checkbox to a project's `## Next Actions` section. Fast capture, no separate file.

## Arguments

- `$1` - Task title (required)
- `$2` - Project name (required)

**Examples:**
```
/para:task-quick "Book flights" "2025 Tassie Holiday"
/para:task-quick "Setup SDK wrapper" "Firecrawl Plugin Optimization"
```

## Process

### 1. Parse Arguments

Extract:
- `$1` = Task title
- `$2` = Project name

If either is missing, ask the user.

### 2. Locate Project File

Check `01_Projects/` for the project:

1. **If folder exists** (`01_Projects/$2/`):
   - Project file is `01_Projects/$2/$2.md`

2. **If flat file exists** (`01_Projects/$2.md`):
   - Project file is `01_Projects/$2.md`

3. **If neither exists**:
   - List available projects from `01_Projects/`
   - Ask user to select or create new project

### 3. Verify Next Actions Section

Read the project file and check if `## Next Actions` section exists.

### 4. Append Task Checkbox

Use `mcp__MCP_DOCKER__obsidian_patch_content`:

```yaml
filepath: [project file path]
operation: append
target_type: heading
target: "Next Actions"
content: "\n- [ ] $1"
```

**If `## Next Actions` doesn't exist**, append to end of file:
```markdown

## Next Actions

- [ ] $1
```

### 5. Confirm

Respond with:
```
Added to [[Project Name]]:
- [ ] Task title

Quick view: Open project to see all tasks
```

## Error Handling

- **Project not found**: List available projects, suggest `/para:create-project`
- **Section not found**: Create the section, then append
- **Empty title**: Prompt for task title
