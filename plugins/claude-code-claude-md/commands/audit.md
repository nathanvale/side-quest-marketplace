---
description: Audit CLAUDE.md files against Anthropic best practices (user, project, or module level)
model: claude-haiku-4-5-20251001
allowed-tools: Read, Glob, LS
argument-hint: [level] - level: user|project|module (optional, auto-detects if omitted)
---

# Audit CLAUDE.md Files

Analyze CLAUDE.md files against Anthropic's official best practices with level-specific requirements.

## Background: Anthropic's Official Guidelines

CLAUDE.md files become part of Claude's prompt, consuming tokens every session. Key principles:

1. **Keep concise** — Every line costs tokens
2. **Tune like a prompt** — Use emphasis markers ("NEVER", "YOU MUST", "IMPORTANT")
3. **Be specific** — "Use 2-space indentation" beats "Format code properly"
4. **Use @imports** — Extract sections >50 lines to modular files
5. **Front-load critical rules** — NEVER/MUST at the top

### Memory Loading Hierarchy

```
Enterprise → ~/.claude/CLAUDE.md (user) → Project root → Nested subtrees
```

## Instructions

### 1. Determine Level

Parse arguments or auto-detect:

| Location | Level | Detection |
|----------|-------|-----------|
| `~/.claude/CLAUDE.md` | **user** | Home directory |
| `./CLAUDE.md` (repo root) | **project** | Has .git sibling |
| `src/*/CLAUDE.md` | **module** | Inside src/lib/packages dir |

### 2. Apply Level-Specific Requirements

---

## USER Level (~/.claude/CLAUDE.md)

**Budget:** 50-100 lines (max 150 before split)

### Required Content
- [ ] Personal context (location, timezone, work style)
- [ ] Communication preferences
- [ ] Global NEVER/MUST rules
- [ ] @imports to context files

### Should NOT Contain
- ❌ Project-specific conventions (move to project CLAUDE.md)
- ❌ Directory structures / file trees
- ❌ Build/test commands for specific projects
- ❌ Team coding standards

### Check For
- [ ] Critical rules at TOP with emphasis markers
- [ ] Tool references use arrow notation (`Tool → \`command\``)
- [ ] Large sections extracted to `~/.claude/context/*.md`
- [ ] No duplicate info that's also in project files

---

## PROJECT Level (./CLAUDE.md)

**Budget:** 100-200 lines (max 300 before split)

### Required Content
- [ ] **Directory structure / file tree** ← Claude needs this map!
- [ ] Build, test, lint commands
- [ ] Key files with descriptions
- [ ] Coding standards for the team
- [ ] Git workflow (branch naming, commit format)

### Should NOT Contain
- ❌ Personal preferences (move to user CLAUDE.md)
- ❌ Individual communication style
- ❌ Global tool configs that apply everywhere

### Check For
- [ ] File tree present and annotated with comments
- [ ] Commands in bash code blocks
- [ ] Architecture overview (brief, not exhaustive)
- [ ] Module @imports for feature-specific context
- [ ] Custom tools/MCP servers documented

### File Tree Check

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

## MODULE Level (feature/CLAUDE.md)

**Budget:** 30-50 lines (max 100 before split)

### Required Content
- [ ] One-line module purpose
- [ ] Key files in this module
- [ ] Module-specific conventions
- [ ] Dependencies and consumers

### Should NOT Contain
- ❌ Project-wide standards (inherit from root)
- ❌ Personal preferences
- ❌ Full architecture docs

### Check For
- [ ] Focused scope (one feature/module only)
- [ ] References parent conventions, doesn't duplicate
- [ ] Test commands for this module specifically

---

## 3. Common Quality Checks (All Levels)

### Effectiveness Patterns (GOOD)

| Pattern | Example |
|---------|---------|
| Emphasis markers | "**NEVER**", "**YOU MUST**", "**IMPORTANT**" |
| Arrow notation | `Text → \`kit_grep\` \| Semantic → \`kit_semantic\`` |
| Specific directives | "Use 2-space indentation" not "Format properly" |
| Brief @import refs | `Full guide: @~/.claude/context/file.md` |
| Tables for reference | Quick lookup, decision matrices |

### Anti-Patterns (BAD)

| Anti-Pattern | Fix |
|--------------|-----|
| Verbose paragraphs (>3 sentences) | Convert to bullets |
| Vague instructions | Be specific with examples |
| Critical rules without emphasis | Add "NEVER", "YOU MUST" |
| Sections >50 lines inline | Extract to @import |
| Orphan headings (empty) | Remove or add content |
| Duplicate info across levels | Keep in one place, reference from others |

---

## 4. Generate Report

```markdown
## CLAUDE.md Audit Report

**Level:** [user | project | module]
**File:** [path]
**Lines:** X (Budget: Y-Z, Max: W)

### Level-Specific Compliance

#### Required Content
| Requirement | Status | Notes |
|-------------|--------|-------|
| [requirement 1] | ✅/❌ | [details] |
| [requirement 2] | ✅/❌ | [details] |

#### Content That Should Move
| Content | Current Location | Should Be In |
|---------|------------------|--------------|
| [item] | [this file] | [correct level] |

### Token Efficiency Score

**Overall: X/10**

| Criterion | Score | Notes |
|-----------|-------|-------|
| Structure | X/10 | Headings, bullets, tables |
| Conciseness | X/10 | No verbose explanations |
| Imports | X/10 | Modular, on-demand loading |
| Emphasis | X/10 | Critical rules marked |
| Specificity | X/10 | Actionable directives |
| Level-appropriate | X/10 | Right content for this level |

### Issues Found

#### 🔴 High Priority
- **[Issue]**: [problem]
  - Line(s): X-Y
  - Fix: [action]
  - Before: `[current]`
  - After: `[improved]`

#### 🟡 Medium Priority
...

#### 🟢 Suggestions
...

### What's Working Well
- [strength]
- [strength]
```

---

## Level-Specific Report Additions

### For PROJECT Level — File Tree Check

```markdown
### Directory Structure Audit

**Status:** ✅ Present and annotated | 🟡 Present but no annotations | 🔴 Missing

Current:
[paste current tree or note if missing]

Suggestions:
- [specific improvements]
```

### For USER Level — Cross-File Check

```markdown
### Duplication Check

| Content | Also In | Action |
|---------|---------|--------|
| [item] | [project file] | Remove from [location] |
```

### For MODULE Level — Scope Check

```markdown
### Scope Audit

**Focused:** ✅ Yes | ❌ No (contains project-wide content)

Content that belongs in parent:
- [item that should be in root CLAUDE.md]
```

---

## Output Guidelines

1. **Identify level first** — User, project, or module determines requirements
2. **Check level-specific requirements** — Each level has must-have content
3. **Flag misplaced content** — Personal prefs in project file, etc.
4. **Be specific** — Line numbers, exact text, before/after examples
5. **Prioritize by impact** — Missing file tree (project) is high priority
6. **Calculate savings** — "Moving X to user-level saves ~Y lines per project"

## Example Issues by Level

### USER Level Issue

**Problem:** Project-specific content in user file
```markdown
# In ~/.claude/CLAUDE.md (BAD)
## Build Commands
npm run build
npm test
```

**Fix:** Move to project CLAUDE.md, keep user file for personal prefs only.

### PROJECT Level Issue

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

### MODULE Level Issue

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

Now audit the CLAUDE.md file: $ARGUMENTS
