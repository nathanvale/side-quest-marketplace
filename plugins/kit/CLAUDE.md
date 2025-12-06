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

## How to Use Kit (Quick Decision Tree)

**Question: What do you need to find?**

### 1. Finding a Symbol Definition
**"Where is the `executeKitGrep` function defined?"**
```
→ Use: kit_index_find("executeKitGrep")
→ Speed: ~10ms
→ Returns: File path + line number
→ Why: Fastest option, requires PROJECT_INDEX.json (run kit_index_prime first)
```

### 2. Finding All Uses of a Symbol
**"Who calls the `executeKitGrep` function?"** or **"Where is `UserService` used?"**
```
→ Use: kit_callers("executeKitGrep") or kit_usages("UserService")
→ Speed: ~200ms
→ Returns: All call sites with context
→ Why: Fast graph-based analysis, no timeouts
```

### 3. Finding Code by Structure
**"Find all async functions in the codebase"** or **"Show me all try-catch blocks"**
```
→ Use: kit_ast_search("async function") or kit_ast_search("try catch")
→ Speed: ~30-500ms
→ Returns: Code matches with node types and line numbers
→ Why: Structural patterns are more accurate than text search
```

### 4. Finding Code by Meaning
**"How does authentication work?"** or **"Show me error handling patterns"**
```
→ Use: kit_semantic("authentication flow logic")
→ Speed: ~500ms (slower, ML-powered)
→ Returns: Semantically similar code snippets
→ Why: Natural language search when structure/naming doesn't help
→ Note: First use requires building vector index (~10s), then cached
```

### 5. Understanding Module Structure
**"What does the kit plugin export?"** or **"Show me the structure of src/commands"**
```
→ Use: kit_api("plugins/kit/src") or kit_file_tree()
→ Speed: ~50ms
→ Returns: All exported symbols or directory structure
→ Why: Quick way to understand APIs and file layout
```

---

## Tool Priority Hierarchy (CRITICAL)

**ALWAYS follow this order:**

| Priority | Tools | Speed | When | Example |
|----------|-------|-------|------|---------|
| **1️⃣ Index** | `kit_index_find`, `kit_index_overview`, `kit_index_stats` | ~10ms | Looking up where something is defined | "Where is executeKitGrep?" |
| **2️⃣ Graph** | `kit_callers`, `kit_usages`, `kit_blast`, `kit_api` | ~200-300ms | Finding who uses something or impact analysis | "Who calls executeKitGrep?" |
| **3️⃣ Structure** | `kit_ast_search` | ~30-500ms | Finding code by structural patterns | "Find all async functions" |
| **4️⃣ Semantic** | `kit_semantic` | ~500ms+ | Finding code by meaning/intent | "How does auth work?" |

**Rule:** Index tools are 30-50x faster. Always try Priority 1 first, then Priority 2, only go to Priority 3/4 if needed.

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
