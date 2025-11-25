---
name: claude-md-manager
description: |
  Manages CLAUDE.md memory files across Claude Code's hierarchical cascade system. Use when users want to:
  - Create a new CLAUDE.md file (user-level at ~/.claude/, project-level, or module-level)
  - Optimize existing CLAUDE.md files for token efficiency
  - Ask about CLAUDE.md structure, hierarchy, or best practices
  - Convert existing documentation (README, wiki, CONTRIBUTING) into CLAUDE.md format
  - Reorganize large CLAUDE.md files using @imports
  - Document their project for Claude Code
  - Understand import syntax (@path/to/import) and cascade order
---

# CLAUDE.md Manager

Create, optimize, and manage CLAUDE.md files for Claude Code's memory system.

## Quick Reference

| Level | Location | Token Budget | Use For |
|-------|----------|--------------|---------|
| Enterprise | See note below | N/A | Organization-wide policies (IT-managed) |
| Project | `./CLAUDE.md` or `./.claude/CLAUDE.md` | 300-500 lines | Team-shared project conventions |
| User | `~/.claude/CLAUDE.md` | 100-200 lines | Personal preferences across all projects |
| Module | `<module>/CLAUDE.md` | 50-100 lines | Feature/module-specific context |

**Enterprise locations** (read-only, IT-managed):
- macOS: `/Library/Application Support/ClaudeCode/CLAUDE.md`
- Linux: `/etc/claude-code/CLAUDE.md`
- Windows: `C:\ProgramData\ClaudeCode\CLAUDE.md`

**Note**: `CLAUDE.local.md` is deprecated. Use `~/.claude/CLAUDE.md` or imports instead.

## Core Workflows

### Create User-Level CLAUDE.md

Location: `~/.claude/CLAUDE.md`

**Include**: Communication preferences, global code style, preferred tools, personal anti-patterns.

**Exclude**: Project-specific info, extensive documentation.

```markdown
# My Preferences

## Style
- Be concise, no emojis
- TypeScript strict mode
- Functional over OOP

## Git
- Conventional commits
- Squash merge PRs

## Tools
- Bun for packages
- Biome for linting
```

Template: [assets/templates/user-level-template.md](assets/templates/user-level-template.md)

### Create Project-Level CLAUDE.md

Location: `<project-root>/CLAUDE.md` or `<project-root>/.claude/CLAUDE.md`

**Include**: Tech stack, project structure, common commands, code conventions, testing instructions, repository workflow.

**Exclude**: Personal preferences, extensive API docs (use imports).

```markdown
# ProjectName

## Tech Stack
- Next.js 14, TypeScript, Tailwind
- Prisma + PostgreSQL

## Commands
```bash
bun install && bun dev      # Dev server
bun test                    # Run tests
bun run db:push             # Update database
```

## Conventions
- Server Components by default
- Server Actions over API routes

@./.claude/architecture.md
@./.claude/api-reference.md
```

Template: [assets/templates/project-level-template.md](assets/templates/project-level-template.md)

### Create Module-Level CLAUDE.md

Location: `<project-root>/<module>/CLAUDE.md`

**Use when**: Large monorepo, complex feature directory, microservices, project CLAUDE.md too large.

```markdown
# Auth Module

## Purpose
User authentication and session management.

## Key Files
- `auth-provider.tsx`: Auth context
- `auth-actions.ts`: Login/logout server actions
- `middleware.ts`: Route protection

## Patterns
- Lucia for sessions
- Passwords hashed with Argon2

## Testing
Mock auth: `createMockSession({ role: 'USER' })`
```

Template: [assets/templates/module-level-template.md](assets/templates/module-level-template.md)

### Optimize Existing CLAUDE.md

**When to optimize**: Exceeds token budget, scattered/redundant info, outdated content.

#### Use Imports for Long Sections

Before:
```markdown
# Project
## Architecture (200 lines)
## API Reference (300 lines)
```

After:
```markdown
# Project
## Architecture
3-tier: UI -> API -> Database

@./.claude/architecture.md
@./.claude/api-reference.md
```

#### Import Rules
- Syntax: `@path/to/file` (relative or absolute paths, `.md` extension optional)
- Max depth: 5 hops
- Imports load in order listed
- Not evaluated inside code blocks or code spans

#### Consolidation Tips
- Remove deprecated instructions
- Merge duplicate sections
- Delete verbose explanations
- Reference config files instead of duplicating rules

### Convert Documentation to CLAUDE.md

1. **Extract essential info**: Setup, commands, conventions, architecture decisions
2. **Reorganize**: Core info in main CLAUDE.md, details as imports
3. **Keep originals**: CLAUDE.md supplements README/docs, doesn't replace them

## Writing Style

- **Be imperative**: "Use 2-space indentation" not "You should use..."
- **Be specific**: "Run Prettier before commits" not "Format code properly"
- **Be concise**: Every line costs tokens
- **Show code**: Examples over explanations

## Reference Documentation

- **Hierarchy details**: [references/hierarchy.md](references/hierarchy.md)
- **Real-world examples**: [references/examples.md](references/examples.md)
- **Advanced optimization**: [references/best-practices.md](references/best-practices.md)

## Anti-Patterns

| Don't | Do |
|-------|-----|
| Exceed token budgets | Use imports for detailed docs |
| Put personal prefs in project file | Use user-level CLAUDE.md |
| Duplicate across files | Import shared content |
| Write implementation details | Document patterns and conventions |
| Include verbose explanations | Be concise and direct |
| Let CLAUDE.md become stale | Update with code changes |
