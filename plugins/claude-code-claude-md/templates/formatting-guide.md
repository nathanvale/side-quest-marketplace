# Formatting Best Practices for CLAUDE.md

Token-efficient formatting patterns to maximize effectiveness while minimizing cost.

---

## Arrow Notation for Tool References

**Verbose (avoid):**
```markdown
Use kit_grep for text searches. Use kit_semantic for natural language queries. Use kit_ast_search for structural patterns.
```

**Condensed (preferred):**
```markdown
Text → `kit_grep` | Semantic → `kit_semantic` | Structure → `kit_ast_search`
```

**Savings:** ~40% fewer tokens

---

## Emphasis Markers for Critical Rules

**Weak (avoid):**
```markdown
Don't delete untracked changes. It's important.
```

**Strong (preferred):**
```markdown
**NEVER delete untracked changes** — Catastrophic, unrecoverable
```

**Effect:** Dramatically improves adherence

---

## Tables for Quick Reference

**Verbose (avoid):**
```markdown
To build, run npm run build. To test, run npm test. To lint, run npm run lint. To type check, run npm run typecheck.
```

**Condensed (preferred):**
```markdown
Build → `npm run build` | Test → `npm test` | Lint → `npm run lint` | Typecheck → `npm run typecheck`
```

**Savings:** ~60% fewer tokens

---

## @imports for Large Sections

**Inline (avoid for >50 lines):**
```markdown
## Git Rules

[50+ lines of git safety rules, examples, workflow documentation...]
```

**Extracted (preferred):**
```markdown
## Git Rules

**NEVER**: `git reset --hard`, `git clean -f` — Use `git stash` instead

Full rules and workflow: @~/.claude/context/git-workflow.md
```

**Savings:** ~90% token reduction (progressive disclosure)

---

## Code Blocks for Commands

**Unformatted (avoid):**
```markdown
Run bun dev to start the dev server. Run bun build to create a production build.
```

**Code blocks (preferred):**
```markdown
\`\`\`bash
bun dev     # Start dev server
bun build   # Production build
\`\`\`
```

**Effect:** Clear, scannable, copy-pasteable

---

## Bulleted Lists Over Prose

**Verbose paragraphs (avoid):**
```markdown
This project uses TypeScript in strict mode, which is configured in the tsconfig.json file. We also use Biome for linting and formatting, with the configuration stored in biome.json. All new code should include tests, and the test files should be placed alongside the source files.
```

**Bulleted (preferred):**
```markdown
- TypeScript strict mode (tsconfig.json)
- Biome for linting/formatting (biome.json)
- Tests required, placed alongside source files
```

**Savings:** ~50% fewer tokens

---

## Specific Over Vague

**Vague (avoid):**
```markdown
Format code properly. Write good tests. Use best practices.
```

**Specific (preferred):**
```markdown
- Use 2-space indentation (Biome config)
- Tests must cover happy path + error cases
- Prefer composition over inheritance
```

**Effect:** Actionable, measurable, clear expectations

---

## Front-Load Critical Rules

**Buried (avoid):**
```markdown
# Project Name

[Introduction, background, overview...]

## Architecture

[Details about architecture...]

## Important Rules

NEVER delete src/legacy/ folder.
```

**Front-loaded (preferred):**
```markdown
# Project Name

## CRITICAL RULES — READ FIRST

**NEVER delete src/legacy/** — Being deprecated, deletion breaks production

---

[Rest of content...]
```

**Effect:** Ensures critical rules are seen and followed

---

## Headings Hierarchy

Use proper heading levels:

```markdown
# Top Level (Project/User Name)

## Major Section

### Subsection

#### Detail (use sparingly)
```

**Avoid:**
- Skipping levels (# → ###)
- Orphan headings (heading with no content)
- Too many levels (>3 levels deep)

---

## Emphasis Marker Reference

| Marker | Usage | Example |
|--------|-------|---------|
| **NEVER** | Absolute prohibition | **NEVER use `any` type** |
| **YOU MUST** | Required action | **YOU MUST run tests before commit** |
| **ALWAYS** | Consistent behavior | **ALWAYS use async/await** |
| **IMPORTANT** | Key context | **IMPORTANT**: API has rate limits |

---

## Progressive Disclosure with @imports

Break large content into logical modules:

```markdown
# Main CLAUDE.md (50-100 lines)

## Git Workflow

**NEVER**: Force push to main

Full guide: @~/.claude/context/git-workflow.md

## Search Tools

Text → `kit_grep` | Semantic → `kit_semantic`

Full guide: @~/.claude/context/search-tools.md
```

**Each @import file:** 50-200 lines, focused on one topic

**Effect:**
- Main file stays scannable
- Detail loaded only when needed
- Easier to maintain modular content

---

## Decision Matrices as Tables

**Narrative (avoid):**
```markdown
If you need to search for text, use kit_grep. If you need to search semantically, use kit_semantic. If you need to find symbols, use kit_symbols. If you need structural patterns, use kit_ast_search.
```

**Table (preferred):**
```markdown
| Need | Tool |
|------|------|
| Literal text, regex | `kit_grep` |
| Natural language query | `kit_semantic` |
| Function/class definitions | `kit_symbols` |
| Code structure patterns | `kit_ast_search` |
```

**Savings:** ~50% fewer tokens, easier to scan

---

## Example Before/After

### Before (148 tokens)
```markdown
This project is a TypeScript application that uses Bun as the runtime and package manager. To start the development server, you should run the command "bun dev" in your terminal. When you want to build for production, use "bun build". If you need to run tests, use "bun test". We use Biome for linting and formatting, so you can run "bun lint" to check for issues.

For git commits, we follow the conventional commits format, which means you should prefix your commit messages with a type like "feat" for features, "fix" for bug fixes, "docs" for documentation, "refactor" for refactoring, and so on.
```

### After (61 tokens - 59% reduction!)
```markdown
**Tech**: TypeScript, Bun

**Commands**:
Dev → `bun dev` | Build → `bun build` | Test → `bun test` | Lint → `bun lint`

**Commits**: Conventional format (`feat|fix|docs|refactor`)
```

---

## Key Principles Summary

1. **Arrow notation** for tool/command references
2. **Tables** for decision matrices and quick lookups
3. **@imports** for sections >50 lines
4. **Emphasis markers** for critical rules
5. **Specific directives** over vague instructions
6. **Front-load** important rules
7. **Bullets** over prose paragraphs
8. **Code blocks** for commands

**Goal:** Maximum effectiveness, minimum tokens
