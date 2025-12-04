# Key Plugins Overview

Detailed overview of the most important plugins in the marketplace.

---

## Kit Plugin

**Purpose:** Intelligent code search (text, semantic, AST)

**MCP Tools:** 25 tools across multiple categories
- Search: `kit_grep`, `kit_semantic`, `kit_ast_search`
- Index: `kit_index_prime`, `kit_index_find`, `kit_index_stats`, `kit_index_overview`
- Analysis: `kit_usages`, `kit_callers`, `kit_deps`, `kit_dead`, `kit_blast`, `kit_api`
- Files: `kit_file_tree`, `kit_file_content`
- Git/AI: `kit_commit`, `kit_summarize`

**Dependencies:** Kit CLI (`uv tool install cased-kit`)

**Cache:** Per-repo vector DB in `.kit/vector_db/` (for semantic search)

**Key Features:**
- PROJECT_INDEX.json for token-efficient symbol lookup
- Tree-sitter AST search (TypeScript, JavaScript, Python)
- Semantic search with ML (optional, graceful fallback)

---

## Git Plugin

**Purpose:** Git intelligence & workflow automation

**MCP Tools:** 7 tools
- `git_get_recent_commits`, `git_search_commits`, `git_get_file_history`
- `git_get_status`, `git_get_branch_info`, `git_get_diff_summary`, `git_get_stash_list`

**Hooks:**
- SessionStart (loads git context automatically)
- Stop (session summary of git activity)

**Slash Commands:**
- `/git:commit` — AI-assisted conventional commits
- `/git:create-pr` — Generate PR with summary from git history
- `/git:history` — Search commit history

**Skills:**
- `git-expert` — Git operations and workflow guidance

---

## Bun Runner

**Purpose:** Test execution integration

**MCP Tools:** 3 tools
- `bun_runTests` — Run tests with structured failure output
- `bun_testFile` — Test specific file
- `bun_testCoverage` — Coverage reports

**Hooks:**
- PreToolUse (auto-run tests after code changes)

**Notes:**
- Parses Bun v1.3+ test output format
- Workspace-aware test discovery
- Structured error reporting for failed tests

---

## Biome Runner

**Purpose:** Linting & formatting integration

**MCP Tools:** 3 tools
- `biome_lintCheck` — Check for issues without fixing
- `biome_lintFix` — Auto-fix issues (format + lint)
- `biome_formatCheck` — Check formatting only

**Hooks:**
- PreToolUse (auto-check on Write/Edit operations)

**Notes:**
- Runs both format and lint in `lintFix` tool
- Reports warnings even with exit code 0
- Uses root `biome.json` configuration

---

## TSC Runner

**Purpose:** TypeScript type checking

**MCP Tools:** 1 tool
- `tsc_check` — Run TypeScript compiler checks (tsc --noEmit)

**Hooks:**
- PreToolUse (auto-check on Write/Edit operations)

**Notes:**
- Finds nearest tsconfig.json automatically
- No-emit mode (type checking only, no compilation)
- Structured error reporting with file paths and line numbers

---

## Para-Brain / Para-Obsidian

**Purpose:** Obsidian PARA method integration

**Para-Brain:**
- Slash commands for note management
- Skills for Second Brain methodology
- Templates for Projects, Areas, Resources, Archives

**Para-Obsidian:**
- New CLI operations for Obsidian vault [ACTIVE DEVELOPMENT]
- Direct file system operations
- Frontmatter manipulation
- Auto-commit with git integration

**Notes:**
- Based on Tiago Forte's PARA method
- Integrates with Obsidian MCP server
- Supports GTD, CODE method, Progressive Summarization

---

## Atuin Plugin

**Purpose:** Bash history search and analysis

**MCP Tools:** 4 tools
- `atuin_search_history` — Search with filters (fuzzy, prefix, full-text)
- `atuin_get_recent_history` — Recent commands
- `atuin_search_by_context` — Filter by git branch or Claude session
- `atuin_history_insights` — Command frequency and failure patterns

**Hooks:**
- PostToolUse (auto-record commands with context)

**Notes:**
- Requires Atuin CLI (`brew install atuin`)
- Tracks commands with git branch and Claude session context
- Useful for "what command did I use to..." queries

---

## Clipboard Plugin

**Purpose:** System clipboard integration

**MCP Tools:** 2 tools
- `mcp__plugin_clipboard_clipboard__copy` — Copy text to clipboard
- `mcp__plugin_clipboard_clipboard__paste` — Paste text from clipboard

**Commands:**
- `/clipboard:copy` — Copy content
- `/clipboard:paste` — Paste content

**Notes:**
- Simple, reliable clipboard access
- Useful for copying code snippets or data

---

## Firecrawl Plugin

**Purpose:** Web scraping via Firecrawl API

**Commands:**
- `/firecrawl:scrape` — Scrape single URL as markdown
- `/firecrawl:search` — Search the web with content
- `/firecrawl:map` — Discover all URLs on a website
- `/firecrawl:extract` — Extract structured data using LLM

**Notes:**
- Requires Firecrawl API key
- Cleaner web scraping than raw HTML
- Useful for documentation research

---

## Plugin Template

**Purpose:** Plugin scaffolding generator

**Commands:**
- `/plugin-template:create` — Generate new plugin scaffold
- `/plugin-template:upgrade` — Add TypeScript setup to markdown-only plugin
- `/plugin-template:strip` — Convert TypeScript plugin to markdown-only

**Notes:**
- Generates proper plugin structure
- Creates plugin.json, tsconfig, package.json
- Includes MCP server templates

---

For complete marketplace catalog, see: `@../.claude-plugin/marketplace.json`
