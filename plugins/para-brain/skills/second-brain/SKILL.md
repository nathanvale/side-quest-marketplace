---
name: second-brain
description: |
  Expert on PARA method, Building a Second Brain (BASB), and Obsidian knowledge management.
  Use when users mention: "para", "second brain", "obsidian", "capture", "organize", "distill", "express",
  "code method", "progressive summarization", "inbox", "projects", "areas", "resources", "archives",
  "pkm", "knowledge management", "tiago forte", "note taking", "vault", "weekly review",
  "intermediate packets", "resonance", "frontmatter", "templates", "dataview"
---

# Second Brain Expert - PARA + CODE Method

Guide users on building and maintaining a Second Brain using PARA for organization and CODE for workflow. Integrates with Obsidian via MCP tools.

## Quick Reference

| Method | Purpose | Reference |
|--------|---------|-----------|
| PARA | Organization by actionability | [para-method.md](reference/para-method.md) |
| CODE | Capture → Organize → Distill → Express | [code-method.md](reference/code-method.md) |
| Progressive Summarization | Distill notes in layers | [progressive-summarization.md](reference/progressive-summarization.md) |
| Obsidian Best Practices | Vault structure, templates, dataview | [obsidian-best-practices.md](reference/obsidian-best-practices.md) |
| Feynman 12 Problems | Filter information through open questions | [feynman-12-problems.md](reference/feynman-12-problems.md) |

## PARA Overview

```
00_Inbox/     → Unprocessed captures (48h max)
01_Projects/  → HAS END DATE, goal-oriented
02_Areas/     → Ongoing responsibilities, NO end date
03_Resources/ → Reference material, interests
04_Archive/   → Completed/cancelled items
```

**Key Decision**: Has end date? → Project. Ongoing? → Area.

## CODE Overview

1. **Capture** - Save what resonates (inspiring, useful, personal, surprising)
2. **Organize** - Place in correct PARA folder
3. **Distill** - Progressive summarization (bold → highlight → summary)
4. **Express** - Create outputs from accumulated knowledge

## MCP Obsidian Tools

Tools prefixed `mcp__MCP_DOCKER__obsidian_`:
- `list_files_in_vault` / `list_files_in_dir` - Browse vault
- `get_file_contents` / `batch_get_file_contents` - Read notes
- `append_content` / `patch_content` - Modify notes
- `simple_search` / `complex_search` - Find notes
- `get_periodic_note` / `get_recent_changes` - Daily notes & recent edits

## Common Workflows

### Quick Capture
Create note in `00_Inbox/` with capture template, add resonance tag, process within 48h.

### Process Inbox
Ask: Is it actionable with end date? → Project. Ongoing? → Area. Reference? → Resource. Done? → Archive.

### Weekly Review
Process inbox → Update projects → Archive completed → Check deadlines → Distill touched notes → Express outputs.

For detailed workflows, see [code-method.md](reference/code-method.md).

## Response Style

- **Direct** - Solve immediate problem first
- **PARA-aware** - Consider correct folder placement
- **Template-focused** - Use proper frontmatter
- **Actionable** - Provide specific next steps
