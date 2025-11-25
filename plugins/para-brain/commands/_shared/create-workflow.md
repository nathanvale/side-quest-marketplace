# Shared Create Workflow

Reference file for `/para:create-*` commands.

## PARA Principle: Don't Over-Organize

Per Tiago Forte's PARA method:
- "Keep it to 4-6 items per level maximum"
- "Resources don't need perfect organization. They just need to be findable."

**Rule**: Let structure emerge naturally. Don't create folders preemptively.

## Subfolder Logic by Type

| Type | Subfolder Behavior |
|------|-------------------|
| **Project** | Always create in `01_Projects/` root |
| **Area** | Always create in `02_Areas/` root |
| **Resource** | Suggest existing subfolders if they match title |

## Resource Subfolder Matching

Only for Resources - if user has existing subfolders:

1. List subfolders in `03_Resources/` using `mcp__MCP_DOCKER__obsidian_list_files_in_dir`
2. If subfolders exist, check if title contextually matches any
3. **If match** → Ask user with `AskUserQuestion`:
   - Matching subfolder(s)
   - Root folder option
4. **If no match or no subfolders** → Create in root silently

**Never offer "create new folder"** - structure should emerge from repeated use.

### Matching Examples

| Title | Existing Subfolders | Action |
|-------|---------------------|--------|
| "React Best Practices" | Technical/, Work/ | Ask: Technical/ or root? |
| "Docker Tutorial" | Technical/, Work/ | Ask: Technical/ or root? |
| "Fishing Trip Guide" | Technical/, Work/ | Create in root (no match) |
| "TypeScript Patterns" | (none) | Create in root |

## Argument Parsing

Use positional arguments: `$1` (title), `$2`, `$3` for optional fields.

- If arg provided → use it
- If arg missing → ask with `AskUserQuestion`

## Output Format

```
✅ Created: [[Title]]
📁 Location: [folder]/[filename].md
📋 Type: [project|area|resource]
```

## MCP Tools

- `mcp__MCP_DOCKER__obsidian_list_files_in_dir` - Check subfolders (Resources only)
- `mcp__MCP_DOCKER__obsidian_append_content` - Create note
