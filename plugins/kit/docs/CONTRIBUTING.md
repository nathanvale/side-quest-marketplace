# Contributing to Kit Plugin

Internal patterns and implementation notes for contributors.

---

## Notable Implementation Patterns

### Timeout Hierarchy

Different timeouts per operation based on expected execution time:

```typescript
GREP_TIMEOUT = 30s       // Fast text search
SEMANTIC_TIMEOUT = 60s   // Building vector index takes time
AST_SEARCH_TIMEOUT = 30s // Tree-sitter parsing
SYMBOLS_TIMEOUT = 20s    // Quick symbol extraction
```

**Rationale:** Semantic search may build index on first run (expensive), while grep should be near-instant.

---

### Temp File Strategy

Grep uses temp files for JSON output due to Kit CLI limitation:

```typescript
// Kit CLI requires --output-file for structured JSON
const tempFile = `/tmp/kit-grep-${Date.now()}.json`;
await execKitGrep(pattern, { outputFile: tempFile });
const results = JSON.parse(fs.readFileSync(tempFile));
```

**Why?** Kit CLI doesn't support streaming JSON to stdout reliably.

---

### Error Detection

String matching for semantic unavailable errors in stdout/stderr:

```typescript
isSemanticUnavailableError(output)
// Checks for "semantic search" + "not available"
```

**Context:** Kit CLI returns non-zero exit code AND error message when ML deps missing. We parse both to provide helpful fallback.

---

### Fallback Conversion

Grep results transformed to semantic format during graceful degradation:

```typescript
// GrepMatch → SemanticMatch
{
  file: match.file,
  line: match.line,
  content: match.content,
  score: 1.0,           // Perfect match for grep hits
  chunk: match.content  // Use matched line as chunk
}
```

**Why?** Consistent response shape across tools. MCP layer doesn't need to know if semantic or grep was used.

---

### Path Hashing

SHA256 hash (first 12 chars) for unique cache directories:

```typescript
// Convert repo path to stable hash for cache isolation
const hash = crypto.createHash('sha256')
  .update(repoPath)
  .digest('hex')
  .substring(0, 12);

const cacheDir = `${repoPath}/.kit/vector_db/${hash}/`;
```

**Why?** Per-repo cache isolation. Each project gets its own vector index.

---

## Code Organization

### Functional Core Pattern

```
kit-wrapper.ts (pure functions)
  → No side effects
  → Takes inputs, returns outputs
  → Easy to test with mocked spawnSync

mcp/kit/index.ts (effectful)
  → Validates inputs
  → Calls kit-wrapper
  → Formats output
  → Handles logging
```

**Benefit:** Core logic testable without MCP server overhead.

---

## Testing Approach

### Validation Tests (27KB!)

`validators.test.ts` has extensive edge case coverage:
- Missing required parameters
- Invalid regex patterns
- Out-of-range limits
- Malformed file paths

**Philosophy:** Fail fast with clear error messages at validation layer.

---

### Integration Tests

`index.test.ts` tests full execution flow:
- Mocked `spawnSync` for Kit CLI
- Error handling paths
- Format conversion (grep → semantic)

---

## Debugging Tips

### Enable Correlation ID Tracing

```bash
# Set log level to debug
export LOG_LEVEL=debug

# Grep logs by correlation ID
grep "cid: abc123" ~/.claude/logs/kit.jsonl
```

### Test Semantic Search Locally

```bash
cd plugins/kit
bun run src/cli.ts search-semantic "auth flow" /path/to/repo
```

### Verify Kit CLI Installation

```bash
which kit
kit --version
kit search-semantic --help  # Check ML availability
```

---

## Performance Notes

- **AST search parallelizes** file processing (commit 04b89f4)
- **Semantic cache persists** across Claude Code sessions
- **Grep is fastest** (~30ms) for literal matches
- **Index tools are fastest** (~10ms) when PROJECT_INDEX.json exists

---

## Git Workflow

Commits follow conventional format:

```bash
feat(kit): add new feature
fix(semantic): resolve bug
perf(ast): optimize performance
```

Examples:
- `feat(kit): add AST search with tree-sitter`
- `fix(semantic): handle ML dependencies gracefully`
- `perf(ast): parallelize file processing`
