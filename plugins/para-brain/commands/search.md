---
description: $ARGUMENTS - Search Obsidian vault with PARA-aware context
allowed-tools: mcp__MCP_DOCKER__obsidian_simple_search, mcp__MCP_DOCKER__obsidian_complex_search, mcp__MCP_DOCKER__obsidian_get_file_contents, mcp__MCP_DOCKER__obsidian_list_files_in_dir, mcp__MCP_DOCKER__obsidian_patch_content, AskUserQuestion
---

# Search Second Brain

You search the user's Obsidian vault with PARA-aware context.

## Input

Search query: **$ARGUMENTS**

## Search Strategy

### 1. Parse Query Intent

Determine search type:
- **By content**: General text search
- **By type**: "projects about X", "resources for Y"
- **By status**: "active projects", "inbox items"
- **By area**: "everything related to [area]"
- **By date**: "created this week", "due soon"

### 2. Execute Search

**Content Search**:
```
mcp__MCP_DOCKER__obsidian_simple_search
query: [search terms]
context_length: 150
```

**Folder-Specific Search**:
```
mcp__MCP_DOCKER__obsidian_list_files_in_dir
dirpath: [01_Projects|02_Areas|03_Resources|04_Archive]
```

Then filter/search within results.

**Complex Search (JsonLogic)**:
```
mcp__MCP_DOCKER__obsidian_complex_search
query: {"and": [
  {"glob": ["01_Projects/**/*.md", {"var": "path"}]},
  {"in": ["active", {"var": "content"}]}
]}
```

### 3. Present Results

```markdown
## Search Results: "[query]"

Found X results across your vault:

### Projects (X)
- [[Project 1]] - [brief context]
- [[Project 2]] - [brief context]

### Areas (X)
- [[Area 1]] - [brief context]

### Resources (X)
- [[Resource 1]] - [brief context]

### Archive (X)
- [[Archived Item]] - [brief context]

---

**Refine search?**
- `/para:search [query] in:projects` - Search only projects
- `/para:search [query] status:active` - Only active items
- `/para:search [query] area:[[Area Name]]` - By area
```

## Search Modifiers

| Modifier | Example | Description |
|----------|---------|-------------|
| `in:projects` | `meeting in:projects` | Search only 01_Projects/ |
| `in:areas` | `health in:areas` | Search only 02_Areas/ |
| `in:resources` | `typescript in:resources` | Search only 03_Resources/ |
| `in:inbox` | `urgent in:inbox` | Search only 00_Inbox/ |
| `status:active` | `api status:active` | Only active items |
| `status:completed` | `auth status:completed` | Only completed items |
| `area:[[X]]` | `task area:[[Work]]` | Items linked to area |
| `created:today` | `notes created:today` | Created today |
| `created:week` | `ideas created:week` | Created this week |

## Common Searches

**Find all active projects**:
```
/para:search status:active in:projects
```

**Find resources about a topic**:
```
/para:search typescript in:resources
```

**Find items in an area**:
```
/para:search area:[[Health & Fitness]]
```

**Find inbox items needing processing**:
```
/para:search in:inbox
```

**Find recently created notes**:
```
/para:search created:week
```

## No Results?

If search returns nothing:
1. Suggest alternative search terms
2. Check if content might be in a different PARA category
3. Offer to create a new note with this topic

---

## Lazy Migration: Validate Notes on Read

When user selects a note to view details, validate its frontmatter.

**See**: [_shared/validate-note.md](_shared/validate-note.md) for schemas.

### After Reading a Note

1. Parse frontmatter and check `type:` field
2. Compare against schema for that type
3. If missing required fields, show:

```markdown
### ⚠️ Note needs update

**[[Note Title]]** is missing required fields:
- `areas` - Which area(s) does this relate to?
- `reviewed` - Last review date

**Update now?** This takes 10 seconds.
```

4. If user agrees:
   - Use `AskUserQuestion` to gather missing values
   - Use `obsidian_patch_content` to update frontmatter
   - Confirm update complete

5. Continue with original search results

### Skip Validation If

- Note was reviewed in last 7 days (`reviewed` field is recent)
- User previously declined to update this note in session
