# Kit Plugin

Intelligent code search via Kit CLI with text, semantic, and AST-based patterns.

---

## CRITICAL RULES

**YOU MUST** install Kit CLI before using this plugin:
```bash
uv tool install cased-kit
```

**ALWAYS** call `kit_index_prime` before using index tools (`kit_index_find`, `kit_index_overview`, `kit_index_stats`).

---

## Directory Structure

```
kit/
├── src/                       # Core library code
│   ├── ast/                   # Tree-sitter AST search engine
│   ├── kit-wrapper.ts         # Pure CLI wrappers (25KB, core logic)
│   ├── validators.ts          # Input validation (19KB)
│   ├── formatters.ts          # Output formatting
│   └── logger.ts              # LogTape correlation IDs
├── mcp-servers/kit/           # MCP server (18 tools)
├── commands/                  # Slash commands (/kit:logs, /kit:prime, etc.)
└── docs/                      # Architecture & contributing guides
```

---

## Commands

```bash
bun test --recursive       # Run tests
tsc --noEmit              # Type checking
biome check --write .     # Lint and format
```

---

## Key Files

- `mcp-servers/kit/index.ts:kit-plugin` — 18 MCP tools (search, index, analysis, file ops)
- `src/kit-wrapper.ts:30` — Pure CLI wrappers for all Kit commands (core logic)
- `src/validators.ts:1` — Comprehensive input validation (27KB of tests!)
- `src/ast/searcher.ts:1` — Parallel AST search using tree-sitter

---

## Prerequisites

```bash
# Required
uv tool install cased-kit

# Optional (for semantic search)
uv tool install 'cased-kit[ml]'
```

**Graceful degradation:** If ML unavailable, semantic search automatically falls back to grep.

---

## Testing

```bash
bun test --recursive              # All tests
bun test src/validators.test.ts   # Validation edge cases (27KB!)
bun test src/index.test.ts        # Integration tests
```

---

## MCP Tools (18 Total)

Kit provides 18 tools across 5 categories. See @../../../docs/MCP_TOOLS.md for complete reference.

**Most used:**
- `kit_grep` — Text/regex search (~30ms, fastest for literals)
- `kit_index_find` — Symbol lookup (~10ms, requires `kit_index_prime`)
- `kit_semantic` — Natural language search (~500ms, ML-powered)
- `kit_callers` — Find who calls a function (~200ms)
- `kit_file_tree` — Repository structure (~50ms)

**Tool priority:** Index-based (~10ms) → Graph+analysis (~200-300ms) → Direct search (~30-500ms)

---

## Learn More

- **MCP Tools Reference:** @../../../docs/MCP_TOOLS.md (complete tool catalog with usage patterns)
- **Architecture:** @./docs/ARCHITECTURE.md (MCP layer, semantic cache, AST search flow)
- **Contributing:** @./docs/CONTRIBUTING.md (implementation patterns, debugging tips)

---

## Notes

- **Per-repo semantic cache** — Vector DB stored in `<repo>/.kit/vector_db/` (gitignored)
- **AST search is local** — Tree-sitter runs in-process, no Kit CLI subprocess
- **Parallel AST processing** — Recent perf optimization (commit 04b89f4)
- **Extensive validation** — 27KB of edge case tests ensure robust input handling
