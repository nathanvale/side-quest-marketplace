---
description: Create a CLAUDE.md file from template (user, project, or module level)
model: claude-haiku-4-5-20251001
allowed-tools: Read, Write, Glob, LS
argument-hint: [type] [path] - type: user|project|module
---

# Create CLAUDE.md from Template

Create a CLAUDE.md file at the specified level using the appropriate template.

## Instructions

You are a CLAUDE.md creation specialist. Create a new CLAUDE.md file based on the type requested.

### Arguments

Parse the arguments to determine:
- **Type**: `user`, `project`, or `module`
- **Path**: Optional path for module-level files

Examples:
- `/create user` → Create `~/.claude/CLAUDE.md`
- `/create project` → Create `./CLAUDE.md`
- `/create module` → Create `./CLAUDE.md` in current directory as module
- `/create module src/auth` → Create `src/auth/CLAUDE.md`

### Workflow

1. **Parse arguments**:
   - First word = type (user/project/module)
   - Remaining = path (optional, defaults based on type)

2. **Determine location**:
   | Type | Default Location |
   |------|------------------|
   | user | `~/.claude/CLAUDE.md` |
   | project | `./CLAUDE.md` |
   | module | `./CLAUDE.md` or `[path]/CLAUDE.md` |

3. **Check for existing file**:
   - If file exists, STOP and inform user
   - Suggest using `/audit` to review existing file
   - Do NOT overwrite without explicit request

4. **Read appropriate template**:
   - User: `${CLAUDE_PLUGIN_ROOT}/skills/claude-md-manager/assets/templates/user-level-template.md`
   - Project: `${CLAUDE_PLUGIN_ROOT}/skills/claude-md-manager/assets/templates/project-level-template.md`
   - Module: `${CLAUDE_PLUGIN_ROOT}/skills/claude-md-manager/assets/templates/module-level-template.md`

5. **Customize template**:
   - For project/module: Try to detect project name from package.json or directory name
   - Replace placeholder text with detected values where possible
   - Keep other placeholders for user to fill in

6. **Write the file**:
   - Create parent directories if needed
   - Write the customized template
   - Report success with the file path

7. **Provide next steps**:
   - Tell user to review and customize the file
   - Suggest specific sections to fill in first
   - Mention the `/audit` command for future optimization

### Template Locations

```
${CLAUDE_PLUGIN_ROOT}/skills/claude-md-manager/assets/templates/
├── user-level-template.md
├── project-level-template.md
└── module-level-template.md
```

### Token Budgets

Remind user of recommended sizes:
- User level: 100-200 lines (personal preferences only)
- Project level: 300-500 lines (team-shared conventions)
- Module level: 50-100 lines (feature-specific context)

### Error Handling

- If type is not recognized, show usage: `/create [user|project|module] [path]`
- If path doesn't exist for module, ask if it should be created
- If no arguments provided, ask which type they want to create

Now create a CLAUDE.md file: $ARGUMENTS
