# CLAUDE.md Hierarchy and Cascade System

## Overview

CLAUDE.md files form a hierarchical cascade system where instructions flow from broader (enterprise/user) to narrower (project/module) scopes. Understanding this hierarchy is crucial for organizing your context effectively.

## The Four-Tier Hierarchy

### 1. Enterprise Policy (Highest Priority)

**Purpose**: Organization-wide policies and standards that override all other settings.

**Locations by OS**:
- **macOS**: `/Library/Application Support/ClaudeCode/CLAUDE.md`
- **Windows**: `C:\ProgramData\ClaudeCode\CLAUDE.md`
- **Linux**: `/etc/claude-code/CLAUDE.md`

**Access**: Read-only for most users, managed by system administrators.

**Typical Contents**:
- Security policies
- Compliance requirements
- Approved/prohibited dependencies
- Company coding standards
- Data handling guidelines
- Required tooling

**Example**:
```markdown
# Enterprise Development Policy

## Security Requirements
- All database connections must use SSL
- API keys must never be hardcoded
- All dependencies must pass security audit

## Required Tools
- ESLint with enterprise config
- SonarQube for code quality
- OWASP dependency check

## Prohibited
- No GPL-licensed dependencies
- No unapproved cloud services
- No inline eval() or Function()
```

### 2. Project Memory (Project-Specific)

**Purpose**: Context specific to a single codebase/repository.

**Locations**:
- `<project-root>/CLAUDE.md` (recommended)
- `<project-root>/.claude/CLAUDE.md` (alternative)

**Access**: Shared by all team members working on the project (committed to git).

**Typical Contents**:
- Tech stack and architecture
- Project conventions
- Build and test commands
- Project-specific patterns
- Repository workflow

**Sub-hierarchy**: Module-Level CLAUDE.md
- Location: `<project-root>/<module>/CLAUDE.md`
- Purpose: Module/feature-specific context
- Loads alongside project-level file

### 3. User Memory (Personal Preferences)

**Purpose**: Your personal preferences that apply across ALL projects.

**Location**: `~/.claude/CLAUDE.md`

**Access**: Private to your user account, not shared with team.

**Typical Contents**:
- Communication preferences
- Global coding style
- Preferred workflows
- Tool preferences
- Personal anti-patterns

### 4. Local Project (DEPRECATED - Don't Use)

**Location**: `<project-root>/CLAUDE.local.md`

**Status**: Deprecated in favor of user-level file.

**Why Deprecated**:
- Confusing to have both user and local
- User-level file is more consistent
- Less risk of accidentally committing personal preferences

## Loading Order and Precedence

### Load Sequence

Files are loaded in this order:
1. **Enterprise Policy** (if exists)
2. **Project Memory** (with all its imports)
3. **Module Memory** (if in a module directory)
4. **User Memory**
5. **Local Project** (deprecated, loaded last)

### Precedence Rules

**Later-loaded files CANNOT override earlier files**. The enterprise policy has highest precedence, user memory has lowest.

**Example**:
```markdown
# Enterprise: /Library/Application Support/ClaudeCode/CLAUDE.md
Use 4-space indentation for all code

# Project: /project/CLAUDE.md
Use 2-space indentation for JavaScript

# User: ~/.claude/CLAUDE.md
Use tabs for indentation
```

**Result**: Claude will use **4-space indentation** (enterprise policy wins).

### Why This Order?

- **Enterprise first**: Company policies must be enforceable
- **Project second**: Team conventions override personal preferences
- **User last**: Personal preferences are lowest priority for shared work

## Import System

### Import Syntax

```markdown
@path/to/file.md
```

- Paths are relative to the CLAUDE.md file containing the import
- Use `/` for path separators (works on all platforms)
- `.md` extension is required
- Max import depth: 5 hops

### Import Behavior

**Imports load in order**:
```markdown
# CLAUDE.md
Core content here...

@./.claude/architecture.md
@./.claude/api-reference.md
@./.claude/database.md
```

1. Core content from CLAUDE.md
2. Contents of architecture.md
3. Contents of api-reference.md
4. Contents of database.md

**Imports can import other files**:
```markdown
# CLAUDE.md
@./.claude/backend.md

# .claude/backend.md
Backend architecture overview...
@./.claude/backend/database.md
@./.claude/backend/api.md
```

This creates a cascade: CLAUDE.md → backend.md → database.md + api.md

**Maximum depth: 5 levels**:
```
CLAUDE.md (0)
  → file1.md (1)
    → file2.md (2)
      → file3.md (3)
        → file4.md (4)
          → file5.md (5)
            → file6.md (IGNORED - exceeds depth limit)
```

### Import Path Resolution

**Relative to importing file**:
```
project/
  CLAUDE.md
  .claude/
    architecture.md
    api/
      endpoints.md
```

In `CLAUDE.md`:
```markdown
@./.claude/architecture.md        # Correct
@.claude/architecture.md          # Also works (no leading ./)
```

In `.claude/architecture.md`:
```markdown
@./api/endpoints.md               # Correct (relative to .claude/)
@./.claude/api/endpoints.md       # WRONG (would look for .claude/.claude/api/)
```

## Organizing Large Projects

### Single-Module Project

```
project/
  CLAUDE.md                    # Main project context
  .claude/
    architecture.md            # Architectural details
    api-reference.md           # API documentation
    database.md                # Schema and queries
```

```markdown
# CLAUDE.md
## Quick Start
...

## Architecture
High-level overview (20-30 lines)

@./.claude/architecture.md
@./.claude/api-reference.md
@./.claude/database.md
```

### Multi-Module Monorepo

```
monorepo/
  CLAUDE.md                    # Monorepo-wide conventions
  apps/
    web/
      CLAUDE.md                # Web app specific
    mobile/
      CLAUDE.md                # Mobile app specific
  packages/
    ui/
      CLAUDE.md                # UI library specific
    api-client/
      CLAUDE.md                # API client specific
```

**Monorepo root CLAUDE.md**:
```markdown
# Monorepo

## Structure
- `apps/web`: Next.js web application
- `apps/mobile`: React Native mobile app
- `packages/ui`: Shared UI components
- `packages/api-client`: API client library

## Common Commands
bun install              # Install all dependencies
bun build                # Build all packages
bun test                 # Test all packages

## Code Conventions
- TypeScript strict mode everywhere
- Shared UI components in packages/ui
- No cross-app imports (only import packages)
```

**Module-level CLAUDE.md** (`apps/web/CLAUDE.md`):
```markdown
# Web Application

## Purpose
Customer-facing web application built with Next.js.

## Key Files
- `app/`: Next.js app router pages
- `components/`: App-specific components

## Conventions
- Use Server Components by default
- Import UI from `@repo/ui` package

## Testing
- Components: Vitest + Testing Library
- E2E: Playwright
```

### Microservices Architecture

```
project/
  CLAUDE.md                    # Overall system context
  services/
    auth-service/
      CLAUDE.md                # Auth service specifics
    api-service/
      CLAUDE.md                # API service specifics
    worker-service/
      CLAUDE.md                # Worker service specifics
  shared/
    CLAUDE.md                  # Shared code conventions
```

## Best Practices for Hierarchy

### 1. Respect the Cascade

**Don't fight the hierarchy**. If enterprise policy says "4 spaces", don't put "2 spaces" in project CLAUDE.md thinking it will override.

### 2. Right Context at Right Level

| Level | What Belongs |
|-------|--------------|
| Enterprise | Security, compliance, organization standards |
| Project | Tech stack, architecture, team conventions |
| Module | Feature-specific patterns, module scope |
| User | Personal preferences, communication style |

### 3. Use Imports for Organization

**Don't**: Create a 1000-line CLAUDE.md
**Do**: Create a concise CLAUDE.md with imports

```markdown
# CLAUDE.md (50 lines)
Brief overview and common commands

@./.claude/architecture.md      # 200 lines
@./.claude/api-reference.md     # 300 lines
@./.claude/conventions.md       # 150 lines
```

### 4. Module Files for Large Projects

When project CLAUDE.md gets large, split by module:

```markdown
# Root CLAUDE.md
Overall project context (under 300 lines)

# frontend/CLAUDE.md
Frontend-specific context (under 100 lines)

# backend/CLAUDE.md
Backend-specific context (under 100 lines)
```

### 5. Version Control Strategy

**Commit to git**:
- ✅ Project-level CLAUDE.md
- ✅ Module-level CLAUDE.md files
- ✅ All imported .md files in .claude/

**Don't commit**:
- ❌ User-level CLAUDE.md (`~/.claude/CLAUDE.md`)
- ❌ CLAUDE.local.md (deprecated anyway)

**Add to .gitignore**:
```
CLAUDE.local.md
```

## Common Patterns

### Pattern 1: Progressive Disclosure

```markdown
# CLAUDE.md
Essential quick-start info (under 100 lines)

@./.claude/detailed-docs.md
```

### Pattern 2: Module-Specific Overrides

```markdown
# Root CLAUDE.md
Default TypeScript conventions

# legacy-module/CLAUDE.md
This module uses JavaScript (no TypeScript)
Special linting rules for legacy code
```

### Pattern 3: Import Chains

```markdown
# CLAUDE.md
@./.claude/backend.md

# .claude/backend.md
Backend overview
@./backend/database.md
@./backend/api.md

# .claude/backend/database.md
Database details
```

## Troubleshooting

### Issue: Instructions Not Taking Effect

**Check load order**: Is a higher-priority file overriding your instructions?

```bash
# User file won't override project file
~/.claude/CLAUDE.md: "Use tabs"
project/CLAUDE.md: "Use spaces"
# Result: Spaces (project wins)
```

### Issue: Import Not Found

**Check relative paths**:
```markdown
# If CLAUDE.md is at project root:
@./.claude/file.md              # Looks for project/.claude/file.md ✅
@.claude/file.md                # Also works ✅
@/project/.claude/file.md       # WRONG - not absolute paths ❌
```

### Issue: Too Much Context

**Use progressive disclosure**:
- Move detailed docs to imports
- Keep main CLAUDE.md under token budget
- Split by module if still too large

### Issue: Import Depth Exceeded

**Flatten import chain**:
```markdown
# Instead of deep chain:
CLAUDE.md → a.md → b.md → c.md → d.md → e.md → f.md (too deep)

# Flatten:
CLAUDE.md → a.md
CLAUDE.md → b.md
CLAUDE.md → c.md
```
