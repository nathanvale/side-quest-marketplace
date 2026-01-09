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
| `~/.claude/rules/*.md` | **user-rules** | User rules directory |
| `./CLAUDE.md` (repo root) | **project** | Has .git sibling |
| `./.claude/CLAUDE.md` | **project** | Alternative project location |
| `./.claude/rules/*.md` | **project-rules** | Project rules directory |
| `./CLAUDE.local.md` | **local** | Personal project prefs (gitignored) |
| `src/*/CLAUDE.md` | **module** | Inside src/lib/packages dir |

### 2. Apply Level-Specific Requirements

For detailed quality checks and requirements by level, see:
@../templates/quality-checks.md

For formatting best practices, see:
@../templates/formatting-guide.md

### 3. Quick Reference Summary

**Token Budgets:**
- User: 50-100 lines (max 150)
- User rules: 30-100 lines per file
- Project: 100-200 lines (max 300)
- Project rules: 30-100 lines per file
- Local: 20-50 lines
- Module: 30-50 lines (max 100)

**Key Requirements:**
- **User**: Personal prefs, global tools, @imports to context files
- **User rules**: Personal rules organized by topic in `~/.claude/rules/`
- **Project**: Directory structure (required!), commands, coding standards
- **Project rules**: Path-scoped rules with YAML frontmatter in `.claude/rules/`
- **Local**: Personal project prefs (sandbox URLs, test data) — auto-gitignored
- **Module**: One-line purpose, key files, module-specific conventions

**Common Anti-Patterns:**
- Verbose paragraphs (>3 sentences) → Convert to bullets
- Vague instructions → Be specific with examples
- Critical rules without emphasis → Add **NEVER**, **YOU MUST**
- Sections >50 lines inline → Extract to @import or `.claude/rules/`
- Duplicate info across levels → Keep in one place
- Invalid @import paths → Verify files exist
- Invalid YAML frontmatter in rules → Check `paths:` syntax

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

### For PROJECT Level — Rules Directory Check

```markdown
### Rules Directory Audit

**Location:** `.claude/rules/`
**Status:** ✅ Present | 🟡 Not present (consider for large projects) | N/A (small project)

| File | Lines | Path-Scoped | Status |
|------|-------|-------------|--------|
| [filename] | X | ✅/❌ | 🟢/🟡/🔴 |

**Path-Specific Rules Validation:**
- [ ] YAML frontmatter syntax valid
- [ ] Glob patterns valid
- [ ] Patterns not overly broad

**Suggestions:**
- [specific improvements]
```

### For USER Level — Cross-File Check

```markdown
### Duplication Check

| Content | Also In | Action |
|---------|---------|--------|
| [item] | [project file] | Remove from [location] |
```

### For LOCAL Level — Scope Check

```markdown
### Local Memory Audit

**File:** `./CLAUDE.local.md`
**Lines:** X (Budget: 20-50)
**Gitignored:** ✅ Yes | ❌ No (add to .gitignore!)

**Appropriate Content:**
- [ ] Personal sandbox URLs
- [ ] Preferred test data
- [ ] Individual shortcuts

**Misplaced Content:**
- [item that belongs in CLAUDE.md or ~/.claude/CLAUDE.md]
```

### For MODULE Level — Scope Check

```markdown
### Scope Audit

**Focused:** ✅ Yes | ❌ No (contains project-wide content)

Content that belongs in parent:
- [item that should be in root CLAUDE.md]
```

### @imports Validation

```markdown
### @imports Audit

| Import | Target | Status |
|--------|--------|--------|
| @path/to/file | [resolved path] | ✅/🔴 |

**Issues:**
- 🔴 Broken: @missing-file.md (file not found)
- 🟡 Deep nesting: 4 levels deep (max recommended: 3)
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
