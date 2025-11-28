---
description: Audit CLAUDE.md files against Anthropic best practices (user, project, or module level)
model: claude-haiku-4-5-20251001
allowed-tools: Read, Glob, LS
argument-hint: [level] - level: user|project|module (optional, auto-detects if omitted)
---

# Audit CLAUDE.md Files

Analyze CLAUDE.md files against Anthropic's official best practices with level-specific requirements.

## Background

For Anthropic's official guidelines and best practices, see:
@../templates/best-practices.md

## Instructions

### 1. Determine Level

Parse arguments or auto-detect:

| Location | Level | Detection |
|----------|-------|-----------|
| `~/.claude/CLAUDE.md` | **user** | Home directory |
| `./CLAUDE.md` (repo root) | **project** | Has .git sibling |
| `src/*/CLAUDE.md` | **module** | Inside src/lib/packages dir |

### 2. Apply Level-Specific Requirements

For detailed quality checks and requirements by level, see:
@../templates/quality-checks.md

For formatting best practices, see:
@../templates/formatting-guide.md

### 3. Quick Reference Summary

**Token Budgets:**
- User: 50-100 lines (max 150)
- Project: 100-200 lines (max 300)
- Module: 30-50 lines (max 100)

**Key Requirements:**
- **User**: Personal prefs, global tools, @imports to context files
- **Project**: Directory structure (required!), commands, coding standards
- **Module**: One-line purpose, key files, module-specific conventions

**Common Anti-Patterns:**
- Verbose paragraphs (>3 sentences) → Convert to bullets
- Vague instructions → Be specific with examples
- Critical rules without emphasis → Add **NEVER**, **YOU MUST**
- Sections >50 lines inline → Extract to @import
- Duplicate info across levels → Keep in one place

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

For detailed examples of common issues and fixes, see:
@../templates/quality-checks.md

Now audit the CLAUDE.md file: $ARGUMENTS
