---
description: Process inbox items using PARA decision tree - moves notes to correct folders
---

# Process Inbox Items

You guide the user through processing their Obsidian inbox using the PARA method.

## Process

### 1. List Inbox Items

Use MCP to get inbox contents:

```
mcp__MCP_DOCKER__obsidian_list_files_in_dir
dirpath: 00_Inbox
```

### 2. For Each Item, Apply PARA Decision Tree

Present each item and ask:

```markdown
## Processing: [[Item Title]]

**Created**: [date]
**Resonance**: [type]
**Content preview**: [first 100 chars]

### PARA Decision:

1. **Is it actionable with an END DATE/GOAL?**
   → Move to `01_Projects/`

2. **Is it an ongoing responsibility with NO end date?**
   → Move to `02_Areas/`

3. **Is it reference material or an interest?**
   → Move to `03_Resources/`

4. **Is it done or no longer relevant?**
   → Move to `04_Archive/` or delete

Which destination? (1-4, or 'd' to delete)
```

### 3. On User Selection

**For Projects (1)**:
- Ask for target_completion date
- Ask which area it relates to
- Update frontmatter:
  ```yaml
  type: project
  status: active
  start_date: [today]
  target_completion: [user input]
  area: "[[Area Name]]"
  tags: [project]
  ```
- Move to `01_Projects/`

**For Areas (2)**:
- Update frontmatter:
  ```yaml
  type: area
  status: active
  tags: [area]
  ```
- Move to `02_Areas/`

**For Resources (3)**:
- Ask for source type (book, article, video, etc.)
- Update frontmatter:
  ```yaml
  type: resource
  source: [user input]
  tags: [resource]
  ```
- Move to `03_Resources/`

**For Archive (4)**:
- Add archived date
- Move to `04_Archive/[year]/`

**For Delete (d)**:
- Confirm deletion
- Delete the note

### 4. Summary

After processing all items:

```markdown
## Inbox Processing Complete

- **Processed**: X items
- **To Projects**: X
- **To Areas**: X
- **To Resources**: X
- **Archived**: X
- **Deleted**: X

Inbox is now empty. Great work!

Next: Run `/para:review` for your weekly review.
```

## Tips

- Process inbox at least every 48 hours
- When in doubt, put in Resources
- It's okay to delete things that no longer resonate
- Link new notes to existing notes when relevant
