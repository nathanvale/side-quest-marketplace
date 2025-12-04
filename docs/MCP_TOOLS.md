# MCP Tools Reference

Complete reference of 70+ MCP tools available across SideQuest Marketplace plugins.

---

## Kit Plugin (25 tools)

### Search Tools
- Text/semantic/AST search
- Text → `kit_grep` (~30ms, fastest for literal matches)
- Semantic → `kit_semantic` (~500ms, natural language queries)
- Structure → `kit_ast_search` (~400ms, tree-sitter patterns)

### Index Operations (PROJECT_INDEX.json)
- `kit_index_prime` — Generate/refresh index (~2s)
- `kit_index_find` — Find symbol definitions (~10ms)
- `kit_index_stats` — Codebase statistics (~10ms)
- `kit_index_overview` — File symbol listing (~10ms)

### Code Analysis
- `kit_usages` — Find all usages of a symbol (~300ms)
- `kit_callers` — Find function call sites (~200ms)
- `kit_calls` — Find function dependencies (~200ms)
- `kit_deps` — Import/export relationships (~150ms, Python/Terraform only)
- `kit_dead` — Dead code detection (~500ms)
- `kit_blast` — Blast radius analysis (~300ms)
- `kit_api` — Module public API listing (~200ms)

### File Operations
- `kit_file_tree` — Repository directory structure (~50ms)
- `kit_file_content` — Batch read multiple files (~100ms)

### Git/AI Tools
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
