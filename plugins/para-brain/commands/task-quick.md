---
description: "[title] [project-or-area]" - Quick checkbox in Next Actions section
argument-hint: [title] [project-or-area]
allowed-tools: mcp__MCP_DOCKER__obsidian_get_file_contents, mcp__MCP_DOCKER__obsidian_patch_content, mcp__MCP_DOCKER__obsidian_list_files_in_dir
---

# Quick Task (Checkbox)

Add a task checkbox to a project or area's `## Next Actions` section. No separate file created.

**Use when**: Quick capture, simple tasks that don't need rich metadata.

**Use `/para:task` instead when**: You need due dates, priorities, dependencies, or Dataview queries.

## Arguments

- `$1` - Task title (required)
- `$2` - Project or area name (required)

**Examples:**
```
/para:task-quick "Book flights" "2025 Tassie Holiday"
/para:task-quick "Setup SDK wrapper" "Firecrawl Plugin Optimization"
/para:task-quick "Schedule dentist" "Health"
```

## Process

### 1. Parse Arguments

- `$1` = Task title
- `$2` = Project or area name

If either missing, ask the user.

### 2. Find the Note

Check both locations:
1. `01_Projects/$2.md` or `01_Projects/$2/$2.md`
2. `02_Areas/$2.md` or `02_Areas/$2/$2.md`

If not found, list available projects/areas and ask.

### 3. Append Checkbox

Use `mcp__MCP_DOCKER__obsidian_patch_content`:

```yaml
filepath: [found path]
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

### 4. Confirm

```
Added to [[Project/Area]]:
- [ ] Task title
```

## When to Use Which

| Scenario | Command |
|----------|---------|
| Quick reminder, simple task | `/para:task-quick` |
| Need due date, priority | `/para:task` |
| Want to query with Dataview | `/para:task` |
| Just jotting something down | `/para:task-quick` |
