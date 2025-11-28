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
| `tsconfig.json` | strict mode, target, paths |
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

## Phase 5: Delegate to /create

Present the context and offer next steps:

```markdown
## Ready to Generate CLAUDE.md

I've gathered the following context about your project:

[Show context block from Phase 4]

---

### Next Step

Run `/create project` to generate your CLAUDE.md.

The context above will be used to populate the template with:
- ✅ Accurate directory structure
- ✅ Real commands from package.json
- ✅ Detected conventions
- ✅ Your workflow preferences

**Or I can generate it directly now.** Would you like me to:

1. **Run /create project** — Use standardized template (recommended)
2. **Generate directly** — Create CLAUDE.md right now
3. **Show context only** — Copy the context for manual use
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

## Update Mode Logic

When `--update` is passed:

### 1. Parse Existing CLAUDE.md

```typescript
// Section markers for preservation
const CUSTOM_START = "<!-- custom -->";
const CUSTOM_END = "<!-- /custom -->";

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

### 3. Custom Section Markers

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
        run: npm install -g @anthropic-ai/claude-code

      - name: Update CLAUDE.md
        env:
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
        run: claude --print "/init --ci --update"

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
```

---

Now initialize CLAUDE.md for: $ARGUMENTS
