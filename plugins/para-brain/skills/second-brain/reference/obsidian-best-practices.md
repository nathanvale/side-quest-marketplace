# Obsidian Best Practices for PARA

> Compiled from Obsidian forums, Obsibrain documentation, and community wisdom

## Table of Contents
- [Folder Structure](#folder-structure)
- [Frontmatter Standards](#frontmatter-standards)
- [Linking Strategies](#linking-strategies)
- [Tagging Strategy](#tagging-strategy)
- [Dataview Queries](#dataview-queries)
- [Templates](#templates)
- [File Naming](#file-naming)
- [Performance Tips](#performance-tips)
- [Plugin Recommendations](#plugin-recommendations)
- [Common Mistakes](#common-mistakes)
- [Quick Reference](#quick-reference)

---

## Folder Structure

### Recommended PARA Setup

```
00_Inbox/           # Unprocessed captures
01_Projects/        # Active projects with deadlines
02_Areas/           # Ongoing responsibilities
03_Resources/       # Reference material by topic
04_Archive/         # Completed/inactive items
  └── 2024/         # Organized by year
  └── 2025/
05_Attachments/     # Images, PDFs, files
06_Metadata/        # Templates, MOCs, system files
  └── Templates/
  └── MOCs/
```

### Why Number Prefixes?

- Forces consistent sort order
- Prevents alphabetical chaos
- Makes structure scannable
- Numbers indicate actionability (lower = more active)

---

## Frontmatter Standards

### Universal Properties

```yaml
---
title: "Note Title"
created: 2025-01-15
modified: 2025-01-15
type: project|area|resource|capture
status: active|completed|on-hold|archived
tags: []
aliases: []
---
```

### Type-Specific Properties

**Projects**
```yaml
start_date: 2025-01-15
target_completion: 2025-03-01
completion_date:    # filled when done
area: "[[Parent Area]]"
priority: high|medium|low
```

**Areas**
```yaml
review_frequency: weekly|monthly|quarterly
last_reviewed: 2025-01-15
```

**Resources**
```yaml
source: book|article|video|course|podcast|paper|web
source_url: "https://..."
author: "Author Name"
date_consumed: 2025-01-15
rating: 1-5
```

**Captures**
```yaml
captured_from: thought|conversation|article|book
resonance: inspiring|useful|personal|surprising
urgency: high|medium|low
processed: false
```

---

## Linking Strategies

### Bi-Directional Links
```markdown
This project relates to [[Area Name]].
```

- Creates automatic backlink in Area note
- Builds knowledge graph organically
- Enables serendipitous discovery

### Link Contexts
```markdown
Working on [[Project X]] taught me about [[concept]].
```

- Surrounding text provides context
- Makes backlinks more useful
- Helps future you understand why you linked

### Block References
```markdown
![[Note Name#Section]]
![[Note Name^block-id]]
```

- Embed content from other notes
- Single source of truth
- Updates propagate automatically

### Wikilink Resolution

**Correct Syntax**
```markdown
[[Note Name]]              # Preferred - no extension needed
[[Note Name.md]]           # Also works
[[Folder/Note Name]]       # Include path if duplicate names exist
[[Note Name|Display Text]] # Custom display text
```

**How Obsidian Resolves Links**
- Obsidian searches for filenames **across the entire vault**
- **Does NOT require folder paths** in most cases
- Finds shortest/closest match first
- **CRITICAL**: Duplicate filenames cause link conflicts

**Common Issue: Duplicate Filenames**
```
# ❌ BROKEN - Two files with same name
/vault-root/Project Overview.md
/01_Projects/My Project/Project Overview.md

When you use [[Project Overview]], Obsidian picks ONE (usually wrong one!)
```

**Solution**
```markdown
# ✅ FIX 1: Delete duplicate files
# Keep only one version in correct location

# ✅ FIX 2: Use unique filenames
/01_Projects/My Project/My Project Overview.md  # Unique name
[[My Project Overview]]                         # Works correctly

# ✅ FIX 3: Include folder path (last resort)
[[01_Projects/My Project/Project Overview]]     # Explicitly specify location
```

**Best Practices**
- ✅ Use unique, descriptive filenames (e.g., "2025 Tasmania Holiday" not "Project Overview")
- ✅ Avoid generic names like "Overview", "README", "Index"
- ✅ Keep project overview files INSIDE project folders, not in vault root
- ✅ Search for duplicates: `find /vault -name "*.md" | sort | uniq -d`
- ❌ Never create files in vault root when they belong in PARA folders

**Debugging Wikilinks**
If clicking a wikilink tries to create a new note:
1. The target file doesn't exist, OR
2. A duplicate filename exists elsewhere (Obsidian found wrong one)
3. Check for duplicates: Search vault for exact filename

**Reference**: [Official Obsidian Wikilink Documentation](https://help.obsidian.md/Linking+notes+and+files/Internal+links)

---

## Tagging Strategy

### Hierarchical Tags
```yaml
tags:
  - project/active
  - area/health
  - type/meeting-notes
```

### Status Tags
```yaml
tags:
  - status/active
  - status/on-hold
  - status/completed
```

### When to Tag vs. Link
- **Tag**: For categorization and filtering
- **Link**: For meaningful connections

Example:
- `#book` = This is a book note (category)
- `[[Deep Work]]` = This relates to the Deep Work concept (connection)

---

## Dataview Queries

### Active Projects Dashboard
```dataview
TABLE
  status,
  target_completion as "Due",
  area as "Area"
FROM "01_Projects"
WHERE status = "active"
SORT target_completion ASC
```

### Overdue Projects
```dataview
LIST
FROM "01_Projects"
WHERE target_completion < date(today)
  AND status = "active"
```

### Recent Notes
```dataview
TABLE created, type
FROM ""
SORT created DESC
LIMIT 10
```

### Notes by Area
```dataview
LIST
FROM "01_Projects" OR "03_Resources"
WHERE contains(area, "[[Health]]")
```

### Inbox Count
```dataview
LIST
FROM "00_Inbox"
```

### Unprocessed Captures
```dataview
TABLE resonance, urgency
FROM "00_Inbox"
WHERE processed = false
SORT urgency DESC
```

---

## Templates

### Template Location
Store in `06_Metadata/Templates/` or `.obsidian/templates/`

### Template Variables
```markdown
{{title}}           # Note title
{{date}}            # Current date
{{time}}            # Current time
{{date:YYYY-MM-DD}} # Formatted date
```

### Template Plugin vs. Templater
- **Core Templates**: Simple, built-in, limited
- **Templater**: Powerful, programmable, community plugin

### Recommended Templates
1. Project
2. Area
3. Resource
4. Daily Note
5. Meeting Notes
6. Weekly Review

---

## File Naming

### Conventions
- Use descriptive names
- Avoid special characters: `/ \ : * ? " < > |`
- Dates in ISO format: `2025-01-15`
- Consider prefixes for sorting

### Examples
```
2025-01-15 Project Kickoff Meeting.md
Book - Deep Work by Cal Newport.md
MOC - Personal Knowledge Management.md
```

### Daily Notes
```
2025-01-15.md
```

---

## Performance Tips

### Large Vaults (1000+ notes)
- Disable plugins you don't use
- Use lazy loading for Dataview
- Avoid complex queries on startup
- Consider excluding folders from search

### Sync Considerations
- Use Git or Obsidian Sync
- Avoid Dropbox/iCloud for vault root
- Be careful with mobile sync timing

---

## Plugin Recommendations

### Essential
- **Dataview**: Dynamic queries
- **Templater**: Advanced templates
- **Calendar**: Daily note navigation

### Productivity
- **Tasks**: Task management
- **Periodic Notes**: Weekly/monthly notes
- **Quick Add**: Fast capture

### PARA-Specific
- **Folder Note**: Folder index pages
- **Breadcrumbs**: Hierarchy navigation
- **Homepage**: Dashboard on open

---

## Common Mistakes

### 1. Over-Organizing
Creating folders before you need them. Let structure emerge.

### 2. Neglecting Links
Obsidian's power is in connections. Link liberally.

### 3. Tag Explosion
Too many tags = no tags. Keep tags meaningful.

### 4. Ignoring the Inbox
Process inbox regularly or it becomes a graveyard.

### 5. Perfectionism
"Good enough" notes are better than no notes.

### 6. Not Reviewing
Without weekly review, any system degrades.

### 7. Duplicate Filenames
Creating files with identical names in different folders breaks wikilinks. Use unique, descriptive names like "2025 Tasmania Holiday" instead of generic "Project Overview".

---

## Quick Reference

### Keyboard Shortcuts
| Action | Shortcut |
|--------|----------|
| Quick switcher | Cmd/Ctrl + O |
| Search | Cmd/Ctrl + Shift + F |
| New note | Cmd/Ctrl + N |
| Insert template | (configure) |
| Toggle edit/preview | Cmd/Ctrl + E |

### Markdown Essentials
```markdown
**bold**
*italic*
==highlight==
[[link]]
![[embed]]
- [ ] task
> quote
# Header
```

---

*Best practices compiled from Obsidian community, forums, and documentation.*
