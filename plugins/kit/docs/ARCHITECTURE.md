# Kit Plugin Architecture

Internal implementation details for contributors and maintainers.

## System Overview

**MCP Layer** → Validates inputs, calls kit-wrapper functions, formats output

**Kit Wrapper** → Executes Kit CLI via `spawnSync`, parses JSON, handles errors

**Kit CLI** → Rust tool (cased-kit) doing actual file I/O, parsing, indexing

---

## Semantic Search Flow

1. Check if ML dependencies installed (`search-semantic` command)
2. Create/use cached vector index in `.kit/vector_db/` (per-repo)
3. Execute Kit CLI with `--persist-dir` pointing to cache
4. If ML unavailable → automatic fallback to grep with keyword extraction
5. Return semantic matches with relevance scores

### Cache Management

```typescript
// Per-repo cache: Each repository gets its own .kit/vector_db/
getSemanticCacheDir("/path/to/repo")
  → /path/to/repo/.kit/vector_db/
```

**Design principles:**
- **Per-repo isolation** — Each repo's cache is scoped to `.kit/vector_db/` (gitignored)
- **Context-aware** — Cache travels with the repo you're currently working in
- **No cross-contamination** — Different repos have separate vector indexes
- **Easy cleanup** — Delete `.kit/` directory when done with project
- **Persistent indexes** — Vector DB survives across Claude Code sessions
- **Rebuild option** — `buildIndex: true` forces index recreation

---

## AST Search (Tree-sitter)

- Supports TypeScript, JavaScript, Python
- Two modes: **simple** (natural language like "async function") or **pattern** (JSON criteria)
- Parallel file processing using async fs operations
- Direct tree-sitter WASM parsing (no Kit CLI dependency)

**Why local?** Tree-sitter runs in-process for better performance. No subprocess overhead.

---

## Graceful Degradation

Semantic search requires ML dependencies:
```bash
uv tool install 'cased-kit[ml]'
```

**Fallback strategy:**
- If ML unavailable → automatic grep-based search with keyword extraction
- Clear error messages with installation hints
- Grep results transformed to semantic format (score=1.0)

---

## Logging System

```typescript
// Subsystem loggers for targeted debugging
grepLogger, semanticLogger, symbolsLogger, astLogger, etc.

// Correlation IDs link related log entries
{ cid: "abc123", tool: "semantic", query: "auth flow", durationMs: 450 }
```

**LogTape-based** structured logging with correlation IDs for request tracing across tools.

---

## Key Features

### Timeout Hierarchy

Different timeouts per operation:
```typescript
GREP_TIMEOUT = 30s
SEMANTIC_TIMEOUT = 60s (building index takes time)
AST_SEARCH_TIMEOUT = 30s
SYMBOLS_TIMEOUT = 20s
```

### Temp File Strategy

Grep uses temp files for JSON output (Kit CLI limitation requiring file-based output).

### Error Detection

String matching for semantic unavailable errors in stdout/stderr:
```typescript
isSemanticUnavailableError(output) // Checks for "semantic search" + "not available"
```

### Fallback Conversion

Grep results transformed to semantic format during fallback:
```typescript
// GrepMatch → SemanticMatch with score=1.0, chunk=line content
```

### Path Hashing

SHA256 hash (first 12 chars) for unique cache directories per repository.

---

## Code Standards

- **TypeScript strict mode** — Full type safety
- **Functional core** — Pure functions in kit-wrapper.ts, side effects in MCP layer
- **Error types** — Custom `KitError` enum with 8 error types
- **Correlation IDs** — Every operation gets unique ID for log tracing
- **Biome formatting** — Tab indentation, consistent style

---

## Test Coverage

- Input validation edge cases (27KB of tests in validators.test.ts!)
- Error detection (semantic unavailable, output parsing)
- Kit CLI execution with mocked `spawnSync`
- Format conversion (grep → semantic fallback)
- AST pattern matching logic
