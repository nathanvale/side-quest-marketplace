---
name: claude-md-manager
description: Manages CLAUDE.md memory files across the hierarchical cascade system. Use when users want to create, optimize, or restructure their CLAUDE.md files at user, project, or module levels. Helps with token optimization, import management, and converting documentation to skills.
---

# CLAUDE.md Manager

## Overview

This skill helps you create, optimize, and manage CLAUDE.md files across Claude Code's hierarchical memory system. CLAUDE.md files provide persistent context to Claude across sessions, and this skill ensures they follow best practices for token efficiency, organization, and effectiveness.

## When to Use This Skill

Use this skill when users:
- Want to create a new CLAUDE.md file (user-level, project-level, or module-level)
- Need to optimize existing CLAUDE.md files for token usage
- Ask about CLAUDE.md structure, hierarchy, or best practices
- Want to convert existing documentation into CLAUDE.md format
- Need to reorganize large CLAUDE.md files using imports
- Ask how to document their project for Claude Code

## Core Capabilities

### 1. Create User-Level CLAUDE.md

**Purpose**: Personal preferences and global instructions that apply to ALL projects.

**Location**: `~/.claude/CLAUDE.md`

**Token Budget**: 100-200 lines maximum

**What to Include**:
- Communication preferences (tone, verbosity, emoji usage)
- Global coding style preferences
- Preferred tools and workflows
- Development conventions you always follow
- Personal anti-patterns to avoid

**What NOT to Include**:
- Project-specific information (use project-level instead)
- Extensive documentation (use imports)
- Company/team policies (use enterprise-level)

**Template Available**: Use `${CLAUDE_PLUGIN_ROOT}/skills/claude-md-manager/assets/templates/user-level-template.md`

**Example Structure**:
```markdown
# My Claude Code Preferences

## Communication Style
- Be concise and technical
- No emojis unless explicitly requested
- Explain complex decisions

## Development Workflow
- Always create CLAUDE.md for new projects
- Use conventional commits (enforced by commitlint)
- Run tests before committing

## Code Style
- TypeScript strict mode
- Functional programming preferred
- No abbreviations in variable names

## Tools
- Bun for package management
- Biome for linting/formatting
- Prefer Edit tool over sed/awk
```

### 2. Create Project-Level CLAUDE.md

**Purpose**: Project-specific context, architecture, and conventions for a single codebase.

**Location**: `<project-root>/CLAUDE.md` or `<project-root>/.claude/CLAUDE.md`

**Token Budget**: Under 500 lines (use imports for detailed docs)

**What to Include**:
- Tech stack and key dependencies
- Project structure overview
- Common bash commands (build, test, deploy)
- Code style guidelines specific to this project
- Testing instructions
- Repository conventions (branching, PRs)
- Development environment setup
- Known issues or quirks

**What NOT to Include**:
- User preferences (use user-level)
- Extensive API documentation (use imports)
- Full architectural deep-dives (use imports)

**Template Available**: Use `${CLAUDE_PLUGIN_ROOT}/skills/claude-md-manager/assets/templates/project-level-template.md`

**Example Structure**:
```markdown
# MyApp Project

## Tech Stack
- Next.js 14 (App Router)
- TypeScript 5.3
- Tailwind CSS
- Prisma ORM
- PostgreSQL

## Project Structure
\`\`\`
src/
  app/          # Next.js app router pages
  components/   # React components
  lib/          # Utilities and helpers
  server/       # Server actions
prisma/         # Database schema
\`\`\`

## Common Commands
\`\`\`bash
bun install          # Install dependencies
bun dev              # Development server
bun test             # Run tests
bun run db:push      # Update database
\`\`\`

## Code Style
- Use Server Components by default
- Add 'use client' only when needed
- Prefer Server Actions over API routes
- Keep components under 200 lines

## Testing
- Write tests for all Server Actions
- Use Testing Library for components
- Coverage goal: 80%

## Imports
@./.claude/architecture.md
@./.claude/api-reference.md
```

### 3. Create Module-Level CLAUDE.md

**Purpose**: Focused context for specific modules, features, or directories within a project.

**Location**: `<project-root>/<module>/CLAUDE.md`

**Token Budget**: Under 100 lines

**What to Include**:
- Module purpose and scope
- Key files and their responsibilities
- Module-specific patterns
- Dependencies and interactions
- Testing approach for this module

**When to Use**:
- Large monorepo with distinct modules
- Complex feature with dedicated directory
- Microservices architecture
- When project-level CLAUDE.md gets too large

**Template Available**: Use `${CLAUDE_PLUGIN_ROOT}/skills/claude-md-manager/assets/templates/module-level-template.md`

**Example Structure**:
```markdown
# Authentication Module

## Purpose
Handles user authentication, session management, and role-based access control.

## Key Files
- \`auth-provider.tsx\`: Context provider for auth state
- \`auth-actions.ts\`: Server actions for login/logout
- \`middleware.ts\`: Route protection
- \`session.ts\`: Session utilities

## Patterns
- Use Lucia for session management
- All auth routes require CSRF token
- Passwords hashed with Argon2

## Testing
- Mock auth state with \`createMockSession()\`
- Test both authenticated and unauthenticated flows
```

### 4. Optimize Existing CLAUDE.md Files

**When to Optimize**:
- File exceeds token budget (100-200 for user, 500 for project, 100 for module)
- Information is scattered or redundant
- Contains outdated or irrelevant content
- Could benefit from progressive disclosure

**Optimization Strategies**:

#### A. Use Imports for Additional Context
Instead of:
```markdown
# Project

## Architecture (200 lines)
...detailed architecture...

## API Reference (300 lines)
...detailed API docs...
```

Do this:
```markdown
# Project

## Architecture
High-level overview in 20-30 lines

## Imports
@./.claude/architecture.md
@./.claude/api-reference.md
```

**Import Rules**:
- Use `@path/to/file` syntax
- Paths relative to CLAUDE.md location
- Maximum depth: 5 hops
- Imports load in order specified
- Files can import other files (cascading)

#### B. Apply Progressive Disclosure
Start with essential information, defer details to imports:

```markdown
# Project

## Core Commands
\`\`\`bash
bun dev    # Start development
bun test   # Run tests
\`\`\`

## Architecture
We use a 3-tier architecture: API -> Service -> Repository

For detailed patterns: @./.claude/architecture.md
For database schema: @./.claude/database.md
```

#### C. Remove Outdated Content
- Delete deprecated instructions
- Remove references to removed dependencies
- Update version-specific notes
- Clean up completed TODOs

#### D. Consolidate Redundant Information
- Merge duplicate code style rules
- Combine similar sections
- Remove information covered by imports
- Eliminate verbose explanations

### 5. Convert Documentation to CLAUDE.md

**When to Convert**:
- Existing README.md contains essential context
- Wiki pages with project conventions
- CONTRIBUTING.md with development setup
- Scattered documentation in docs/ folder

**Conversion Process**:

1. **Identify Core Information**:
   - What does Claude need to know to work on this project?
   - What questions do new developers frequently ask?
   - What mistakes are commonly made?

2. **Extract and Reorganize**:
   - Take essential setup/workflow info
   - Extract code style and conventions
   - Pull out common commands
   - Note architectural decisions

3. **Create Hierarchical Structure**:
   - Core info in main CLAUDE.md
   - Detailed docs as imports
   - Module-specific info in module CLAUDE.md files

4. **Maintain Original Docs**:
   - Keep README.md for humans
   - Preserve detailed docs in docs/
   - CLAUDE.md supplements, not replaces

**Example Conversion**:

From README.md:
```markdown
# MyApp

MyApp is a web application for managing tasks...

## Installation
1. Clone the repository
2. Run `npm install`
3. Copy `.env.example` to `.env`
4. Run `npm run dev`

## Architecture
We use Next.js with the app router...
(200 more lines)
```

To CLAUDE.md:
```markdown
# MyApp

## Quick Start
\`\`\`bash
bun install
cp .env.example .env
bun dev
\`\`\`

## Tech Stack
- Next.js 14 (App Router)
- Prisma + PostgreSQL

## Code Conventions
- Server Components by default
- Use Server Actions for mutations

@./.claude/architecture.md
```

## Memory Hierarchy

CLAUDE.md files cascade in this order (higher priority first):

1. **Enterprise Policy** (read-only for users)
   - macOS: `/Library/Application Support/ClaudeCode/CLAUDE.md`
   - Windows: `C:\ProgramData\ClaudeCode\CLAUDE.md`
   - Linux: `/etc/claude-code/CLAUDE.md`

2. **Project Memory**
   - `<project-root>/CLAUDE.md` or `<project-root>/.claude/CLAUDE.md`
   - Module-level: `<project-root>/<module>/CLAUDE.md`

3. **User Memory**
   - `~/.claude/CLAUDE.md`

4. **Local Project** (DEPRECATED - don't use)
   - `<project-root>/CLAUDE.local.md`

**Loading Order**: Enterprise → Project (with imports) → User → Local

**Precedence**: Instructions in higher-priority files override lower-priority files.

## Best Practices

### Writing Style
- **Be Specific**: "Use 2-space indentation" not "Format code properly"
- **Be Imperative**: "Run tests before committing" not "You should run tests"
- **Be Concise**: Every line costs tokens
- **Use Examples**: Show, don't just tell

### Organization
- **Start with Overview**: What is this project/module?
- **Common Commands First**: Developers need these immediately
- **Use Headers**: Makes scanning easier
- **Group Related Info**: Keep code style together

### Token Optimization
- **Stay Within Budgets**: 100-200 (user), 500 (project), 100 (module)
- **Use Imports Liberally**: Don't inline large docs
- **Progressive Disclosure**: Core info first, details in imports
- **Remove Noise**: No empty sections, verbose explanations

### Maintenance
- **Update Regularly**: After major changes
- **Remove Outdated Info**: Delete deprecated instructions
- **Version Control**: Commit CLAUDE.md with code changes
- **Team Review**: Ensure conventions are accurate

## Reference Documentation

For detailed information about CLAUDE.md:
- Hierarchy and cascade system: `${CLAUDE_PLUGIN_ROOT}/skills/claude-md-manager/references/hierarchy.md`
- Real-world examples: `${CLAUDE_PLUGIN_ROOT}/skills/claude-md-manager/references/examples.md`
- Advanced optimization: `${CLAUDE_PLUGIN_ROOT}/skills/claude-md-manager/references/best-practices.md`

## Anti-Patterns to Avoid

❌ **Don't**: Create CLAUDE.md files exceeding token budgets without imports
✅ **Do**: Use imports for detailed documentation

❌ **Don't**: Put personal preferences in project CLAUDE.md
✅ **Do**: Keep personal preferences in user-level CLAUDE.md

❌ **Don't**: Duplicate information across multiple CLAUDE.md files
✅ **Do**: Reference information using imports

❌ **Don't**: Include implementation details in CLAUDE.md
✅ **Do**: Focus on conventions, patterns, and context

❌ **Don't**: Write verbose explanations
✅ **Do**: Be concise and direct

❌ **Don't**: Forget to update CLAUDE.md when project changes
✅ **Do**: Treat CLAUDE.md as living documentation
