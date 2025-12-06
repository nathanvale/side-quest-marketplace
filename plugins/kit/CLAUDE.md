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
│   ├── kit-wrapper.ts         # Pure CLI wrappers
│   ├── validators.ts          # Input validation
│   ├── formatters.ts          # Output formatting
│   └── logger.ts              # LogTape correlation IDs
├── mcp/
│   └── index.ts               # 17 MCP tools (index, analysis, search, file ops)
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

- `mcp/index.ts` — 17 MCP tools (index, analysis, search, file ops)
- `src/kit-wrapper.ts` — Pure CLI wrappers for all Kit commands (core logic)
- `src/validators.ts` — Comprehensive input validation (extensive edge case coverage)
- `src/ast/searcher.ts` — Parallel AST search using tree-sitter

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

## Quick Reference: Which Tool to Use?

| Need | Tool | Speed | Example |
|------|------|-------|---------|
| **Where is X defined?** | `kit_index_find` | ~10ms | "Find executeKitGrep function" |
| **Who uses X?** | `kit_callers` / `kit_usages` | ~200ms | "Who calls executeKitGrep?" |
| **Find code by structure** | `kit_ast_search` | ~30-500ms | "Find all async functions" |
| **Find code by meaning** | `kit_semantic` | ~500ms | "How does auth work?" |
| **Show module exports/structure** | `kit_api` / `kit_file_tree` | ~50ms | "What does kit export?" |

**CRITICAL RULE:** Index tools are 30-50x faster → always try Priority 1 first, then Priority 2, only Priority 3/4 if needed.

---

## Complete Tool Reference

See @../../../docs/MCP_TOOLS.md for all 17 tools with detailed descriptions, parameters, and edge cases.

---

## Implementation Notes

- **Per-repo semantic cache** — Vector DB stored in `<repo>/.kit/vector_db/` (gitignored)
- **AST search is local** — Tree-sitter runs in-process, no subprocess overhead
- **Extensive validation** — Input validation prevents edge case failures
- **Graceful degradation** — Semantic search falls back to grep if ML unavailable

## Documentation

- **Complete tool reference:** @../../../docs/MCP_TOOLS.md
- **Architecture internals:** @./docs/ARCHITECTURE.md
- **Contributing guide:** @./docs/CONTRIBUTING.md
