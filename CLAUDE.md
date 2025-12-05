# SideQuest Marketplace

**ADHD-friendly Claude Code plugin marketplace** - A curated collection of plugins extending Claude Code with MCP servers, slash commands, skills, and hooks.

---

## CRITICAL RULES

**Plugin Validation (BLOCKING):**
- **YOU MUST** pass `bun run validate` before pushing (full validation)
- Pre-commit hook runs `bun run validate:quick` automatically - fix failures immediately
- CI pipeline runs full `bun run validate` - fails on any issue

**Workspace Dependencies:**
- **ALWAYS** use workspace protocol: `"dependency": "workspace:*"` for cross-plugin deps
- **ALWAYS** run `bun install` from root after adding dependencies
- **NEVER** create circular dependencies between plugins

**MCP Server Conventions:**
- Tool names: `mcp__plugin_<plugin-name>_<server-name>__<tool_name>`
- **ALWAYS** include `response_format` parameter: `"markdown"` (default) or `"json"`
- **ALWAYS** add `isError: true` flag to error responses
- **ALWAYS** use `${CLAUDE_PLUGIN_ROOT}` in `.mcp.json` for plugin-relative paths

**Temporary Files:**
- Keep experimental work in `.test-scratch` directory (gitignored)
- Never commit scratch files or testing artifacts

---

## Quick Reference

**Type:** Monorepo (Bun workspace) | **Package Manager:** Bun | **Language:** TypeScript (strict mode)
**Runtime:** Bun (Node.js v24.11.1 for compatibility) | **Linter/Formatter:** Biome | **Test Framework:** Bun test
**Commit Style:** Conventional commits (enforced by commitlint + Husky)

### Directory Structure

```
side-quest-marketplace/
├── plugins/                    # 20+ Claude Code plugins (workspace packages)
│   ├── atuin/                 # Bash history search via Atuin MCP
│   ├── biome-runner/          # Biome linting & formatting integration
│   ├── bun-runner/            # Test runner integration (Bun native)
│   ├── claude-code-claude-md/ # CLAUDE.md initialization & management
│   ├── claude-code-docs/      # Claude Code documentation lookup
│   ├── clipboard/             # System clipboard integration
│   ├── firecrawl/             # Web scraping via Firecrawl API
│   ├── git/                   # Git intelligence (MCP + hooks + skills)
│   ├── kit/                   # Kit CLI integration (25+ MCP tools)
│   ├── mcp-manager/           # MCP server management commands
│   ├── para-brain/            # Obsidian PARA method integration
│   ├── para-obsidian/         # Obsidian CLI operations [NEW]
│   ├── plugin-template/       # Plugin scaffolding generator
│   ├── scraper-toolkit/       # Playwright-based web scraping
│   ├── terminal/              # Terminal utilities (say, downloads, quarantine)
│   ├── the-cinema-bandit/     # Movie ticket price scraper [EXPERIMENTAL]
│   ├── tsc-runner/            # TypeScript type checking integration
│   └── validate-plugin/       # Plugin validation hooks
├── core/                      # Shared validation & utilities
│   └── src/validate/          # Plugin validation engine (12 validators)
├── .claude-plugin/            # Marketplace metadata (plugin.json)
├── biome.json                 # Biome linting & formatting config (root)
├── commitlint.config.js       # Conventional commits enforcement
├── tsconfig.json              # Shared TypeScript strict configuration
├── PROJECT_INDEX.json         # Kit-generated codebase index (878 symbols)
└── docs/                      # Extracted reference documentation
```

---

## Commands

**IMPORTANT:** Use MCP tools for token-efficient results. They parse output and return structured, concise summaries.

**Validation Scripts (ADHD-friendly hierarchy):**
- `bun run validate` — Full validation: typecheck + lint + test + plugin structure (~30s)
- `bun run validate:quick` — Fast check: typecheck + lint only (~5s, used in pre-commit)
- `bun run validate:plugins` — Plugin structure validation only (~2s)

**Recommended (MCP tools - token optimized):**
Test → `bun_runTests` | Test file → `bun_testFile` | Coverage → `bun_testCoverage`
Typecheck → `tsc_check` | Lint check → `biome_lintCheck` | Lint fix → `biome_lintFix`
Format check → `biome_formatCheck` | Index codebase → `/kit:prime`

**Git workflow:**
AI commit → `/git:commit` | Create PR → `/git:create-pr` | Search history → `/git:history`

**Direct bash (when MCP not needed):**
Install → `bun install` | Full validate → `bun run validate` | Quick validate → `bun run validate:quick`
Plugin-specific → `bun --filter <plugin> test` | `claude plugin validate plugins/<plugin>`

---

## Key Files

| File | Purpose |
|------|---------|
| `package.json` | Root workspace config (10 scripts, Bun workspaces) |
| `tsconfig.json` | TypeScript strict config (shared by all plugins) |
| `biome.json` | Linting & formatting rules (recommended + test overrides) |
| `commitlint.config.js` | Commit message validation (conventional commits) |
| `PROJECT_INDEX.json` | Kit-generated codebase index (878 symbols, 208 files) |
| `PLUGIN_DEV_GUIDE.md` | Plugin development guide (MCP patterns, examples) |
| `TROUBLESHOOTING.md` | Common issues & solutions |

---

## Tech Stack

- TypeScript 5.7.2 (strict mode: true, noUncheckedIndexedAccess: true)
- Bun 1.3.3 (runtime + test framework + package manager)
- Node.js v24.11.1 (compatibility, see .nvmrc)
- Biome 2.3.7 (linting/formatting, recommended rules, noNonNullAssertion: off)
- Commitlint + Husky 9.1.7 (git hooks, conventional commits)

**Plugin Architecture:** MCP servers, slash commands, skills, hooks (SessionStart, PreToolUse, PostToolUse, Stop)

---

## Code Conventions

**TypeScript:** Strict mode, no unchecked indexed access, Bun types, ESNext target
**Biome:** Recommended rules, test overrides (`noTemplateCurlyInString: off`, `noUnusedFunctionParameters: off`)
**Testing:** Bun test native, `*.test.ts` alongside source, `import { describe, expect, test } from "bun:test"`
**File Naming:** kebab-case files/dirs, `*.test.ts` for tests, `SKILL.md` for skills

---

## Git Workflow

**Format:** `<type>(<scope>): <subject>`

Types: feat, fix, docs, style, refactor, perf, test, build, ci, chore, revert
Scopes: Plugin name (`git`, `atuin`, `kit`) or `root` for workspace-level
Rules: Header max 100 chars, subject required, body/footer unlimited

**Hooks:** Pre-commit (runs `bun run validate`), Commit-msg (validates format)
**Branches:** `main` (production), `feature/*`, `fix/*`

Full workflow guide: @./docs/GIT_WORKFLOW.md

---

## Workspace Management

**Add dependencies:**
```bash
cd plugins/my-plugin && bun add <package>  # Plugin dependency
bun add -D <package>                       # Root dev dependency
bun install                                 # After adding deps (from root)
```

**Cross-plugin deps:** Use `"dependency": "workspace:*"` in package.json

**Create plugin:** `/plugin-template:create my-plugin`

**Validation:** `bun run validate` (all) or `claude plugin validate plugins/<plugin>` (single)

---

## MCP Tools Available

The marketplace provides 70+ MCP tools across plugins.

**CRITICAL for Agents:** All MCP tools are machine-to-machine interfaces. **ALWAYS use `response_format: "json"`** for token-efficient, structured responses. Never use `"markdown"` format.

### Kit Search Tool Speed Hierarchy (CRITICAL - Use in Priority Order)

**YOU MUST** follow this hierarchy for maximum token efficiency:

#### Priority 1: Index-Based Navigation (~10ms - Use First)
- **Setup:** `kit_index_prime({ response_format: "json" })` — Run once per session (~2s)
- **Query index:**
  - `kit_index_find({ symbol_name: "...", response_format: "json" })` — Fastest symbol lookup
  - `kit_index_overview({ file_path: "...", response_format: "json" })` — All symbols in file
  - `kit_index_stats({ response_format: "json" })` — Codebase statistics
  - `kit_file_tree({ response_format: "json" })` — Repository structure (~50ms)

#### Priority 2: Graph + Analysis (~200-300ms - Targeted Operations)
Use index + targeted grep:
- `kit_callers({ function_name: "...", response_format: "json" })` — Who calls this function?
- `kit_usages({ symbol: "...", response_format: "json" })` — All usages of symbol
- `kit_blast({ target: "...", response_format: "json" })` — Change impact analysis
- `kit_api({ directory: "...", response_format: "json" })` — Module exports
- `kit_dead({ response_format: "json" })` — Dead code detection (~500ms)

#### Priority 3: Direct Search (~30-500ms - When Index Insufficient)
Full codebase scan (last resort):
- `kit_grep({ pattern: "...", response_format: "json" })` — Text/regex search (~30ms)
- `kit_ast_search({ pattern: "...", response_format: "json" })` — Structural patterns (~400ms)
- `kit_semantic({ query: "...", response_format: "json" })` — ML-powered (~500ms, requires `cased-kit[ml]`)

**Rule:** Index tools are 30-50x faster. Always try Priority 1 first, then Priority 2, only fall back to Priority 3 when index tools don't have the needed information.

### Other MCP Tools

Git (7 tools) → Commits, status, branches, diff, file history (always JSON format)
Atuin (4 tools) → Bash history search, insights, context filtering (always JSON format)
Bun Runner (3 tools) → Test execution, file tests, coverage (always JSON format)
Biome Runner (3 tools) → Lint check/fix, format check (always JSON format)
TSC Runner (1 tool) → TypeScript type checking (always JSON format)
Clipboard (2 tools) → Copy/paste

**Token Efficiency:**
- Index-based tools: 30-50x faster than grep
- JSON format: 40-60% fewer tokens vs markdown
- Compound savings: These tools run constantly in hooks/background

Full reference with examples: @./docs/MCP_TOOLS.md

---

## Plugin Architecture

Standard structure: `.claude-plugin/`, `commands/`, `hooks/`, `mcp-servers/`, `skills/`, `src/`
Tool naming: `mcp__plugin_<name>_<server>__<tool>`
MCP server config: `.mcp.json` with `${CLAUDE_PLUGIN_ROOT}` paths

**Create plugin:** `/plugin-template:create my-plugin`

Full guide: @./docs/PLUGIN_ARCHITECTURE.md

---

## Codebase Statistics

From PROJECT_INDEX.json (as of latest prime):
- **Files indexed:** 208 TypeScript files
- **Total symbols:** 878
- **Distribution:** Functions 61%, Interfaces 26%, Methods 7%, Types 3%, Classes 1%, Enums 1%

**Complexity Hotspots:**
1. `plugins/kit/src` — 125 symbols (Kit CLI wrapper)
2. `plugins/para-obsidian/src` — 105 symbols (New Obsidian CLI)
3. `core/src/validate/validators` — 80 symbols (Validation engine)

---

## Development Workflow

1. **Make changes:** Work in plugin directory, write tests first (TDD) alongside code
2. **Validate locally:** `bun typecheck && bun test && bun run check && bun run validate`
3. **Commit:** `git add . && git commit -m "feat(my-plugin): add feature"` (or use `/git:commit`)
4. **Push & PR:** `git push origin main && /git:create-pr`

---

## Troubleshooting

Validation fails → `claude plugin validate plugins/<plugin>` for details
Dependencies not resolving → `bun install` from root
MCP server not loading → Check `.mcp.json` syntax, test server directly
TypeScript errors → `bun typecheck`
Tests failing → `bun test` or `bun --filter <plugin> test`

Full guide: @./TROUBLESHOOTING.md

---

## Key Plugins

Kit: Intelligent code search (text/semantic/AST), 25 tools, requires Kit CLI
Git: Intelligence & workflow automation, 7 tools, hooks, slash commands
Bun/Biome/TSC Runners: Test/lint/type-check integration with hooks
Para-Brain/Para-Obsidian: Obsidian PARA method integration

Full overview: @./docs/PLUGINS_OVERVIEW.md

---

## Resources

| Resource | Location |
|----------|----------|
| Plugin Dev Guide | @./PLUGIN_DEV_GUIDE.md |
| Troubleshooting | @./TROUBLESHOOTING.md |
| Git Workflow | @./docs/GIT_WORKFLOW.md |
| MCP Tools Reference | @./docs/MCP_TOOLS.md |
| Plugin Architecture | @./docs/PLUGIN_ARCHITECTURE.md |
| Plugins Overview | @./docs/PLUGINS_OVERVIEW.md |
| Claude Code Docs | `/claude-code-docs:help` |
| Validation Engine | core/src/validate/ |
| Example Plugins | plugins/git, plugins/kit |

---

## Notes

- **ADHD-Friendly:** Clear structure, visual hierarchy, concise sections
- **Monorepo benefits:** Shared config, cross-plugin imports, atomic commits
- **Strict validation:** Pre-commit hooks prevent broken plugins
- **MCP naming convention:** Prevents tool name collisions
- **Kit integration:** PROJECT_INDEX.json enables token-efficient queries
- **Workspace protocol:** `workspace:*` ensures plugins use local versions
- **Temporary scratch:** Use `.test-scratch/` for experiments

---

## Getting Started

1. Clone & Install → `git clone <repo> && cd side-quest-marketplace && bun install`
2. Validate Setup → `bun run ci:full`
3. Create Plugin → `/plugin-template:create my-plugin`
4. Develop & Test → `cd plugins/my-plugin && bun test`
5. Commit & Push → `git add . && git commit -m "feat(my-plugin): initial" && git push`

**For detailed guidance, see resource links above.**
