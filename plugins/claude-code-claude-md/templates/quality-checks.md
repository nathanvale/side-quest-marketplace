# Quality Checks for CLAUDE.md Files

Shared audit criteria for all levels (user, project, module).

---

## Level-Specific Required Content

### USER Level (~/.claude/CLAUDE.md)

**Budget:** 50-100 lines (max 150 before split)

**Required Content:**
- [ ] Personal context (location, timezone, work style)
- [ ] Communication preferences
- [ ] Global NEVER/MUST rules
- [ ] @imports to context files

**Should NOT Contain:**
- ❌ Project-specific conventions
- ❌ Directory structures / file trees
- ❌ Build/test commands for specific projects
- ❌ Team coding standards

**Check For:**
- [ ] Critical rules at TOP with emphasis markers
- [ ] Tool references use arrow notation (`Tool → \`command\``)
- [ ] Large sections extracted to `~/.claude/context/*.md`
- [ ] No duplicate info that's also in project files

---

### PROJECT Level (./CLAUDE.md)

**Budget:** 100-200 lines (max 300 before split)

**Required Content:**
- [ ] **Directory structure / file tree** ← Claude needs this map!
- [ ] Build, test, lint commands
- [ ] Key files with descriptions
- [ ] Coding standards for the team
- [ ] Git workflow (branch naming, commit format)

**Should NOT Contain:**
- ❌ Personal preferences
- ❌ Individual communication style
- ❌ Global tool configs that apply everywhere

**Check For:**
- [ ] File tree present and annotated with comments
- [ ] Commands in bash code blocks
- [ ] Architecture overview (brief, not exhaustive)
- [ ] Module @imports for feature-specific context
- [ ] Custom tools/MCP servers documented
- [ ] Consider `.claude/rules/` for large projects

**File Tree Check:**

**Required format:**
```
project-name/
├── src/
│   ├── components/     # Brief description
│   ├── api/            # Brief description
│   └── index.ts        # Entry point
├── tests/              # Test location
└── docs/               # Documentation
```

**Flags:**
- 🔴 Missing file tree entirely
- 🟡 File tree present but no annotations
- 🟢 File tree with descriptions

---

### PROJECT RULES Level (.claude/rules/*.md)

**Budget:** 30-100 lines per rule file

**When to Use:**
- Project has >300 lines of instructions
- Different rules apply to different file types
- Team wants modular, topic-focused rules

**Check For:**
- [ ] Each file focused on one topic
- [ ] Descriptive filenames (`testing.md`, `api-design.md`)
- [ ] Path-specific rules use YAML frontmatter correctly
- [ ] Subdirectories for related rules (e.g., `frontend/`, `backend/`)
- [ ] No duplication between rule files

**Path-Specific Rules Check:**

**Required format:**
```yaml
---
paths: src/api/**/*.ts
---
# API Rules
- Validation required on all endpoints
```

**Glob patterns:**
- `**/*.ts` — All TypeScript files
- `src/**/*` — All files under src/
- `{src,lib}/**/*.ts, tests/**/*.test.ts` — Multiple patterns

**Flags:**
- 🔴 Invalid YAML frontmatter
- 🔴 Invalid glob pattern
- 🟡 Path-specific rule with overly broad pattern
- 🟢 Well-scoped, focused rule files

---

### LOCAL MEMORY (./CLAUDE.local.md)

**Budget:** 20-50 lines

**Purpose:** Personal project preferences (auto-gitignored)

**Appropriate Content:**
- [ ] Personal sandbox URLs
- [ ] Preferred test data
- [ ] Individual workflow shortcuts
- [ ] Local environment specifics

**Should NOT Contain:**
- ❌ Team conventions (belongs in CLAUDE.md)
- ❌ Build commands (belongs in CLAUDE.md)
- ❌ Global preferences (belongs in ~/.claude/CLAUDE.md)

---

### MODULE Level (feature/CLAUDE.md)

**Budget:** 30-50 lines (max 100 before split)

**Required Content:**
- [ ] One-line module purpose
- [ ] Key files in this module
- [ ] Module-specific conventions
- [ ] Dependencies and consumers

**Should NOT Contain:**
- ❌ Project-wide standards (inherit from root)
- ❌ Personal preferences
- ❌ Full architecture docs

**Check For:**
- [ ] Focused scope (one feature/module only)
- [ ] References parent conventions, doesn't duplicate
- [ ] Test commands for this module specifically

---

## Common Quality Checks (All Levels)

### Effectiveness Patterns (GOOD)

| Pattern | Example |
|---------|---------|
| Emphasis markers | **NEVER**, **YOU MUST**, **IMPORTANT** |
| Arrow notation | `Text → \`kit_grep\` \| Semantic → \`kit_semantic\`` |
| Specific directives | "Use 2-space indentation" not "Format properly" |
| Brief @import refs | `Full guide: @~/.claude/context/file.md` |
| Tables for reference | Quick lookup, decision matrices |

### Anti-Patterns (BAD)

| Anti-Pattern | Fix |
|--------------|-----|
| Verbose paragraphs (>3 sentences) | Convert to bullets |
| Vague instructions | Be specific with examples |
| Critical rules without emphasis | Add **NEVER**, **YOU MUST** |
| Sections >50 lines inline | Extract to @import |
| Orphan headings (empty) | Remove or add content |
| Duplicate info across levels | Keep in one place, reference from others |

---

## Token Efficiency Scoring

### Structure (X/10)
- Proper headings hierarchy
- Bulleted lists for scanability
- Tables for reference data
- Code blocks for commands

### Conciseness (X/10)
- No verbose explanations
- Arrow notation for tool refs
- Tables instead of prose
- @imports for large sections

### Imports (X/10)
- Modular, on-demand loading
- No inline sections >50 lines
- Clear @import references
- Progressive disclosure

### Emphasis (X/10)
- Critical rules use **NEVER**/**MUST**
- Warnings use **IMPORTANT**
- Front-loaded (top of file)
- Clear consequences

### Specificity (X/10)
- Actionable directives
- Examples provided
- No vague instructions
- Measurable where possible

### Level-appropriate (X/10)
- Right content for this level
- No misplaced personal/project/module content
- References instead of duplication
- Proper separation of concerns

---

## Common Issues by Level

### USER Level Issues

**Problem:** Project-specific content in user file
```markdown
# In ~/.claude/CLAUDE.md (BAD)
## Build Commands
npm run build
npm test
```

**Fix:** Move to project CLAUDE.md, keep user file for personal prefs only.

---

### PROJECT Level Issues

**Problem:** Missing file tree
```markdown
# Current (BAD)
## About
This is a React app with TypeScript.

# Should be (GOOD)
## Directory Structure
\`\`\`
my-app/
├── src/
│   ├── components/    # React components
│   ├── hooks/         # Custom hooks
│   └── index.tsx      # Entry point
├── tests/             # Jest tests
└── package.json
\`\`\`
```

---

### MODULE Level Issues

**Problem:** Duplicating project-wide standards
```markdown
# In src/auth/CLAUDE.md (BAD)
## Code Standards
- Use TypeScript strict mode
- Use Biome for formatting
- Write tests for all functions

# Should be (GOOD)
# Auth Module

Handles user authentication and session management.

## Key Files
- `auth.ts` — Main auth logic
- `session.ts` — Session management
- `types.ts` — Auth-related types

## Module-Specific Notes
- JWT tokens expire after 24h
- Refresh tokens stored in httpOnly cookies
```

---

## Duplication Check

Content that appears in multiple CLAUDE.md files should be consolidated:

| Content | Also In | Action |
|---------|---------|--------|
| [item] | [other file] | Remove from [location], keep in [correct level] |

Examples:
- Personal communication style in project file → Remove, keep in user file
- Project-wide git workflow in module file → Remove, reference parent
- Directory structure in user file → Remove, keep in project file

---

## @imports Syntax Check

**Valid @import patterns:**
```markdown
See @README for project overview
Full guide: @docs/git-instructions.md
Personal prefs: @~/.claude/my-project.md
```

**Check For:**
- [ ] Relative paths resolve correctly
- [ ] Absolute paths use `~` for home directory
- [ ] @imports not inside code blocks (ignored there)
- [ ] Max depth of 5 hops for recursive imports
- [ ] No circular import chains

**Flags:**
- 🔴 @import to non-existent file
- 🔴 Circular import chain
- 🟡 Deep nesting (>3 levels)
- 🟢 Clean, shallow import structure
