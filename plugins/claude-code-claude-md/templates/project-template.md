# Project-Level CLAUDE.md Template

For: `./CLAUDE.md` (repository root)

**Budget:** 100-200 lines (max 300 before split)

---

## Template Structure

```markdown
# [Project Name]

[One-line description: what this project does, main tech stack]

---

## Project Overview

**Type**: [Web App / API / CLI / Library / Monorepo]
**Tech Stack**: [Language, Framework, Database, etc.]
**Purpose**: [Brief explanation of what this project does and why it exists]

---

## Directory Structure

\`\`\`
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
\`\`\`

---

## Commands

\`\`\`bash
[package-manager] install    # Install dependencies
[package-manager] run dev    # Start dev server
[package-manager] run build  # Production build
[package-manager] run test   # Run tests
[package-manager] run lint   # Lint code
[package-manager] run typecheck  # Type checking
\`\`\`

---

## Key Files

| File | Purpose |
|------|---------|
| `src/index.ts` | Application entry point |
| `src/config.ts` | Environment configuration |
| `.env.example` | Required environment variables |
| `package.json` | Dependencies and scripts |

---

## Architecture

[Brief description of architectural pattern: REST API, monorepo, microservices, etc.]

**Key patterns:**
- [Pattern 1]: [Where/how it's used]
- [Pattern 2]: [Where/how it's used]

---

## Code Standards

- **Language**: [Style guide / linter config]
- **Type hints** required on all functions
- **Tests** required for new features
- **[Specific convention]**: [Details]

---

## Git Workflow

**Branch naming:** `[type]/[description]`
**Commit format:** `type(scope): subject`

**Types**: `feat|fix|docs|refactor|test|chore`

**Process:**
1. Create feature branch from `main`
2. Make changes and commit
3. Push and create PR
4. Squash merge after approval

---

## Testing

**Framework**: [Jest / Vitest / pytest / etc.]
**Pattern**: `*.test.ts` alongside source files
**Run**: `[command to run tests]`

**Coverage goal**: [percentage or requirement]

---

## Custom Tools

### [Tool/MCP Server Name]
- **Purpose**: [What it does]
- **Usage**: `[command or invocation]`
- **Notes**: [Rate limits, restrictions, etc.]

---

## Module Context

- `src/auth/` → @src/auth/CLAUDE.md
- `src/api/` → @src/api/CLAUDE.md

---

## Notes

[Project-specific gotchas, non-obvious behaviors, or critical context]

---

## Special Rules

**NEVER**:
- [Critical thing to avoid in this project]

**ALWAYS**:
- [Required action for this project]
```

---

## Key Sections Explained

### Directory Structure (REQUIRED)

**This is the most important section.** Claude needs a map of your codebase.

Generate using:
```bash
tree -L 2 -I 'node_modules|.git|dist|build|coverage|__pycache__' --dirsfirst
```

Then **annotate** each directory with a brief comment:
```
├── src/
│   ├── components/     # React components
│   ├── hooks/          # Custom React hooks
│   └── utils/          # Shared utilities
```

### Commands

Extract from `package.json` scripts or Makefile. Use code blocks:
```bash
bun dev                # What it does
bun test               # What it does
```

### Architecture

Brief overview (2-3 sentences). Examples:
- "REST API built with Express and PostgreSQL"
- "Monorepo using Bun workspaces with 12 plugins"
- "Next.js app with App Router and Server Actions"

### Code Standards

Specific, actionable directives:
- ✅ "Use 2-space indentation (Biome config)"
- ❌ "Format code properly"

### Module @imports

For large projects, break modules into their own CLAUDE.md:
```markdown
## Module Context

- Authentication: @src/auth/CLAUDE.md
- API routes: @src/api/CLAUDE.md
```

---

## What NOT to Include

❌ Personal preferences (put in user CLAUDE.md)
❌ Individual communication style
❌ Global tool configs that apply everywhere

Keep it project-specific and team-focused.
