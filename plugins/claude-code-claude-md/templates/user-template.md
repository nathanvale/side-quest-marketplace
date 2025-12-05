# User-Level CLAUDE.md Template

For: `~/.claude/CLAUDE.md`

**Budget:** 50-100 lines (max 150 before split)

---

## Template Structure

```markdown
# [Your Name]'s Claude Code Preferences

- **Location**: [City, Country] ([Timezone])
- [Key personal context that affects how you work]

---

## CRITICAL RULES — READ FIRST

**YOU MUST** follow these every time:
1. [Your core workflow requirement]
2. [Another critical rule]

### NEVER Do These

- **NEVER [critical thing to avoid]** — [why it's catastrophic]
- **NEVER [another thing]** — [consequence]

---

## Communication Style

- [How you prefer responses]
- [Formatting preferences]
- [Tone/personality notes]

**IMPORTANT**: [Key thing Claude should know about working with you]

---

## Tools & Plugins

[Tool category] → `tool_name` | [Another] → `another_tool`

Details: @~/.claude/context/[relevant-file].md

---

## Modular Context (@imports)

- [Category]: @~/.claude/context/[file].md
- [Category]: @~/.claude/context/[file].md
```

---

## Key Sections Explained

### Personal Context
Your location, timezone, work style, or ADHD/neurodivergent needs that affect how Claude should work with you.

### Critical Rules
Front-loaded NEVER/MUST directives that apply to all projects. Examples:
- **NEVER delete untracked changes**
- **YOU MUST ask before refactoring**

### Communication Style
How you prefer Claude to respond:
- Technical and concise vs. detailed explanations
- Emoji preferences
- Tone (formal, casual, peer-to-peer)

### Tools & Plugins
Reference your global MCP tools using arrow notation for conciseness:
```markdown
Search → `kit_grep` | History → `mcp__plugin_atuin_bash-history__atuin_search_history` | Git → `mcp__plugin_git_git-intelligence__git_get_status`
```

### @imports
Extract large sections (>50 lines) to modular files:
```markdown
- Git workflow: @~/.claude/context/git-workflow.md
- Search tools: @~/.claude/context/search-tools.md
- Obsidian setup: @~/.claude/context/obsidian-setup.md
```

---

## What NOT to Include

❌ Project-specific conventions (put in project CLAUDE.md)
❌ Directory structures / file trees
❌ Build/test commands for specific projects
❌ Team coding standards

Keep it personal and global.
