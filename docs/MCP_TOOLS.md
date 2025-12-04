# MCP Tools Reference

Complete reference of 70+ MCP tools available across SideQuest Marketplace plugins.

---

## Kit Plugin (25 tools)

**Efficiency Guide:** Tools listed in priority order. Index-based tools query PROJECT_INDEX.json (~10ms) and should be used first. Graph+analysis tools (~200-300ms) leverage the index for targeted operations. Direct search tools (~30-500ms) scan the entire codebase and should be used when index tools don't have the needed information.

### Priority 1: Index-Based Navigation (Fastest - Use First)

**Setup:**
- `kit_index_prime` — Generate/refresh PROJECT_INDEX.json (~2s, run once per session or after major changes)

**Query index:**
- `kit_index_find` — Find symbol definitions (~10ms, fastest way to locate functions/classes/types)
- `kit_index_overview` — List all symbols in a file (~10ms, see file structure without reading)
- `kit_index_stats` — Codebase statistics (~10ms, total files/symbols/complexity hotspots)

**File operations:**
- `kit_file_tree` — Repository directory structure (~50ms)
- `kit_file_content` — Batch read multiple files (~100ms)

### Priority 2: Graph + Analysis (Fast - Targeted Operations)

**Call graph analysis (uses index + targeted grep):**
- `kit_callers` — Find function call sites (~200ms, who calls this function?)
- `kit_usages` — Find all usages of a symbol (~300ms, comprehensive usage tracking)
- `kit_calls` — Find function dependencies (~200ms, what does this function call?)
- `kit_api` — Module public API listing (~200ms, all exported symbols)
- `kit_blast` — Blast radius analysis (~300ms, change impact)
- `kit_dead` — Dead code detection (~500ms, unused exports)

**Dependency analysis:**
- `kit_deps` — Import/export relationships (~150ms, Python/Terraform only)

### Priority 3: Direct Search (Slower - When Index Insufficient)

**Full codebase search:**
- `kit_grep` — Text/regex search (~30ms, literal pattern matching)
- `kit_ast_search` — Structural patterns (~400ms, tree-sitter AST queries)
- `kit_semantic` — Natural language queries (~500ms, ML-powered semantic search)

### Priority 4: Git/AI Automation

- `kit_commit` — AI-generated commit messages (~2s, dry_run=true by default)
- `kit_summarize` — GitHub PR summary (~3s, can update PR body)

**Dependency:** Kit CLI (`uv tool install cased-kit`)

---

## Git Plugin (7 tools)

- `git_get_recent_commits` — Recent commits with hash, message, author
- `git_search_commits` — Search commit history by message or code
- `git_get_file_history` — Commit history for specific file
- `git_get_status` — Current repository status
- `git_get_branch_info` — Branch information and tracking
- `git_get_diff_summary` — Summary of changes
- `git_get_stash_list` — List stashed changes

**Features:** MCP tools + hooks + slash commands (`/git:commit`, `/git:create-pr`, `/git:history`)

---

## Atuin Plugin (4 tools)

- `atuin_search_history` — Search bash history with filters
- `atuin_get_recent_history` — Recent command history
- `atuin_search_by_context` — Search by git branch or session
- `atuin_history_insights` — Command frequency and failure patterns

**Features:** Integrates with Atuin CLI for shell history intelligence

---

## Bun Runner (3 tools)

- `bun_runTests` — Run tests with structured failure output
- `bun_testFile` — Test specific file
- `bun_testCoverage` — Coverage reports

**Features:** Parses Bun v1.3+ test output format, hooks for auto-testing

---

## Biome Runner (3 tools)

- `biome_lintCheck` — Lint check (without fixing)
- `biome_lintFix` — Lint fix (auto-fix issues)
- `biome_formatCheck` — Format check

**Features:** Hooks for auto-check on Write/Edit operations

---

## TSC Runner (1 tool)

- `tsc_check` — TypeScript type checking (tsc --noEmit)

**Features:** Hooks for auto-check on Write/Edit operations

---

## Clipboard (2 tools)

- `mcp__plugin_clipboard_clipboard__copy` — Copy to clipboard
- `mcp__plugin_clipboard_clipboard__paste` — Paste from clipboard

---

## Tool Naming Convention

All MCP tools follow this pattern:
```
mcp__plugin_<plugin-name>_<server-name>__<tool_name>
```

Example: `mcp__plugin_git_git-intelligence__git_get_recent_commits`

**Required Parameters:**
- `response_format`: `"markdown"` (default) or `"json"`

**Error Handling:**
- Tools return `isError: true` flag in error responses
