---
description: Guided weekly review of your Second Brain using PARA method
allowed-tools: mcp__MCP_DOCKER__obsidian_list_files_in_dir, mcp__MCP_DOCKER__obsidian_get_file_contents, mcp__MCP_DOCKER__obsidian_get_recent_changes, mcp__MCP_DOCKER__obsidian_get_periodic_note, mcp__MCP_DOCKER__obsidian_simple_search, mcp__MCP_DOCKER__obsidian_patch_content, AskUserQuestion
---

# Weekly Review

You guide the user through a comprehensive weekly review of their Second Brain.

## Review Process

### Phase 1: Clear the Inbox

```markdown
## Phase 1: Clear the Inbox

Let's start by processing any unprocessed items.
```

Check inbox:
```
mcp__MCP_DOCKER__obsidian_list_files_in_dir
dirpath: 00_Inbox
```

If items exist:
- Run the processing workflow for each
- Goal: Empty inbox

If empty:
- "Inbox is clear. Moving to Phase 2."

---

### Phase 2: Review Active Projects

```markdown
## Phase 2: Review Active Projects

Let's check on your active projects.
```

List projects:
```
mcp__MCP_DOCKER__obsidian_list_files_in_dir
dirpath: 01_Projects
```

For each project, present:
```markdown
### [[Project Name]]

**Status**: [status]
**Target Completion**: [date]
**Area**: [[area]]

Questions:
1. Is this still active? (y/n/archive)
2. Is it on track for the deadline?
3. What's the next action?

[Update status if needed]
```

Check for:
- **Overdue projects** (target_completion passed)
- **Stale projects** (no updates in 2+ weeks)
- **Completed projects** (should be archived)

---

### Phase 3: Review Areas

```markdown
## Phase 3: Review Areas of Responsibility

Are you maintaining your key life areas?
```

List areas:
```
mcp__MCP_DOCKER__obsidian_list_files_in_dir
dirpath: 02_Areas
```

For each area:
```markdown
### [[Area Name]]

Questions:
1. Have you given this area attention this week?
2. Are there any urgent issues?
3. Should you create a new project for this area?
```

---

### Phase 4: Check Upcoming Deadlines

```markdown
## Phase 4: Upcoming Deadlines

Projects with deadlines in the next 2 weeks:
```

Search for target_completion dates and highlight:
- **This week**: Urgent attention needed
- **Next week**: Plan time for these
- **Overdue**: Address immediately or adjust deadline

---

### Phase 5: Express & Create

```markdown
## Phase 5: Express - What Can You Create?

Review your captured knowledge:
- Any patterns emerging across notes?
- Topics you've collected a lot about?
- Ideas ready to become projects?

Potential outputs:
- [ ] Blog post about [topic]
- [ ] Decision on [issue]
- [ ] Project plan for [idea]
```

---

### Phase 6: Summary

```markdown
## Weekly Review Complete

### Statistics
- **Inbox processed**: X items
- **Active projects**: X
- **Projects completed this week**: X
- **Areas reviewed**: X

### Key Takeaways
1. [Most important insight]
2. [Action needed]
3. [Celebration/win]

### Next Week Focus
- [ ] Top priority 1
- [ ] Top priority 2
- [ ] Top priority 3

---

Great work! Your Second Brain is up to date.

Next review: [date + 7 days]
```

## Best Practices

- Schedule weekly review at the same time each week
- Allow 30-60 minutes for thorough review
- Don't skip the "Express" phase - creation is the goal
- Celebrate completed projects!
- Be ruthless about archiving stale items

---

## Lazy Migration: Validate During Review

The weekly review is an ideal time to update outdated note schemas.

**See**: [_shared/validate-note.md](_shared/validate-note.md) for schemas.

### During Each Phase

When reading projects, areas, or resources, check frontmatter against current schema:

1. **Missing `reviewed` field?** → Add it, set to today
2. **Resource missing `areas`?** → Prompt user to add
3. **Project missing `review_period`?** → Add default (7d)

### Batch Update Option

At end of Phase 2 (Projects) and Phase 3 (Areas), offer:

```markdown
### Schema Updates Available

Found X notes with outdated schemas:
- [[Resource 1]] - missing `areas`
- [[Resource 2]] - missing `areas`, `reviewed`
- [[Project 1]] - missing `reviewed`

**Update all now?** I'll prompt for any required input.
```

This lets user fix multiple notes efficiently during their natural review workflow.
