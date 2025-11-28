# Kit Plugin for Claude Code

Integrates the Kit CLI (cased-kit) with Claude Code via MCP server, providing intelligent code search through text, semantic, and AST-based pattern matching.

## Directory Structure

```
kit/
├── src/                       # Core library code
│   ├── ast/                   # Tree-sitter AST search engine
│   │   ├── languages.ts       # Language detection & parser init
│   │   ├── pattern.ts         # AST pattern matching logic
│   │   ├── searcher.ts        # Parallel AST search implementation
│   │   └── types.ts           # AST search types
│   ├── kit-wrapper.ts         # Pure functions for Kit CLI execution
│   ├── errors.ts              # KitError types & detection
│   ├── types.ts               # Shared type definitions
│   ├── validators.ts          # Input validation for all tools
│   ├── formatters.ts          # Output formatting (markdown/JSON)
│   ├── logger.ts              # LogTape-based logging with correlation IDs
│   └── index.ts               # Public exports
├── mcp-servers/kit/           # MCP server implementation
│   ├── index.ts               # 8 MCP tools exposing Kit functionality
│   └── package.json           # MCP server dependencies
├── hooks/                     # Plugin hooks
│   └── hooks.json             # Hook configuration
├── commands/                  # Slash commands
│   └── logs.md                # /kit:logs command
├── .claude-plugin/            # Plugin metadata
├── .mcp.json                  # MCP server config
└── package.json               # Dependencies
```

## Commands

```bash
bun test --recursive       # Run tests
tsc --noEmit              # Type checking
biome format --write .    # Format code
biome lint .              # Lint code
biome check --write .     # Lint and format
```

## Key Files

- `mcp-servers/kit/index.ts` — MCP server with 8 tools (grep, semantic, AST, symbols, etc.)
- `src/kit-wrapper.ts` — Pure CLI wrappers for all Kit commands (25KB, core logic)
- `src/ast/searcher.ts` — Parallel AST search using tree-sitter (TS/JS/Python)
- `src/logger.ts` — LogTape logger with correlation IDs for request tracing
- `src/validators.ts` — Comprehensive input validation (19KB)

## MCP Tools (8 Total)

| Tool | Purpose | Speed | Fallback |
|------|---------|-------|----------|
| `kit_grep` | Text/regex search across files | ~30ms | — |
| `kit_semantic` | Natural language vector search | ~500ms | → grep if ML unavailable |
| `kit_symbols` | Extract functions/classes/types | ~200ms | — |
| `kit_usages` | Find where symbols are used | ~300ms | — |
| `kit_ast_search` | Structural code patterns (tree-sitter) | ~400ms | — |
| `kit_file_tree` | Repository directory structure | ~50ms | — |
| `kit_file_content` | Batch read multiple files | ~100ms | — |

## Architecture

**MCP Layer** → Validates inputs, calls kit-wrapper functions, formats output

**Kit Wrapper** → Executes Kit CLI via `spawnSync`, parses JSON, handles errors

**Kit CLI** → Rust tool (cased-kit) doing actual file I/O, parsing, indexing

**Semantic Search Flow:**
1. Check if ML dependencies installed (`search-semantic` command)
2. Create/use cached vector index in `~/.cache/kit/vector_db/<repo-hash>/`
3. Execute Kit CLI with `--persist-dir` pointing to cache
4. If ML unavailable → fallback to grep with keyword extraction
5. Return semantic matches with relevance scores

**AST Search (Tree-sitter):**
- Supports TypeScript, JavaScript, Python
- Two modes: **simple** (natural language like "async function") or **pattern** (JSON criteria)
- Parallel file processing using async fs operations
- Direct tree-sitter WASM parsing (no Kit CLI dependency)

## Code Standards

- **TypeScript strict mode** — Full type safety
- **Functional core** — Pure functions in kit-wrapper.ts, side effects in MCP layer
- **Error types** — Custom `KitError` enum with 8 error types
- **Correlation IDs** — Every operation gets unique ID for log tracing
- **Biome formatting** — Tab indentation, consistent style

## Key Features

### Semantic Search Cache Management
```typescript
// Per-repo cache: Each repository gets its own .kit/vector_db/
getSemanticCacheDir("/path/to/repo")
  → /path/to/repo/.kit/vector_db/
```

- **Per-repo isolation** — Each repo's cache is scoped to `.kit/vector_db/` (gitignored)
- **Context-aware** — Cache travels with the repo you're currently working in
- **No cross-contamination** — Different repos have separate vector indexes
- **Easy cleanup** — Delete `.kit/` directory when done with project
- **Persistent indexes** — Vector DB survives across Claude Code sessions
- **Rebuild option** — `buildIndex: true` forces index recreation

### Graceful Degradation
- Semantic search requires ML dependencies (`uv tool install 'cased-kit[ml]'`)
- If unavailable → automatic fallback to grep with keyword extraction
- Clear error messages with installation hints

### Comprehensive Logging
```typescript
// Subsystem loggers for targeted debugging
grepLogger, semanticLogger, symbolsLogger, astLogger, etc.

// Correlation IDs link related log entries
{ cid: "abc123", tool: "semantic", query: "auth flow", durationMs: 450 }
```

## Testing

```bash
bun test --recursive              # All tests
bun test src/validators.test.ts   # Validation logic (27KB of tests!)
bun test src/index.test.ts        # Integration tests
```

**Test Coverage:**
- Input validation edge cases
- Error detection (semantic unavailable, output parsing)
- Kit CLI execution with mocked `spawnSync`
- Format conversion (grep → semantic fallback)

## Environment Variables

- `KIT_DEFAULT_PATH` — Default repository path for searches (falls back to CWD)

## Git Workflow

Commits: `type(scope): subject`

Examples:
- `feat(kit): add AST search with tree-sitter`
- `fix(semantic): handle ML dependencies gracefully`
- `perf(ast): parallelize file processing`

## Notable Patterns

**Timeout Hierarchy** — Different timeouts per operation:
```typescript
GREP_TIMEOUT = 30s
SEMANTIC_TIMEOUT = 60s (building index takes time)
AST_SEARCH_TIMEOUT = 30s
SYMBOLS_TIMEOUT = 20s
```

**Temp File Strategy** — Grep uses temp files for JSON output (Kit CLI limitation)

**Error Detection** — String matching for semantic unavailable errors in stdout/stderr:
```typescript
isSemanticUnavailableError(output) // Checks for "semantic search" + "not available"
```

**Fallback Conversion** — Grep results transformed to semantic format during fallback:
```typescript
// GrepMatch → SemanticMatch with score=1.0, chunk=line content
```

**Path Hashing** — SHA256 hash (first 12 chars) for unique cache directories

## Dependencies

- `@logtape/logtape` + `@logtape/file` — Structured logging framework
- `tree-sitter-wasms` + `web-tree-sitter` — AST parsing for TS/JS/Python
- `@types/bun` — TypeScript definitions

## Prerequisites

- Kit CLI installed: `uv tool install cased-kit`
- Optional ML deps for semantic: `uv tool install 'cased-kit[ml]'`

## Notes

- **AST search is local** — Tree-sitter runs in-process, no Kit CLI needed
- **Semantic search requires Python ML stack** — Transformers, sentence-transformers
- **Cache location** — Semantic vector DB stored in `<repo>/.kit/vector_db/` (per-repo)
- **Architecture for distributed plugin** — Each Claude Code session searches the repo it has open
- **Cache in .gitignore** — `.kit/` already excluded from version control
- **Cache cleanup** — Simply delete `.kit/` directory to remove all cached indexes
- **Parallel AST** — Recent perf optimization (commit 04b89f4) parallelizes file processing
- **Validators are extensive** — 27KB of validation tests ensure robust input handling
