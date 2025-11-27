# Kit Plugin

Claude Code plugin providing code search, semantic analysis, and symbol extraction via the [Kit CLI](https://kit.cased.com) (`cased-kit`).

## Purpose

Kit is the search backbone for Obsidian vault and coding projects. This plugin wraps the Kit Python CLI with an MCP server, enabling zero-token code search from any AI assistant.

### Capabilities

| Tool | Description | Speed |
|------|-------------|-------|
| `kit_grep` | Fast text/regex search | ~30ms |
| `kit_semantic` | Natural language vector search | ~500ms |
| `kit_symbols` | AST-based symbol extraction | ~200ms |
| `kit_usages` | Find symbol definitions | ~300ms |
| `kit_ast_search` | Tree-sitter pattern matching | ~400ms |
| `kit_file_tree` | Repository structure | ~50ms |
| `kit_file_content` | Multi-file content retrieval | ~100ms |

## Architecture

```
plugins/kit/
  mcp-servers/kit/
    index.ts          # MCP tool definitions (mcpez)
  src/
    ast/              # Tree-sitter AST search (native TypeScript)
      languages.ts    # Parser factory, language detection
      pattern.ts      # ASTPattern matcher
      searcher.ts     # ASTSearcher engine
      types.ts        # SearchMode, ASTMatch types
    errors.ts         # KitError class, error type detection
    formatters.ts     # Markdown/JSON output formatters
    kit-wrapper.ts    # Kit CLI execution layer
    logger.ts         # LogTape JSONL logging
    types.ts          # Shared type definitions
    validators.ts     # Input validation, ReDoS prevention
    index.ts          # Public exports
```

### Key Patterns

**Cascading Path Defaults**
```typescript
// User param → env var → cwd
const path = userPath || process.env.KIT_DEFAULT_PATH || process.cwd()
```

**Global Semantic Cache**
Vector indexes stored in `~/.cache/kit/vector_db/<path-hash>/` to avoid `.kit` folders in projects.

**Graceful Fallback**
Semantic search auto-falls back to grep if ML dependencies aren't installed.

## Development

### Prerequisites

```bash
# Install Kit CLI
uv tool install cased-kit

# Optional: Enable semantic search
uv tool install 'cased-kit[ml]'
```

### Testing

```bash
# All tests
bun test

# Specific file
bun test src/validators.test.ts

# Watch mode
bun test --watch
```

**Test patterns:**
- Unit tests: Pure function validation (`validators.test.ts`)
- Integration tests: Kit CLI execution (`kit-wrapper.test.ts`)
- MCP tests: Full tool invocation (manual via Claude Desktop)

### Environment Variables

| Variable | Purpose | Default |
|----------|---------|---------|
| `KIT_DEFAULT_PATH` | Default search path | `process.cwd()` |
| `KIT_CACHE_DIR` | Global cache location | `~/.cache/kit` |

## AST Search (tree-sitter)

Native TypeScript implementation using web-tree-sitter WASM.

### Search Modes

**Simple mode** (natural language):
```
"async function"  → Find async function declarations
"class"           → Find class definitions
"import"          → Find import statements
```

**Pattern mode** (JSON criteria):
```json
{"type": "function_declaration", "async": true}
{"type": "class_declaration", "name": "MyClass"}
{"textMatch": "TODO"}
```

### Supported Languages

TypeScript (`.ts`, `.tsx`), JavaScript (`.js`, `.jsx`), Python (`.py`)

## Logging

JSONL structured logs with correlation IDs:
- Location: `~/.kit/logs/kit.jsonl`
- View: `/nvcc:logs` slash command

Each operation logs start/end with duration metrics.

## Known Limitations

1. **Semantic search requires ML dependencies** - Falls back to grep if unavailable
2. **Kit CLI must be in PATH** - Install via `uv tool install`
3. **AST search is TypeScript-native** - Does not shell out to Kit for this feature
4. **Python 3.14 compatibility** - May need pyenv for older Python

## Future Work

- Expand AST language support (Go, Rust)
- Add tree-sitter query DSL mode
- Performance optimizations for large repos
