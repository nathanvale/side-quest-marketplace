---
description: Smart CLAUDE.md initialization with CI mode for automated updates
model: claude-sonnet-4-5-20250929
allowed-tools: Read, Write, Glob, LS, Bash(ls:*), Bash(cat:*), Bash(head:*), Bash(git:*), AskUserQuestion, mcp__kit__*, mcp__git-intelligence__*, mcp__bun-runner__*
argument-hint: [--ci] [--update] [path]
---

# Smart CLAUDE.md Initialization

Gather comprehensive project context using MCP tools, with CI mode for automated updates.

## Arguments

| Argument | Description |
|----------|-------------|
| `--ci` | Non-interactive mode, use detected values only |
| `--update` | Update existing CLAUDE.md, preserve custom sections |
| `--diff` | Show what would change without writing (dry run) |
| `[path]` | Project path (defaults to current directory) |

**Auto-detection:** If `CI=true` or `GITHUB_ACTIONS=true` environment variable is set, automatically enables `--ci` mode.

## Examples

```bash
# Interactive init (default)
/init

# CI mode - no questions, detection only
/init --ci

# Update existing CLAUDE.md with latest detection
/init --update

# CI + Update (for cron jobs)
/init --ci --update

# Dry run - see what would change
/init --ci --update --diff
```

## Modes

### Interactive Mode (default)
- Full MCP discovery
- Asks questions for gaps
- Confirms before writing

### CI Mode (`--ci`)
- No interactive questions
- Uses detected values + sensible defaults
- Writes directly (or shows diff with `--diff`)
- Exit codes for scripting:
  - `0` — Success, file written/updated
  - `1` — Error during detection
  - `2` — No changes detected (with `--update`)

### Update Mode (`--update`)
- Reads existing CLAUDE.md
- Preserves custom sections (marked with `<!-- custom -->`)
- Updates auto-detected sections only
- Shows diff of changes

---

## Why This Init is Different

Standard `/init` just reads README.md. This command:

1. **Interrogates the codebase** — Uses Kit for structure, Git for history
2. **Asks targeted questions** — Only what can't be auto-detected (skipped in CI)
3. **Detects patterns** — Commit style, test patterns, code conventions
4. **Supports CI/cron** — Keep CLAUDE.md fresh automatically
5. **Preserves customizations** — Update mode keeps your manual additions

## Phase 0: Mode Detection

```typescript
// Detect CI environment automatically
const isCI =
  args.includes("--ci") ||
  process.env.CI === "true" ||
  process.env.GITHUB_ACTIONS === "true" ||
  process.env.GITLAB_CI === "true" ||
  process.env.CIRCLECI === "true";

const isUpdate = args.includes("--update");
const isDryRun = args.includes("--diff");

// Behavior adjustments
if (isCI) {
  // Skip all AskUserQuestion calls
  // Use detected values or sensible defaults
  // Minimal output, structured for logs
}

if (isUpdate) {
  // Read existing CLAUDE.md first
  // Parse into sections
  // Only regenerate auto-detected sections
  // Preserve <!-- custom --> blocks
}
```

**CI Output Format:**
```
[init] Detecting project context...
[init] Found: TypeScript, Next.js, Biome, Vitest
[init] Commits: conventional (feat/fix/chore)
[init] Generating CLAUDE.md...
[init] ✓ Updated ./CLAUDE.md (3 sections changed)
```

---

## Phase 1: Automated Discovery

Run these MCP tools to gather context (parallelize where possible):

### 1.1 Directory Structure

```
Tool: kit_file_tree
Purpose: Get annotated directory structure fast (~50ms)
Extract: Top-level folders, depth-2 structure
```

**Fallback if Kit unavailable:** `ls -la` + `find . -type d -maxdepth 2`

### 1.2 Project Configuration

**Read these files (if they exist):**

| File | Extract |
|------|---------|
| `package.json` | name, description, scripts, dependencies, devDependencies |
| `tsconfig.*.json` | strict mode, target, paths |
| `biome.json` / `.eslintrc` | linting rules |
| `pyproject.toml` | Python project config |
| `Cargo.toml` | Rust project config |
| `go.mod` | Go module info |
| `.nvmrc` / `.node-version` | Node version |
| `.env.example` | Required environment variables |

### 1.3 Git Intelligence

```
Tool: git_get_recent_commits (limit: 20)
Extract:
- Commit message format (conventional? descriptive?)
- Active contributors
- Recent areas of change

Tool: git_get_branch_info
Extract:
- Branch naming pattern
- Default branch name
```

**Detect commit style:**
```
Pattern: "feat(scope): subject" → Conventional commits
Pattern: "JIRA-123: description" → Ticket-prefixed
Pattern: "Add feature X" → Descriptive
```

### 1.4 Code Patterns (Kit)

```
Tool: kit_symbols (path: "src/")
Extract:
- Main exports
- Entry points
- Key abstractions

Tool: kit_grep (pattern: "describe\\(|test\\(|it\\(")
Extract:
- Test framework (Jest, Vitest, Mocha, Bun test)
- Test file patterns
```

### 1.5 Documentation Scan

```
Tool: kit_grep (pattern: "^#|^##" in *.md files)
Extract:
- README sections
- CONTRIBUTING guidelines
- Existing architecture docs
```

---

## Phase 2: Analysis

After discovery, analyze what was found:

```markdown
## Discovery Summary

### Detected Stack
- **Language**: [TypeScript/JavaScript/Python/Rust/Go]
- **Framework**: [Next.js/Express/FastAPI/etc. or "None detected"]
- **Package Manager**: [npm/yarn/pnpm/bun/uv/cargo]
- **Test Framework**: [Jest/Vitest/pytest/etc.]
- **Linter/Formatter**: [Biome/ESLint+Prettier/ruff/etc.]

### Detected Patterns
- **Commit Style**: [Conventional/Ticket-prefixed/Descriptive]
- **Branch Pattern**: [feature/*, feat/*, JIRA-*]
- **Test Pattern**: [*.test.ts, *.spec.ts, tests/*, __tests__/*]

### Gaps (need to ask)
- [ ] [Thing that couldn't be detected]
- [ ] [Another gap]
```

---

## Phase 3: Interactive Questions

Only ask what couldn't be auto-detected. Use `AskUserQuestion` tool.

### Question Bank

**Q1: Project Type** (if not clear from structure)
```
What type of project is this?
- Web Application (frontend)
- API / Backend Service
- Full-stack Application
- CLI Tool
- Library / Package
- Monorepo
- Other: [describe]
```

**Q2: Team or Solo** (affects conventions section)
```
Is this a team project or personal?
- Team project (include team conventions)
- Personal project (lighter conventions)
```

**Q3: Code Style** (if no linter config found)
```
What code style do you follow?
- Strict TypeScript (strict: true, no any)
- Standard with some flexibility
- Follow existing patterns in codebase
- Other: [describe]
```

**Q4: Testing Approach** (if no test files found)
```
What's your testing approach?
- TDD (tests first)
- Test after implementation
- Integration tests only
- Minimal/no tests
```

**Q5: Git Workflow** (if couldn't detect from commits)
```
What's your Git workflow?
- Feature branches → PR → main
- Trunk-based (commit to main)
- Gitflow (develop, release branches)
- Other: [describe]
```

**Q6: Anything special Claude should know?**
```
Any project-specific rules or gotchas?
(e.g., "Don't modify legacy/ folder", "Always run migrations after model changes")
```

### Skip Logic

- If `tsconfig.json` has `strict: true` → Skip Q3
- If test files found → Skip Q4
- If conventional commits detected → Skip Q5 (infer workflow)
- If solo project → Simplify Q2-Q5

---

## Phase 4: Generate Context Block

Combine discovered + answered info into structured context:

```markdown
## Project Context for /create

### Project Info
- **Name**: [from package.json or directory name]
- **Description**: [from package.json or ask]
- **Type**: [detected or answered]
- **Tech Stack**: TypeScript, Next.js, Prisma, PostgreSQL

### Directory Structure
```
[project-name]/
├── src/
│   ├── app/           # Next.js app router
│   ├── components/    # React components
│   ├── lib/           # Shared utilities
│   └── server/        # Server-side code
├── prisma/            # Database schema
├── tests/             # Test files
└── docs/              # Documentation
```

### Commands
```bash
bun install            # Install dependencies
bun dev                # Start dev server (port 3000)
bun build              # Production build
bun test               # Run tests
bun lint               # Biome lint + format check
```

### Key Files
- `src/app/layout.tsx` — Root layout
- `src/lib/db.ts` — Database client
- `prisma/schema.prisma` — Database schema
- `.env.example` — Required environment variables

### Code Conventions
- TypeScript strict mode (tsconfig.json)
- Biome for linting and formatting
- Functional components with hooks
- Server actions for mutations

### Git Workflow
- **Branch**: `feat/[description]` or `fix/[description]`
- **Commits**: Conventional format `type(scope): subject`
- **PR Process**: Feature branch → Review → Squash merge

### Testing
- Framework: Vitest
- Pattern: `*.test.ts` alongside source files
- Run: `bun test`

### Special Rules
[From Q6 answers]

### Source References
- @./README.md
- @./CONTRIBUTING.md
- @./docs/architecture.md
```

---

## Phase 5: Generate CLAUDE.md

Using the context gathered, generate CLAUDE.md directly.

### Template Reference

Use the project template structure from:
@../templates/project-template.md

Follow best practices from:
@../templates/best-practices.md

Apply formatting guidelines from:
@../templates/formatting-guide.md

### Generation Logic

1. **Check if file exists**:
   ```typescript
   if (exists("./CLAUDE.md") && !args.includes("--update")) {
     // Stop and suggest /audit instead
   }
   ```

2. **Populate template** with discovered context:
   - Replace `[project-name]` with actual name
   - Insert actual directory structure from Phase 1
   - Fill in real commands from package.json
   - Add detected tech stack
   - Include detected conventions

3. **Customize based on answers**:
   - Team vs solo affects conventions section
   - Testing approach affects testing section
   - Special rules from Q6 go in Notes section

4. **Write file** (or show diff if `--diff` flag)

### Output Format

**Interactive Mode:**
```markdown
## ✅ CLAUDE.md Generated

I've created ./CLAUDE.md with:

**Auto-detected:**
- Directory structure (X directories)
- Y commands from package.json
- Tech stack: [list]
- Commit style: [conventional/other]

**From your answers:**
- [Answer 1]
- [Answer 2]

**Next steps:**
1. Review the file and customize as needed
2. Add any project-specific gotchas to the Notes section
3. Run `/audit` to check optimization
4. Commit to version control
```

**CI Mode:**
```
[init] ✓ Created ./CLAUDE.md (145 lines)
[init] Sections: Directory Structure, Commands, Tech Stack, Git Workflow
[init] Exit code: 0
```

### Update Mode (--update)

When updating existing CLAUDE.md:

1. **Read existing file**
2. **Parse sections**:
   ```typescript
   const CUSTOM_START = "<!-- custom -->";
   const CUSTOM_END = "<!-- /custom -->";

   const AUTO_SECTIONS = [
     "Directory Structure",
     "Commands",
     "Tech Stack",
     "Key Files"
   ];

   const PRESERVED_SECTIONS = [
     "CRITICAL RULES",
     "Special Rules",
     "Notes"
   ];
   ```

3. **Detect changes**:
   - Compare new auto-generated sections with existing
   - Preserve custom sections marked with `<!-- custom -->`
   - Show diff of what changed

4. **Merge and write**:
   - Update auto-generated sections
   - Keep preserved sections untouched
   - Maintain custom content

### Diff Mode (--diff)

Show what would change without writing:

```diff
--- a/CLAUDE.md
+++ b/CLAUDE.md
@@ -15,6 +15,7 @@ project/
 ├── src/
 │   ├── components/
+│   ├── hooks/          # New directory
 │   └── utils/

@@ -25,6 +26,7 @@ Commands
 bun dev               # Start dev server
 bun build             # Production build
+bun typecheck         # Type checking
```

---

## Tool Availability Check

At start, check which tools are available:

```typescript
// Check for enhanced capabilities
const hasKit = toolExists("kit_file_tree");
const hasGit = toolExists("git_get_recent_commits");
const hasBunRunner = toolExists("bun_lintCheck");

// Adjust discovery strategy
if (!hasKit) {
  // Fallback to LS + Glob for structure
}
if (!hasGit) {
  // Skip commit style detection, ask instead
}
```

---

## Example Session

```
User: /init

Claude: 🔍 Analyzing project...

[Runs kit_file_tree, reads package.json, git_get_recent_commits]

## Discovery Complete

**Detected:**
- TypeScript + Next.js 14 (App Router)
- Biome for linting
- Vitest for testing
- Conventional commits (feat/fix/chore)

**Need to confirm:**

Q1: Is this a team project or personal?
> Team project

Q2: Any special rules Claude should know?
> Don't modify anything in src/legacy/ - it's being deprecated

## Context Generated

[Shows structured context block]

Run `/create project` to generate CLAUDE.md, or say "generate" for direct output.

User: generate

Claude: [Creates CLAUDE.md with all gathered context]

✅ Created ./CLAUDE.md (145 lines)

Key sections:
- Directory structure with annotations
- 6 commands from package.json
- TypeScript strict + Biome conventions
- Conventional commit workflow
- Special rule: Don't modify src/legacy/
```

---

## Fallback Behavior

If MCP tools unavailable:

| Tool Missing | Fallback |
|--------------|----------|
| `kit_file_tree` | `ls -la` + `find . -type d -maxdepth 2` |
| `kit_symbols` | Skip, rely on file structure |
| `kit_grep` | `grep -r` via Bash |
| `git_get_recent_commits` | `git log --oneline -20` via Bash |
| `git_get_branch_info` | `git branch -a` via Bash |

The command should work (with reduced intelligence) even without MCP tools.

---

## Update Mode Logic

When `--update` is passed:

### 1. Parse Existing CLAUDE.md

```typescript
// Section markers for preservation
const CUSTOM_START = "<!-- custom -->";
const CUSTOM_END = "<!-- /custom -->";
const AUTO_MARKER = "<!-- auto-generated -->";

// Sections that get auto-updated
const AUTO_SECTIONS = [
  "Directory Structure",
  "Commands",
  "Tech Stack",
  "Key Files"
];

// Sections preserved (never auto-updated)
const PRESERVED_SECTIONS = [
  "CRITICAL RULES",
  "NEVER",
  "Special Rules",
  "Notes"
];
```

### 2. Detect Changes

```markdown
## Update Diff

**Changed sections:**
- Directory Structure: +2 files, -1 file
- Commands: +1 new script (bun run typecheck)

**Unchanged sections:**
- Tech Stack
- Key Files
- Code Conventions

**Preserved (custom) sections:**
- CRITICAL RULES (5 lines)
- Notes (3 lines)
```

### 3. Merge Strategy

```
┌─────────────────────────────────────┐
│ Existing CLAUDE.md                  │
├─────────────────────────────────────┤
│ # Project Name          ← update    │
│ ## Directory Structure  ← update    │
│ ## Commands             ← update    │
│ ## CRITICAL RULES       ← preserve  │
│ <!-- custom -->                     │
│ ## My Custom Section    ← preserve  │
│ <!-- /custom -->                    │
│ ## Key Files            ← update    │
└─────────────────────────────────────┘
```

### 4. Custom Section Markers

To protect custom content from auto-updates, wrap in markers:

```markdown
<!-- custom -->
## Special Rules

- Never modify src/legacy/ - deprecated
- Always run migrations after model changes
- Check with Nathan before major refactors

<!-- /custom -->
```

---

## Cron Job Setup

### GitHub Actions (Recommended)

```yaml
# .github/workflows/update-claude-md.yml
name: Update CLAUDE.md

on:
  schedule:
    # Run nightly at 2am UTC
    - cron: '0 2 * * *'
  workflow_dispatch: # Manual trigger

jobs:
  update:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Claude Code
        run: |
          npm install -g @anthropic-ai/claude-code

      - name: Update CLAUDE.md
        env:
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
        run: |
          claude --print "/init --ci --update"

      - name: Check for changes
        id: changes
        run: |
          if git diff --quiet CLAUDE.md; then
            echo "changed=false" >> $GITHUB_OUTPUT
          else
            echo "changed=true" >> $GITHUB_OUTPUT
          fi

      - name: Commit changes
        if: steps.changes.outputs.changed == 'true'
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git add CLAUDE.md
          git commit -m "chore: auto-update CLAUDE.md [skip ci]"
          git push
```

### Local Cron (macOS/Linux)

```bash
# Edit crontab
crontab -e

# Add nightly update at 2am
0 2 * * * cd /path/to/project && claude --print "/init --ci --update" >> /tmp/claude-md-update.log 2>&1
```

### Pre-commit Hook

```bash
#!/bin/bash
# .git/hooks/pre-commit

# Quick check if CLAUDE.md might be stale
if git diff --cached --name-only | grep -qE 'package\.json|tsconfig\.json|src/'; then
  echo "Checking if CLAUDE.md needs update..."
  claude --print "/init --ci --update --diff"
fi
```

---

## CI Defaults

When in CI mode without interactive questions, use these sensible defaults:

| Gap | CI Default |
|-----|------------|
| Project type not clear | Infer from structure (src/app → Web, src/cli → CLI) |
| Team vs solo | Assume team (include conventions) |
| Code style | Use detected linter config, or "Follow existing patterns" |
| Testing approach | Infer from test files, or "Test after implementation" |
| Git workflow | Infer from commits, or "Feature branches → PR → main" |
| Special rules | Leave section empty with TODO marker |

---

## CI Output Examples

### Successful Update

```
$ claude --print "/init --ci --update"

[init] CI mode detected (GITHUB_ACTIONS=true)
[init] Reading existing CLAUDE.md...
[init] Detecting project context...
[init]   ├─ kit_file_tree: 23 directories
[init]   ├─ package.json: 8 scripts
[init]   ├─ git_get_recent_commits: conventional commits
[init]   └─ tsconfig.json: strict mode
[init] Comparing with existing...
[init] Changes detected:
[init]   ├─ Directory Structure: +2 entries
[init]   └─ Commands: +1 script (typecheck)
[init] Writing CLAUDE.md...
[init] ✓ Updated ./CLAUDE.md
[init] Exit code: 0
```

### No Changes

```
$ claude --print "/init --ci --update"

[init] CI mode detected
[init] Detecting project context...
[init] No changes detected
[init] Exit code: 2
```

### Dry Run

```
$ claude --print "/init --ci --update --diff"

[init] CI mode detected (dry run)
[init] Detecting project context...
[init] Changes that would be made:

--- a/CLAUDE.md
+++ b/CLAUDE.md
@@ -15,6 +15,7 @@ project/
 ├── src/
 │   ├── components/
+│   ├── hooks/          # New directory
 │   └── utils/

@@ -25,6 +26,7 @@ bun dev               # Start dev server
 bun build             # Production build
 bun test              # Run tests
+bun typecheck         # Type checking

[init] Would update 2 sections
[init] Exit code: 0 (dry run, no changes written)
```

---

## Scheduling Recommendations

| Frequency | Use Case |
|-----------|----------|
| Nightly | Active development, frequent changes |
| Weekly | Stable projects, occasional updates |
| On PR merge | Keep in sync with main branch |
| Manual | When you remember / before major work |

**Tip:** Use `--diff` in PR checks to catch when CLAUDE.md is stale:

```yaml
- name: Check CLAUDE.md freshness
  run: |
    claude --print "/init --ci --update --diff" > /tmp/diff.txt
    if grep -q "Changes that would be made" /tmp/diff.txt; then
      echo "::warning::CLAUDE.md may be stale. Run '/init --update' to refresh."
    fi
```

---

Now initialize CLAUDE.md for: $ARGUMENTS
