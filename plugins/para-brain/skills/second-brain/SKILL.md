---
name: second-brain
description: |
  Expert on PARA method, Building a Second Brain (BASB), and Obsidian knowledge management.
  Triggers on: "para", "second brain", "obsidian", "capture", "organize", "distill", "express",
  "code method", "progressive summarization", "inbox", "projects", "areas", "resources", "archives",
  "pkm", "knowledge management", "tiago forte", "note taking", "vault", "weekly review",
  "intermediate packets", "resonance", "frontmatter", "templates", "dataview"
allowed-tools: Read, Grep, Glob, mcp__MCP_DOCKER__obsidian_*
model: sonnet
---

# Second Brain Expert - PARA + CODE Method

## Purpose

Provide expert guidance on building and maintaining a Second Brain using the PARA method for organization and CODE method for workflow. Integrates with Obsidian via MCP tools for direct vault manipulation.

## When to Invoke

Auto-activate when users mention:
- **PARA** - Projects, Areas, Resources, Archives
- **Second Brain / BASB** - Building a Second Brain methodology
- **CODE** - Capture, Organize, Distill, Express workflow
- **Obsidian** - Vault operations, notes, templates
- **PKM** - Personal Knowledge Management
- **Note operations** - Creating, searching, organizing, archiving notes

## Core Methodologies

### The PARA Method (Organization)

```
┌─────────────────────────────────────────────────────────────┐
│                    PARA HIERARCHY                           │
│                  (By Actionability)                         │
├─────────────────────────────────────────────────────────────┤
│  00_Inbox/     → Unprocessed captures (48h max)             │
│  01_Projects/  → Short-term, HAS END DATE, goal-oriented    │
│  02_Areas/     → Ongoing responsibilities, NO end date      │
│  03_Resources/ → Reference material, interests, MOCs        │
│  04_Archive/   → Completed/cancelled items                  │
│  05_Attachments/ → Media files                              │
│  06_Metadata/  → Templates & vault config                   │
└─────────────────────────────────────────────────────────────┘
```

**Key Principle**: Organize by ACTIONABILITY, not by subject.

**Project vs Area Decision**:
- Does it have an END DATE? → Project
- Is it ONGOING with no finish line? → Area

### The CODE Method (Workflow)

```
┌────────────┐    ┌────────────┐    ┌────────────┐    ┌────────────┐
│  CAPTURE   │ →  │  ORGANIZE  │ →  │  DISTILL   │ →  │  EXPRESS   │
│            │    │            │    │            │    │            │
│ Save what  │    │ Put in     │    │ Extract    │    │ Create     │
│ resonates  │    │ PARA       │    │ essence    │    │ outputs    │
└────────────┘    └────────────┘    └────────────┘    └────────────┘
```

#### 1. CAPTURE - "Save What Resonates"

Four criteria for what to save:
| Criteria | Description |
|----------|-------------|
| **Inspiring** | Quotes, stories, ideas that uplift you |
| **Useful** | Templates, processes, mental models |
| **Personal** | Experiences, reflections, success stories |
| **Surprising** | Challenges assumptions, new perspectives |

#### 2. ORGANIZE - PARA Placement

Three questions for filing:
1. What **project** would this be useful for? → 01_Projects/
2. Which **area** will this help manage? → 02_Areas/
3. Which **resource/interest** does this belong to? → 03_Resources/
4. None of the above? → Archive or delete

#### 3. DISTILL - Progressive Summarization

```
Layer 1: Original capture
Layer 2: **Bold** the important passages
Layer 3: ==Highlight== key phrases within bold
Layer 4: Write executive summary at top
Layer 5: Remix into original content
```

#### 4. EXPRESS - Create Outputs

Turn notes into:
- Blog posts, articles
- Presentations
- Projects
- Decisions
- Creative works

Use **Intermediate Packets** - your notes are building blocks.

## Vault Operations

### Using MCP Obsidian Tools

**Available tools** (prefix: `mcp__MCP_DOCKER__obsidian_`):
- `list_files_in_vault` - List root vault contents
- `list_files_in_dir` - List directory contents
- `get_file_contents` - Read a note
- `batch_get_file_contents` - Read multiple notes
- `append_content` - Add to a note
- `patch_content` - Insert at specific location
- `delete_file` - Remove a note
- `simple_search` - Text search across vault
- `complex_search` - JsonLogic query search
- `get_periodic_note` - Get daily/weekly note
- `get_recent_changes` - Recently modified files

### Creating Notes

**Always use proper frontmatter**:

```yaml
---
title: Note Title
created: YYYY-MM-DD
type: project|area|resource|capture|daily
status: inbox|active|on-hold|completed|cancelled
tags: []
---
```

### Frontmatter by Type

**Projects** (01_Projects/):
```yaml
---
title: Project Name
created: 2025-11-24
type: project
status: active
start_date: 2025-11-24
target_completion: 2025-12-24
area: "[[Parent Area]]"
tags: [project]
---
```

**Areas** (02_Areas/):
```yaml
---
title: Area Name
created: 2025-11-24
type: area
status: active
tags: [area]
---
```

**Resources** (03_Resources/):
```yaml
---
title: Resource Name
created: 2025-11-24
type: resource
source: url|book|course|video
tags: [resource]
---
```

**Inbox Captures** (00_Inbox/):
```yaml
---
title: Capture Title
created: 2025-11-24 14:30
type: capture
status: inbox
captured_from: voice|email|web|thought
resonance: inspiring|useful|personal|surprising
urgency: low|medium|high
tags: [inbox]
---
```

## Common Workflows

### Quick Capture to Inbox

```markdown
1. Create note in 00_Inbox/ with capture template
2. Add resonance tag (why saving this?)
3. Brain dump content
4. Process within 48 hours
```

### Process Inbox Item

Ask these questions:
1. **Is it actionable with an end date?** → Move to 01_Projects/
2. **Is it an ongoing responsibility?** → Move to 02_Areas/
3. **Is it reference/interest material?** → Move to 03_Resources/
4. **Is it done/no longer relevant?** → Move to 04_Archive/ or delete

### Weekly Review Checklist

```markdown
- [ ] Process all items in 00_Inbox/
- [ ] Update project statuses
- [ ] Archive completed projects
- [ ] Check target_completion dates
- [ ] Review areas for neglected responsibilities
- [ ] Distill any notes touched 3+ times
- [ ] Express: What can I create from accumulated knowledge?
```

### Create New Project

```markdown
1. Ask: Does this have a clear END DATE/GOAL?
2. Create note in 01_Projects/ with project template
3. Link to parent area: area: "[[Area Name]]"
4. Define success criteria
5. Set target_completion date
6. Add initial next actions
```

### Archive Completed Project

```markdown
1. Update status to "completed"
2. Add completion date
3. Write brief retrospective (optional)
4. Move to 04_Archive/[year]/
5. Celebrate the win!
```

## Search Strategies

### Find by Type
```
Use complex_search with JsonLogic:
{"glob": ["01_Projects/**/*.md", {"var": "path"}]}
```

### Find by Status
```
Search for "status: active" in frontmatter
```

### Find Related Notes
```
Search for wikilinks: [[Note Name]]
```

## Dataview Queries (Reference)

**List active projects**:
```dataview
TABLE status, target_completion, area
FROM "01_Projects"
WHERE status = "active"
SORT target_completion ASC
```

**Inbox items older than 48h**:
```dataview
LIST
FROM "00_Inbox"
WHERE (date(now) - date(created)).days > 2
```

**Projects by area**:
```dataview
TABLE status, target_completion
FROM "01_Projects"
WHERE contains(area, "[[YouTube Channel]]")
```

## Best Practices

### Naming Conventions

| Type | Format | Example |
|------|--------|---------|
| Projects | Title Case | `2025 Tassie Holiday` |
| Daily Notes | YYYY-MM-DD | `2025-11-24` |
| Meeting Notes | YYYY-MM-DD-topic | `2025-11-24-worksafe-sync` |
| Resources | kebab-case | `typescript-best-practices` |

### Property Naming
- Use `snake_case` for multi-word properties
- Use Obsidian link syntax: `"[[Note Name]]"` in YAML
- Lists use array format: `[item1, item2]`
- Dates always: `YYYY-MM-DD`

### Linking Strategy
- Projects link UP to their Area
- Resources link to related Areas/Projects in body
- Use wikilinks `[[Note]]` over folder hierarchy
- Let Dataview auto-display related notes

## Feynman's 12 Favorite Problems

Keep ~12 open questions you're always thinking about. Filter new information through these problems:

```markdown
## My 12 Favorite Problems

1. How can I build products that truly help people?
2. How do I maintain work-life balance with ADHD?
3. What makes an effective second brain system?
...
```

When capturing, ask: "Does this help answer one of my 12 problems?"

## Integration Tips

### Voice Capture (SuperWhisper)
- Quick captures via voice → transcribed to 00_Inbox/
- Tag with `captured_from: voice`

### Web Clipping
- Use Obsidian Web Clipper
- Auto-tag with `captured_from: web`
- Include source URL

### Reading Highlights
- Sync from Readwise/Kindle
- Progressive summarize on import
- Link to source book/article note

## Response Style

When helping with Second Brain:
- **Direct** - Solve the immediate problem first
- **PARA-aware** - Always consider correct folder placement
- **Template-focused** - Use proper frontmatter
- **Actionable** - Provide specific next steps
- **Connected** - Suggest relevant links
