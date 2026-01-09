# Anthropic's Official CLAUDE.md Guidelines

CLAUDE.md files become part of Claude's prompt, consuming tokens every session.

## Core Principles

1. **Keep concise** — Every line costs tokens
2. **Tune like a prompt** — Use emphasis markers for adherence
3. **Be specific** — "Use 2-space indentation" beats "Format code properly"
4. **Use @imports** — Split large content into modular files
5. **Use `.claude/rules/`** — Modular, path-scoped rules for larger projects
6. **Front-load critical rules** — NEVER/MUST at the top

## Memory Loading Hierarchy

| Memory Type | Location | Shared With |
|-------------|----------|-------------|
| Enterprise policy | `/Library/Application Support/ClaudeCode/CLAUDE.md` (macOS) | All org users |
| User memory | `~/.claude/CLAUDE.md` | Just you (all projects) |
| User rules | `~/.claude/rules/*.md` | Just you (all projects) |
| Project memory | `./CLAUDE.md` or `./.claude/CLAUDE.md` | Team (via git) |
| Project rules | `./.claude/rules/*.md` | Team (via git) |
| Local memory | `./CLAUDE.local.md` | Just you (auto-gitignored) |

Claude loads files recursively from cwd up to root, and discovers nested CLAUDE.md in subtrees (loaded on-demand when reading files in those subtrees).

## Token Budgets by Level

| Level | Recommended | Max Before Split | Content Focus |
|-------|-------------|------------------|---------------|
| User | 50-100 lines | 150 lines | Personal preferences, global tools |
| Project | 100-200 lines | 300 lines | Team conventions, architecture, commands |
| Module | 30-50 lines | 100 lines | Feature-specific context |

**Rule**: Section >50 lines → Extract to @import

## Emphasis Markers for Critical Rules

Use these markers to ensure Claude follows important directives:

| Marker | Usage | Example |
|--------|-------|---------|
| **NEVER** | Absolute prohibitions | **NEVER delete untracked changes** — Catastrophic |
| **YOU MUST** | Required actions | **YOU MUST run tests before committing** |
| **IMPORTANT** | Key context | **IMPORTANT**: This API has rate limits |
| **ALWAYS** | Consistent behavior | **ALWAYS use TypeScript strict mode** |

## Content Focus by Level

### User Level (~/.claude/CLAUDE.md)
- Personal communication style
- Global MCP tools and shortcuts
- NEVER/MUST rules that apply everywhere
- @imports to personal context files

**Should NOT contain:**
- Project-specific conventions
- Directory structures / file trees
- Build/test commands for specific projects
- Team coding standards

### Project Level (./CLAUDE.md)
- **Directory structure / file tree** ← Claude needs this map!
- Build, test, lint commands
- Key files with descriptions
- Coding standards for the team
- Git workflow and commit conventions
- Custom tools and MCP servers
- Module @imports

**Should NOT contain:**
- Personal preferences
- Individual communication style
- Global tool configs that apply everywhere

### Project Rules (.claude/rules/*.md)

For larger projects, organize instructions into focused rule files:

```
.claude/rules/
├── code-style.md      # Coding standards
├── testing.md         # Test conventions
├── security.md        # Security requirements
└── frontend/
    ├── react.md       # React patterns
    └── styles.md      # CSS conventions
```

**Path-specific rules** use YAML frontmatter:
```yaml
---
paths: src/api/**/*.ts
---
# API Development Rules
- All endpoints must include input validation
- Use standard error response format
```

Rules without `paths` apply to all files. Glob patterns supported:
- `**/*.ts` — All TypeScript files
- `src/**/*` — All files under src/
- `{src,lib}/**/*.ts` — Multiple directories

### Module Level (feature/CLAUDE.md)
- Feature-specific conventions
- Key files in this module
- Dependencies and consumers
- Module-specific test commands

**Should NOT contain:**
- Project-wide standards (inherit from root)
- Personal preferences
- Full architecture docs

### Local Memory (./CLAUDE.local.md)

Personal project preferences, auto-gitignored:
- Your sandbox URLs
- Preferred test data
- Personal shortcuts for this project

## Effectiveness Patterns

### Good Patterns

| Pattern | Example |
|---------|---------|
| Emphasis markers | **NEVER**, **YOU MUST**, **IMPORTANT** |
| Arrow notation | `Text → \`kit_grep\` \| Semantic → \`kit_semantic\`` |
| Specific directives | "Use 2-space indentation" not "Format properly" |
| Brief @import refs | `Full guide: @~/.claude/context/file.md` |
| Tables for reference | Quick lookup, decision matrices |
| Code blocks for commands | ```bash<br>npm run build<br>``` |

### Anti-Patterns to Avoid

| Anti-Pattern | Fix |
|--------------|-----|
| Verbose paragraphs (>3 sentences) | Convert to bullets |
| Vague instructions | Be specific with examples |
| Critical rules without emphasis | Add **NEVER**, **YOU MUST** |
| Sections >50 lines inline | Extract to @import |
| Orphan headings (empty) | Remove or add content |
| Duplicate info across levels | Keep in one place, reference from others |

## Quick Reference: What Goes Where

| Content Type | User | Project | Module |
|--------------|------|---------|--------|
| Personal preferences | ✅ | ❌ | ❌ |
| Communication style | ✅ | ❌ | ❌ |
| Global tool configs | ✅ | ❌ | ❌ |
| Directory structure | ❌ | ✅ | ❌ |
| Build/test commands | ❌ | ✅ | (module-specific only) |
| Team coding standards | ❌ | ✅ | ❌ |
| Git workflow | ❌ | ✅ | ❌ |
| Architecture overview | ❌ | ✅ | ❌ |
| Feature-specific conventions | ❌ | ❌ | ✅ |
| Key files in module | ❌ | ❌ | ✅ |
| Module dependencies | ❌ | ❌ | ✅ |
