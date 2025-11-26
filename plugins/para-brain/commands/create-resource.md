---
description: Create a new PARA resource note for reference material
argument-hint: [title] [source-type?]
allowed-tools: Read, mcp__MCP_DOCKER__obsidian_list_files_in_dir, mcp__MCP_DOCKER__obsidian_append_content, AskUserQuestion
---

# Create Resource Note

Create a resource in `03_Resources/` using the template at [templates/resource.md](../templates/resource.md).

Resources are **reference material** and **topics of interest**.

## Arguments

- `$1` - Title (required)
- `$2` - Source type (optional): book, article, video, course, podcast, paper, web

**Examples:**
```
/para:create-resource "TypeScript Best Practices" article
/para:create-resource "Deep Work by Cal Newport" book
/para:create-resource "NetworkChuck Docker Tutorial" video
```

## Process

1. **Parse arguments** - Title (→ Title Case), source type
2. **If source type missing** → Ask with options: book, article, video, course, podcast, paper, web
3. **Based on type, ask follow-ups**:
   - book/article/paper → "Who's the author?"
   - video/course/podcast/web → "What's the URL?" (optional)
4. **Ask for areas** (required):
   - List existing areas from `02_Areas/` using `obsidian_list_files_in_dir`
   - Ask "Which area(s) does this relate to?" with multi-select
   - Resources MUST link to at least one area
   - Can link to multiple areas (array in frontmatter)
5. **Smart subfolder check**: List `03_Resources/` subfolders, offer if match exists, else use root
6. **Read template** at `templates/resource.md`
7. **Replace Templater prompts** with parsed values, including `areas:` array
8. **Create file** using `obsidian_append_content`
9. **Suggest**: "Ready to capture key insights with Progressive Summarization?"

## Frontmatter Format

```yaml
areas:
  - "[[Primary Area]]"
  - "[[Secondary Area]]"  # if multiple selected
```

**Naming**: See `_shared/naming-convention.md` for Title Case rules
