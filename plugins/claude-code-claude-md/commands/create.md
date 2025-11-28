---
description: Create a CLAUDE.md file from template (user, project, or module level)
model: claude-haiku-4-5-20251001
allowed-tools: Read, Write, Glob, LS
argument-hint: [type] [path] - type: user|project|module
---

# Create CLAUDE.md from Template

Create a new CLAUDE.md file using Anthropic's best practices for token efficiency and effectiveness.

## Background: Anthropic's Official Guidelines

CLAUDE.md files become part of Claude's prompt, consuming tokens every session. Key principles:

1. **Keep concise** — Every line costs tokens
2. **Tune like a prompt** — Use emphasis markers for adherence
3. **Be specific** — "Use 2-space indentation" beats "Format code properly"
4. **Use @imports** — Split large content into modular files
5. **Front-load critical rules** — NEVER/MUST at the top

### Memory Loading Hierarchy

```
Enterprise → ~/.claude/CLAUDE.md (user) → Project root → Nested subtrees
```

## Instructions

### Arguments

Parse the arguments to determine:
- **Type**: `user`, `project`, or `module`
- **Path**: Optional path for module-level files

Examples:
- `/create user` → Create `~/.claude/CLAUDE.md`
- `/create project` → Create `./CLAUDE.md`
- `/create module` → Create `./CLAUDE.md` in current directory
- `/create module src/auth` → Create `src/auth/CLAUDE.md`

### Token Budgets (IMPORTANT)

| Level | Recommended | Max Before Split | Content Focus |
|-------|-------------|------------------|---------------|
| User | 50-100 lines | 150 lines | Personal preferences, global tools |
| Project | 100-200 lines | 300 lines | Team conventions, architecture, commands |
| Module | 30-50 lines | 100 lines | Feature-specific context |

**Rule**: Section >50 lines → Extract to @import

### Content Focus by Level

**User level (~/.claude/CLAUDE.md):**
- Personal communication style
- Global MCP tools and shortcuts
- NEVER/MUST rules that apply everywhere
- @imports to personal context files

**Project level (./CLAUDE.md):**
- **Directory structure / file tree** ← Claude needs this map!
- Build, test, lint commands
- Key files with descriptions
- Coding standards for the team
- Git workflow and commit conventions
- Custom tools and MCP servers
- Module @imports

**Module level (feature/CLAUDE.md):**
- Feature-specific conventions
- Key files in this module
- Dependencies and consumers
- Module-specific test commands

### Workflow

1. **Parse arguments**:
   - First word = type (user/project/module)
   - Remaining = path (optional)

2. **Determine location**:
   | Type | Default Location |
   |------|------------------|
   | user | `~/.claude/CLAUDE.md` |
   | project | `./CLAUDE.md` |
   | module | `./CLAUDE.md` or `[path]/CLAUDE.md` |

3. **Check for existing file**:
   - If exists, STOP and inform user
   - Suggest `/audit` to review existing file
   - Do NOT overwrite without explicit request

4. **Generate template** using structure below

5. **For project-level: suggest /init alternative**:
   ```
   💡 Tip: You can also run `/init` in Claude Code to auto-generate
   a CLAUDE.md by analyzing your codebase. It detects commands,
   directories, and conventions automatically.
   ```

6. **Customize**:
   - Detect project name from package.json or directory
   - **For projects**: Generate actual file tree from directory structure
   - Replace placeholders where possible
   - Keep remaining placeholders for user

7. **Write file** and provide next steps

## Template Structures

### User Level (~/.claude/CLAUDE.md)

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

### Project Level (./CLAUDE.md)

**IMPORTANT**: For project-level files, generate an ACTUAL file tree from the directory:
```bash
# Generate tree (exclude node_modules, .git, etc.)
tree -L 2 -I 'node_modules|.git|dist|build|coverage|__pycache__' --dirsfirst
```

Then annotate key directories with comments explaining their purpose.

```markdown
# [Project Name]

[One-line description: what this project does, main tech stack]

## Directory Structure

```
[project-name]/
├── src/
│   ├── components/     # React/UI components
│   ├── api/            # API routes and handlers
│   ├── models/         # Data models / database schemas
│   ├── utils/          # Shared utilities
│   └── index.ts        # Entry point
├── tests/
│   ├── unit/           # Unit tests
│   └── e2e/            # End-to-end tests
├── docs/               # Documentation
├── scripts/            # Build and deployment scripts
└── config/             # Configuration files
```

## Commands

```bash
[package-manager] run dev      # Start dev server
[package-manager] run build    # Production build
[package-manager] run test     # Run tests
[package-manager] run lint     # Lint code
[package-manager] run typecheck # Type checking
```

## Key Files

- `src/index.ts` — Application entry point
- `src/config.ts` — Environment configuration
- `tests/conftest.py` — Test fixtures (if Python)
- `.env.example` — Required environment variables

## Architecture

[Brief description of architectural pattern: REST API, monorepo, microservices, etc.]

**Key patterns:**
- [Pattern 1]: [Where/how it's used]
- [Pattern 2]: [Where/how it's used]

## Code Standards

- [Language]: [Style guide / linter config]
- Type hints required on all functions
- Tests required for new features
- [Other team conventions]

## Git Workflow

**Branch naming:** `[type]/[ticket]-[description]`
**Commit format:** `type(scope): subject`

Types: `feat|fix|docs|refactor|test|chore`

## Custom Tools

### [Tool/MCP Server Name]
- Purpose: [What it does]
- Usage: `[command or invocation]`
- Notes: [Rate limits, restrictions, etc.]

## Module Context

- `src/auth/` → @src/auth/CLAUDE.md
- `src/api/` → @src/api/CLAUDE.md

## Notes

[Project-specific gotchas, non-obvious behaviors, or critical context]
```

### Module Level (feature/CLAUDE.md)

```markdown
# [Module Name]

[One-line purpose]

## Key Files

- `[file]` — [purpose]
- `[file]` — [purpose]

## Conventions

- [Module-specific convention]
- [Another convention]

## Dependencies

Uses: `[dependency]` | Consumed by: `[consumer]`

## Testing

`[test command for this module]`
```

## Formatting Best Practices

### Use Arrow Notation for Tool References

```markdown
# VERBOSE (avoid)
Use kit_grep for text. Use kit_semantic for natural language.

# CONDENSED (preferred)
Text → `kit_grep` | Semantic → `kit_semantic` | Structure → `kit_ast_search`
```

### Use Emphasis Markers for Critical Rules

```markdown
# WEAK (avoid)
Don't delete untracked changes.

# STRONG (preferred)
**NEVER delete untracked changes** — Catastrophic, unrecoverable
```

### Use Tables for Quick Reference

```markdown
# VERBOSE (avoid)
To build, run npm run build. To test, run npm test. To lint, run npm run lint.

# CONDENSED (preferred)
Build → `npm run build` | Test → `npm test` | Lint → `npm run lint`
```

### Use @imports for Large Sections

```markdown
# INLINE (avoid for >50 lines)
## Git Rules
[50+ lines of git rules]

# EXTRACTED (preferred)
## Git Rules

**NEVER**: `git reset --hard`, `git clean -f` — use `git stash`

Full rules: @~/.claude/context/git-workflow.md
```

## Next Steps Message

After creating, tell user based on level:

**For user-level:**
```
✅ Created ~/.claude/CLAUDE.md

**Next steps:**
1. Fill in your personal preferences and communication style
2. Add your global MCP tools and shortcuts
3. Create @import files in ~/.claude/context/ for detailed content
4. Run `/audit` when done to check optimization

**Remember:** Keep under 100 lines, extract large sections to @imports
```

**For project-level:**
```
✅ Created ./CLAUDE.md

**Next steps:**
1. Verify the directory structure is accurate
2. Fill in your team's coding standards
3. Add actual build/test/lint commands from package.json
4. Document any custom tools or MCP servers
5. Commit to version control to share with team
6. Run `/audit` when done to check optimization

**Tip:** Run `/init` to have Claude analyze your codebase and suggest improvements
```

**For module-level:**
```
✅ Created [path]/CLAUDE.md

**Next steps:**
1. List the key files in this module with descriptions
2. Document module-specific conventions
3. Add test commands for this module
4. Run `/audit` when done to check optimization
```

## Error Handling

- No arguments → Ask which type (user/project/module)
- Invalid type → Show usage: `/create [user|project|module] [path]`
- Path doesn't exist → Ask if should create it
- File exists → STOP, suggest `/audit` instead

Now create a CLAUDE.md file: $ARGUMENTS
