---
description: Create a new PARA resource note for reference material
argument-hint: [title] [source-type?]
allowed-tools: mcp__MCP_DOCKER__obsidian_list_files_in_dir, mcp__MCP_DOCKER__obsidian_append_content, AskUserQuestion
---

# Create Resource Note

Create a resource in `03_Resources/`. Resources are **reference material** and **topics of interest**.

## Arguments

- `$1` - Title (required)
- `$2` - Source type (optional, ask if missing): book, article, video, course, podcast, paper, web

**Examples:**
```
/para:create-resource "TypeScript Best Practices" article
/para:create-resource "Deep Work by Cal Newport" book
/para:create-resource "NetworkChuck Docker Tutorial" video
/para:create-resource "React Hooks Guide"
```

## File Naming

See: `_shared/naming-convention.md`

**Format**: Title Case with Spaces → `03_Resources/Title Case with Spaces.md`

Convert user input to Title Case:
- `"typescript best practices"` → `TypeScript Best Practices.md`
- `"deep work by cal newport"` → `Deep Work by Cal Newport.md`

## Template

**Location**: `03_Resources/[Title in Title Case].md`

```markdown
---
title: "$1"
created: [TODAY YYYY-MM-DD]
type: resource
source: [$2 or ask]
author: [ask if relevant]
source_url: [ask if relevant]
tags: [resource]
---

# $1

## Source

**Type**: [$2]
**Author**: [if applicable]
**URL/Reference**: [if applicable]

## Summary

<!-- Key points in 2-3 sentences -->

## Key Insights

-
-
-

## Notable Quotes

>

## Progressive Summary

<!-- Layer 2: Bold key points -->
<!-- Layer 3: ==Highlight== the best -->
<!-- Layer 4: Executive summary at top -->

## Connections

<!-- How does this relate to other notes? -->
- Related to: [[other note]]
- Useful for: [[project or area]]

## Action Items

- [ ]
```

## Process

1. Parse `$1` (title), `$2` (source type)
   - **Convert title to Title Case with Spaces** (see `_shared/naming-convention.md`)

2. **If `$2` missing** → Ask: "What type of source is this?"
   - Options: book, article, video, course, podcast, paper, web

3. **Based on source type, ask follow-ups**:
   - **book/article/paper**: "Who's the author?"
   - **video/course/podcast/web**: "What's the URL?" (optional)

4. **Smart subfolder suggestion** (Resources only):
   - Check if subfolders exist in `03_Resources/` using `mcp__MCP_DOCKER__obsidian_list_files_in_dir`
   - If subfolders exist AND title matches one contextually → Ask with `AskUserQuestion`:
     - Matching subfolder(s)
     - `03_Resources/` root
   - If no subfolders OR no match → Create in root (let structure emerge)
   - **Never offer "create new folder"** - per PARA, avoid over-organizing

5. **Create note** using `mcp__MCP_DOCKER__obsidian_append_content`

6. **Confirm** with location

7. **Suggest**: "Ready to capture key insights? I can help you distill this using Progressive Summarization."
