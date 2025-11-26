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
4. **Smart subfolder check**: List `03_Resources/` subfolders, offer if match exists, else use root
5. **Read template** at `templates/resource.md`
6. **Replace Templater prompts** with parsed values
7. **Create file** using `obsidian_append_content`
8. **Suggest**: "Ready to capture key insights with Progressive Summarization?"

**Naming**: See `_shared/naming-convention.md` for Title Case rules
