# PARA Brain Plugin

> The ultimate Claude Code plugin for PARA method and Building a Second Brain (BASB) knowledge management in Obsidian.

## Overview

PARA Brain brings Tiago Forte's proven productivity systems directly into your Claude Code workflow. It provides intelligent assistance for capturing, organizing, distilling, and expressing knowledge using the PARA method and CODE workflow.

### What's Included

- **1 Skill**: `second-brain` - Expert knowledge on PARA, BASB, and Obsidian best practices
- **5 Commands**: Quick actions for common Second Brain operations
- **6 Templates**: Ready-to-use templates for each PARA note type
- **MCP Integration**: Direct Obsidian vault manipulation via MCP tools

## Quick Start

### Prerequisites

1. Obsidian vault with PARA folder structure:
   ```
   00_Inbox/
   01_Projects/
   02_Areas/
   03_Resources/
   04_Archive/
   ```

2. MCP Docker with Obsidian REST API configured

3. Claude Code with plugin support

### Installation

1. Copy the `para-brain` folder to your Claude Code plugins directory
2. Ensure MCP Obsidian tools are available (`mcp__MCP_DOCKER__obsidian_*`)
3. The skill auto-triggers on keywords like "para", "second brain", "obsidian", etc.

## Commands

### `/para:capture [content]`

Quick capture to inbox with intelligent tagging.

```
/para:capture Great idea for automating my morning routine
```

**Features**:
- Auto-generates descriptive title
- Assesses resonance (inspiring, useful, personal, surprising)
- Sets urgency level
- Creates properly formatted inbox note

### `/para:process`

Guided inbox processing using PARA decision tree.

```
/para:process
```

**Workflow**:
1. Lists all inbox items
2. For each item, presents PARA decision options
3. Asks follow-up questions (dates, areas, sources)
4. Updates frontmatter and moves to correct folder
5. Provides summary statistics

### `/para:create [type] [title]`

Create new PARA notes with proper templates.

```
/para:create project 2025 Tassie Holiday
/para:create area Health & Fitness
/para:create resource TypeScript Best Practices
```

**Types**: `project`, `area`, `resource`

### `/para:review`

Comprehensive weekly review workflow.

```
/para:review
```

**Phases**:
1. Clear the Inbox
2. Review Active Projects
3. Review Areas
4. Check Upcoming Deadlines
5. Express & Create
6. Summary & Planning

### `/para:search [query] [modifiers]`

PARA-aware vault search with smart filtering.

```
/para:search typescript in:resources
/para:search meeting status:active
/para:search health area:[[Health & Fitness]]
```

**Modifiers**:
| Modifier | Example | Description |
|----------|---------|-------------|
| `in:projects` | `api in:projects` | Search only 01_Projects/ |
| `in:areas` | `health in:areas` | Search only 02_Areas/ |
| `in:resources` | `react in:resources` | Search only 03_Resources/ |
| `in:inbox` | `urgent in:inbox` | Search only 00_Inbox/ |
| `status:active` | `api status:active` | Only active items |
| `status:completed` | `auth status:completed` | Only completed items |
| `area:[[X]]` | `task area:[[Work]]` | Items linked to area |
| `created:today` | `notes created:today` | Created today |
| `created:week` | `ideas created:week` | Created this week |

## Templates

### Project Template (`templates/project.md`)

For actionable goals with end dates.

**Key Fields**:
- `status`: active, on-hold, completed, cancelled
- `start_date`: When work began
- `target_completion`: Deadline
- `area`: Linked area of responsibility

**Sections**: Overview, Success Criteria, Objectives, Progress Log, Next Actions

### Area Template (`templates/area.md`)

For ongoing responsibilities without end dates.

**Key Fields**:
- `status`: active, inactive
- Dataview query for linked projects

**Sections**: Standards to Maintain, Current Projects, Review Questions

### Resource Template (`templates/resource.md`)

For reference materials and interests.

**Key Fields**:
- `source`: book, article, video, course, podcast, paper, web
- `author`: Content creator
- `source_url`: Original location

**Sections**: Summary, Key Insights, Progressive Summary (4 layers), Connections

### Capture Template (`templates/capture.md`)

For quick inbox captures.

**Key Fields**:
- `captured_from`: thought, conversation, article, book, video, etc.
- `resonance`: inspiring, useful, personal, surprising
- `urgency`: high, medium, low

### Daily Template (`templates/daily.md`)

For daily journaling and reflection.

**Sections**: Morning Intentions, Daily Log, Evening Reflection, Gratitude

### Weekly Review Template (`templates/weekly-review.md`)

For structured weekly reviews.

**Phases**: Brain Dump, Calendar Review, Projects, Areas, Goals, Express, Plan

## The PARA Method

PARA organizes information by **actionability**, not category:

```
01_Projects/     → Has end date, can be finished
02_Areas/        → Ongoing, no end date
03_Resources/    → Reference, topics of interest
04_Archive/      → Inactive, completed, or irrelevant
```

### Decision Tree

```
Is it actionable with an END DATE?
├── YES → 01_Projects/
└── NO → Is it an ongoing responsibility?
    ├── YES → 02_Areas/
    └── NO → Is it useful reference material?
        ├── YES → 03_Resources/
        └── NO → 04_Archive/ or Delete
```

## The CODE Method

The workflow for building a Second Brain:

### 1. Capture
Keep what **resonates**. Don't organize, just save.
- Use `/para:capture` for quick captures
- Focus on: inspiring, useful, personal, surprising

### 2. Organize
Organize for **action**, not category.
- Use `/para:process` to clear inbox
- Ask: "In what project will this be useful?"

### 3. Distill
Find the **essence**. Progressive summarization:
1. Capture raw notes
2. **Bold** important passages (10-20%)
3. ==Highlight== key insights (10% of bold)
4. Write executive summary in your words

### 4. Express
**Show your work**. Create outputs:
- Blog posts, presentations, decisions
- Reuse "Intermediate Packets" across projects
- Weekly review Phase 5 prompts creation

## Frontmatter Standards

### Universal Fields

```yaml
---
title: "Note Title"
created: 2025-01-15
type: project|area|resource|capture|daily
status: active|completed|on-hold|archived
tags: []
---
```

### Type-Specific Fields

**Projects**:
```yaml
start_date: 2025-01-15
target_completion: 2025-03-01
area: "[[Work]]"
```

**Resources**:
```yaml
source: book|article|video|course|podcast|paper|web
source_url: "https://..."
author: "Author Name"
```

**Captures**:
```yaml
captured_from: thought|conversation|article|book|video
resonance: inspiring|useful|personal|surprising
urgency: high|medium|low
```

## Best Practices

### Capture
- Capture liberally, curate ruthlessly
- Don't over-organize during capture
- Trust future you to find it

### Organize
- Process inbox within 48 hours
- When in doubt, put in Resources
- Link notes to existing knowledge

### Distill
- Progressive summarization saves future effort
- Highlight for your future self
- Add value each time you touch a note

### Express
- Completed projects go to Archive (they're achievements!)
- Create from your notes, don't just collect
- Review weekly to keep system fresh

## Dataview Integration

The templates include Dataview queries for dynamic organization:

**Projects in an Area**:
```dataview
TABLE status, target_completion
FROM "01_Projects"
WHERE contains(area, "[[Area Name]]")
```

**Active Projects**:
```dataview
TABLE status, target_completion as "Due", area
FROM "01_Projects"
WHERE status = "active"
SORT target_completion ASC
```

**Recent Resources**:
```dataview
TABLE source, author
FROM "03_Resources"
SORT created DESC
LIMIT 10
```

## Feynman's 12 Favorite Problems

Use this filter for what to capture. Maintain a list of 12 open questions:

1. How can I...?
2. What would it take to...?
3. Why does...?

When encountering new information, ask: "Does this relate to one of my 12 problems?"

## File Structure

```
para-brain/
├── .claude-plugin/
│   └── plugin.json          # Plugin metadata
├── skills/
│   └── second-brain/
│       ├── SKILL.md         # Main skill definition
│       └── reference/       # Additional reference materials
├── commands/
│   ├── capture.md           # Quick capture command
│   ├── process.md           # Inbox processing command
│   ├── create.md            # Note creation command
│   ├── review.md            # Weekly review command
│   └── search.md            # PARA-aware search command
├── templates/
│   ├── project.md           # Project template
│   ├── area.md              # Area template
│   ├── resource.md          # Resource template
│   ├── capture.md           # Inbox capture template
│   ├── daily.md             # Daily note template
│   └── weekly-review.md     # Weekly review template
└── README.md                # This file
```

## Credits

- **PARA Method**: Tiago Forte (fortelabs.com)
- **Building a Second Brain**: Tiago Forte
- **CODE Method**: Capture, Organize, Distill, Express
- **Progressive Summarization**: Tiago Forte
- **12 Favorite Problems**: Richard Feynman / Tiago Forte

## License

MIT License - See plugin.json for details.

---

**Remember**: A Second Brain's value comes from **using** it, not just collecting in it. Express, create, and ship!
