---
description: "[DEPRECATED] Create PARA notes - use /create-project or /create-area instead"
argument-hint: <template> <description>
allowed-tools: Bash(para-obsidian:*)
---

# Create PARA Notes (Deprecated)

> **DEPRECATED:** This command bypasses collaborative validation.
> Use the specialized commands instead for better results.

## Recommended Commands

| Instead of | Use |
|------------|-----|
| `/para-obsidian:create project ...` | `/para-obsidian:create-project` |
| `/para-obsidian:create area ...` | `/para-obsidian:create-area` |

### Why the Change?

The new skills provide:
- **Area validation** - Ensures projects link to existing areas (no broken wikilinks)
- **PARA guidance** - Validates projects have outcomes/deadlines, areas are truly ongoing
- **Collaborative workflow** - Confirms before creating, offers corrections
- **Duplicate prevention** - Checks existing areas/projects first

## Still Available (Legacy)

This command still works for quick creation or scripting:

```
/para-obsidian:create <template> <description>
```

### Examples

```
/para-obsidian:create task Book the plumber to fix the kitchen sink
/para-obsidian:create resource Article about TypeScript 5.5
/para-obsidian:create booking Flight to Sydney on March 15
```

### Templates Still Supported

| Template | Use For | Better Alternative |
|----------|---------|-------------------|
| `project` | Multi-step goals | `/para-obsidian:create-project` |
| `area` | Ongoing responsibilities | `/para-obsidian:create-area` |
| `task` | Single actionable items | (no change) |
| `resource` | Reference material | (no change) |
| `trip` | Travel planning | (no change) |
| `booking` | Reservations and tickets | (no change) |
| `capture` | Quick notes | (no change) |
| `daily` | Daily journal entry | (no change) |

---

## Instructions (Legacy Behavior)

When invoked with a template:

1. **Extract the template** from the first argument
2. **Pass everything else** as `--source-text` to the CLI

```bash
bun ${CLAUDE_PLUGIN_ROOT}/src/cli.ts create \
  --template <template> \
  --source-text "<user's description>"
```

The CLI will:
- Run LLM extraction to determine title and metadata
- Create the note with proper frontmatter
- Place it in the correct PARA folder

**Warning:** This bypasses area validation. Projects may be created with invalid area links.
