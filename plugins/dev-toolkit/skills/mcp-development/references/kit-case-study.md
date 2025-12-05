# Kit Plugin Case Study

Deep dive into Kit's production MCP server implementation. Kit is a reference implementation demonstrating best practices with 18 tools, 1780 lines of code, and sophisticated error handling.

---

## Architecture Overview

### File Structure

```
plugins/kit/
├── src/                              # Business logic (pure functions)
│   ├── kit-wrapper.ts                # Core CLI wrappers for all Kit commands
│   ├── formatters.ts                 # Output formatting (markdown/JSON)
│   ├── validators.ts                 # Comprehensive input validation (27KB!)
│   ├── logger.ts                     # Correlation ID logging
│   ├── types.ts                      # TypeScript interfaces
│   ├── errors.ts                     # Error enum and taxonomy
│   └── ast/                          # Tree-sitter AST search engine
│       ├── searcher.ts               # Parallel AST pattern matching
│       └── parser.ts                 # Tree-sitter integration
├── mcp/kit/                          # MCP server
│   ├── index.ts                      # 1780 lines, 18 tools
│   └── package.json
└── .mcp.json                         # Server registration
```

### Design Pattern: Functional Core

**Separation of Concerns:**

```
┌─────────────────────────────────────┐
│  MCP Server (mcp/kit/index.ts)      │ ← Effects: Logging, MCP protocol
│  • Validates inputs (Zod schemas)   │
│  • Calls business logic              │
│  • Formats output                    │
│  • Handles errors                    │
└──────────────┬──────────────────────┘
               │
┌──────────────▼──────────────────────┐
│  Business Logic (src/*.ts)           │ ← Pure functions: No side effects
│  • kit-wrapper.ts: Kit CLI calls     │
│  • formatters.ts: Output formatting  │
│  • validators.ts: Input validation   │
│  • errors.ts: Error handling         │
└─────────────────────────────────────┘
```

**Benefits:**
- Business logic is testable without MCP overhead
- Easy to add new MCP servers wrapping same logic
- Errors isolated and easy to debug

---

## The 18 Tools

### Priority 1: Index-Based Navigation (5 tools)

```typescript
// ~10ms execution time
tool("kit_index_prime", ...)           // Generate/refresh PROJECT_INDEX.json
tool("kit_index_find", ...)            // Find symbol definitions
tool("kit_index_overview", ...)        // List all symbols in file
tool("kit_index_stats", ...)           // Codebase statistics
tool("kit_file_content", ...)          // Batch read multiple files
```

**Why index-based first?** PROJECT_INDEX.json enables fast queries without scanning entire codebase.

### Priority 2: Graph & Analysis (6 tools)

```typescript
// ~200-300ms execution time
tool("kit_callers", ...)               // Find function call sites
tool("kit_usages", ...)                // Find all symbol usages
tool("kit_api", ...)                   // Module public API
tool("kit_dead", ...)                  // Dead code detection
tool("kit_blast", ...)                 // Blast radius analysis
tool("kit_deps", ...)                  // Dependency graph
```

**Why graph-based second?** Uses index for targeted, fast operations.

### Priority 3: Direct Search (3 tools)

```typescript
// ~30-500ms execution time
tool("kit_grep", ...)                  // Text/regex search
tool("kit_ast_search", ...)            // AST pattern matching
tool("kit_semantic", ...)              // Natural language search (ML)
```

**Why direct search last?** Slower but most comprehensive.

### Priority 4: Utilities (4 tools)

```typescript
// Additional capabilities
tool("kit_file_tree", ...)             // Directory structure (~50ms)
tool("kit_commit", ...)                // AI-generated commits (~2s)
tool("kit_summarize", ...)             // PR summaries (~3s)
```

---

## The 6-Step Handler Pattern

Kit's handlers follow a consistent 6-step pattern (used across all 18 tools):

```typescript
async (args, _extra: unknown) => {
  // Step 1: Generate correlation ID for request tracing
  const cid = createCorrelationId();

  // Step 2: Log the request
  const logger = getSubsystemLogger(
    args.search_mode === "semantic" ? "semantic" : "grep"
  );
  logger.info("MCP tool request", {
    cid,
    tool: "kit_grep",
    args,
    timestamp: new Date().toISOString()
  });

  try {
    // Step 3: Execute business logic
    const results = await executeKitGrep(args.pattern);

    // Step 4: Format output based on response_format
    const text = args.response_format === "json"
      ? JSON.stringify(results)
      : formatResultsAsMarkdown(results);

    // Step 5: Log the response
    logger.info("MCP tool response", {
      cid,
      tool: "kit_grep",
      success: true,
      resultCount: results.length,
      durationMs: Date.now() - startTime
    });

    // Step 6: Return MCP response
    return {
      content: [{ type: "text", text }]
    };
  } catch (error) {
    // Step 5 (error path): Log the error
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error("MCP tool failed", {
      cid,
      tool: "kit_grep",
      error: errorMessage
    });

    // Step 6 (error path): Return error with recovery hint
    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          error: errorMessage,
          hint: "Check pattern syntax. Use kit_grep --help for examples",
          isError: true
        })
      }],
      isError: true
    };
  }
}
```

### Correlation ID Tracing Example

All log entries for a single request share a correlation ID:

```json
{ "cid": "a1b2c3d4", "event": "request_start", "tool": "kit_grep" }
{ "cid": "a1b2c3d4", "event": "validation_complete", "valid": true }
{ "cid": "a1b2c3d4", "event": "execution_start", "executor": "spawnSync" }
{ "cid": "a1b2c3d4", "event": "execution_complete", "durationMs": 42 }
{ "cid": "a1b2c3d4", "event": "response_complete", "success": true }
```

**Benefit:** Grep all logs by correlation ID to see exact timeline of a request.

---

## Error Handling Taxonomy

Kit defines 8 error categories:

```typescript
enum KitError {
  // Validation
  InvalidInput = "INVALID_INPUT",           // Bad regex, out-of-range limit
  MissingRequired = "MISSING_REQUIRED",     // Missing required parameter

  // Search issues
  NotFound = "NOT_FOUND",                   // No matches for pattern
  PatternError = "PATTERN_ERROR",           // Invalid regex syntax

  // System issues
  InternalError = "INTERNAL_ERROR",         // Unexpected failure
  Unavailable = "UNAVAILABLE",              // Feature not available (e.g., ML deps)
  Timeout = "TIMEOUT",                      // Operation exceeded timeout

  // Recovery
  FallbackUsed = "FALLBACK_USED"           // Graceful degradation
}
```

### Example: Semantic Search with Fallback

When ML dependencies aren't available, Kit falls back to grep:

```typescript
async (args) => {
  const cid = createCorrelationId();

  try {
    // Try semantic search (requires ML)
    const semanticResults = await executeSemanticSearch(args.query);
    return formatResults(semanticResults);
  } catch (error) {
    // Check if it's a "feature unavailable" error
    if (isSemanticUnavailableError(error)) {
      mcpLogger.warn("Semantic search unavailable, using grep fallback", {
        cid,
        originalError: error.message,
        fallbackTool: "kit_grep"
      });

      // Fall back to grep-based search
      const grepResults = await executeKitGrep(args.query);

      // Transform grep results to semantic format
      const semanticFormatted = grepResults.map(result => ({
        ...result,
        score: 1.0,  // Indicate this is a fallback
        source: "fallback_grep"
      }));

      return formatResults(semanticFormatted);
    }

    // Not a fallback-able error, escalate
    throw error;
  }
}
```

### Error Recovery Hints

Every error includes a hint for recovery:

```typescript
const ERROR_HINTS = {
  [KitError.InvalidInput]: "Check parameter syntax and ranges",
  [KitError.PatternError]: "Use valid regex syntax. Test pattern with kit_grep --help",
  [KitError.Timeout]: "Try with fewer results (limit=10) or smaller file set",
  [KitError.NotFound]: "Pattern matched no results. Refine search or check file paths",
  [KitError.Unavailable]: "Required dependencies missing. Install with: uv tool install 'cased-kit[ml]'"
};

// Usage in error response
return {
  content: [{
    type: "text",
    text: JSON.stringify({
      error: errorMessage,
      errorType: determineErrorType(error),
      hint: ERROR_HINTS[errorType],
      isError: true
    })
  }],
  isError: true
};
```

---

## Input Validation Deep Dive

Kit has 27KB of validation tests (validators.test.ts) testing edge cases:

### Zod Schema Example (kit_grep)

```typescript
const grepInputSchema = z.object({
  // Required
  pattern: z.string()
    .min(1, "Pattern cannot be empty")
    .max(1000, "Pattern too long")
    .refine((p) => {
      try { new RegExp(p); return true; } catch { return false; }
    }, "Invalid regex pattern"),

  // Optional with defaults
  type: z.enum(["js", "ts", "py", "rust", "json"])
    .optional(),

  glob: z.string()
    .optional()
    .describe("File glob pattern (e.g., '*.ts')"),

  head_limit: z.number()
    .int()
    .min(0)
    .max(1000)
    .optional()
    .describe("Limit results to first N matches"),

  response_format: z.enum(["markdown", "json"])
    .optional()
    .default("markdown")
});
```

### Validation Test Example

```typescript
test("rejects invalid regex pattern", async () => {
  const invalid = { pattern: "[(" };
  const validation = grepInputSchema.safeParse(invalid);

  expect(validation.success).toBe(false);
  expect(validation.error?.issues[0].message).toContain("Invalid regex");
});

test("rejects pattern exceeding max length", async () => {
  const tooLong = { pattern: "x".repeat(1001) };
  const validation = grepInputSchema.safeParse(tooLong);

  expect(validation.success).toBe(false);
});

test("accepts valid regex", async () => {
  const valid = { pattern: "\\b\\w+\\b" };
  const validation = grepInputSchema.safeParse(valid);

  expect(validation.success).toBe(true);
});
```

---

## Output Formatting

Kit supports markdown and JSON outputs. The formatter automatically converts results:

### Markdown Format (Default)

```markdown
## Search Results

**Pattern:** `auth.*flow`
**Matches:** 42
**Files:** 8

### src/auth.ts:12
```typescript
const authFlow = () => { ... }
```

### src/login.ts:34
```typescript
function handleAuthFlow() { ... }
```
```

### JSON Format

```json
{
  "pattern": "auth.*flow",
  "matches": 42,
  "files": 8,
  "results": [
    {
      "file": "src/auth.ts",
      "line": 12,
      "content": "const authFlow = () => { ... }",
      "matchIndices": [0, 4]
    }
  ]
}
```

### Formatter Implementation

```typescript
const formatResults = (results: SearchResult[], format: "markdown" | "json") => {
  if (format === "json") {
    return JSON.stringify({
      matchCount: results.length,
      results: results.map(r => ({
        file: r.file,
        line: r.lineNumber,
        content: r.matchedLine,
        score: r.relevanceScore
      }))
    }, null, 2);
  }

  // Markdown
  const lines = [
    `## Search Results (${results.length} matches)`,
    ""
  ];

  for (const result of results) {
    lines.push(`### ${result.file}:${result.lineNumber}`);
    lines.push("```");
    lines.push(result.matchedLine);
    lines.push("```");
    lines.push("");
  }

  return lines.join("\n");
};
```

---

## Logging Strategy

Kit uses structured logging with correlation IDs across all operations.

### Logger Setup

```typescript
import {
  createCorrelationId,
  createPluginLogger
} from "@sidequest/core/logging";

const {
  rootLogger,
  getSubsystemLogger,
  logFile,
  logDir
} = createPluginLogger({
  name: "kit",
  subsystems: [
    "grep",
    "semantic",
    "ast",
    "symbols",
    "formatter",
    "validators"
  ]
});

// Export subsystem loggers
export const grepLogger = getSubsystemLogger("grep");
export const semanticLogger = getSubsystemLogger("semantic");
export const astLogger = getSubsystemLogger("ast");
```

### Log Structure

Each log entry has:

```json
{
  "@timestamp": "2025-12-05T10:30:45.123Z",
  "level": "INFO",
  "logger": "kit.grep",
  "message": "MCP tool request",
  "properties": {
    "cid": "a1b2c3d4",
    "tool": "kit_grep",
    "pattern": "auth\\w+",
    "fileCount": 42,
    "timeout": 30000,
    "requestId": "req-123"
  }
}
```

### Viewing Logs

```bash
# All kit logs
/kit:logs

# Filter by level
/kit:logs level=ERROR

# Filter by correlation ID
/kit:logs cid=a1b2c3d4

# Limit results
/kit:logs count=100
```

---

## Performance Considerations

### Timeout Hierarchy

Different operations have different timeout budgets:

```typescript
const TIMEOUTS = {
  index: 20_000,          // Index operations (10ms typical)
  grep: 30_000,           // Text search (30ms typical)
  ast: 30_000,            // AST search (up to 500ms)
  semantic: 60_000,       // Semantic search + index building (up to 500ms)
  commit: 120_000         // Commit generation + API calls (up to 3s)
};
```

### Caching Strategy

Semantic search caches vector indexes per repository:

```typescript
// Cache location per repository
.kit/vector_db/[repo-hash]/

// Hash is deterministic
const repoHash = crypto
  .createHash("sha256")
  .update(absoluteRepoPath)
  .digest("hex")
  .substring(0, 12);
```

**Benefits:**
- Persistent across Claude Code sessions
- Per-repo isolation (no cross-contamination)
- Automatic cleanup (delete `.kit/` directory)
- Survives repository moves (rehashes)

### Parallel Processing

AST search parallelizes file processing:

```typescript
// Process multiple files in parallel
const results = await Promise.all(
  filePaths.map(file => parseFileAST(file))
);

// Collect matches
const matches = results.flat();
```

---

## Testing Strategy

Kit has comprehensive test coverage:

### Unit Tests

```typescript
// validators.test.ts - 27KB of edge cases
test("rejects invalid input", () => { ... });
test("handles very long patterns", () => { ... });
test("validates enum values", () => { ... });

// formatters.test.ts
test("formats markdown output", () => { ... });
test("formats JSON output", () => { ... });
test("handles special characters", () => { ... });
```

### Integration Tests

```typescript
// index.test.ts
test("grep tool returns correct format", async () => {
  const result = await callTool("kit_grep", {
    pattern: "function",
    response_format: "json"
  });

  expect(result.content[0].text).toContain("results");
});

test("semantic search falls back to grep", async () => {
  // Mock ML unavailable error
  // Verify fallback happens
  // Check results are in semantic format
});
```

### Performance Tests

```typescript
test("grep completes within timeout", async () => {
  const start = performance.now();
  await callTool("kit_grep", { pattern: "auth" });
  const duration = performance.now() - start;

  expect(duration).toBeLessThan(TIMEOUTS.grep);
});
```

---

## Lessons Learned

### What Works Well

1. **6-step handler pattern** - Consistent, easy to follow, minimal errors
2. **Correlation IDs** - Essential for debugging and observability
3. **Type guards** - Prevent errors with `isSuccess()` pattern
4. **Graceful degradation** - Fall back to grep when ML unavailable
5. **Comprehensive validation** - Catch errors at boundary, not deep in logic

### What Takes Time

1. **Error handling** - Properly handling all failure modes
2. **Documentation** - Each tool needs clear examples
3. **Testing edge cases** - 27KB of validation tests required
4. **Performance tuning** - Cache decisions and timeout tuning
5. **User feedback** - Error messages matter for UX

### Best Practices

1. **Separate concerns** - Business logic != MCP protocol handling
2. **Log strategically** - Not every operation, but start/end of expensive ones
3. **Validate early** - Fail fast at input boundary
4. **Support both formats** - Users appreciate choice
5. **Document recovery** - Error hints should suggest fixes

---

## Summary

Kit demonstrates:

- ✅ **18-tool production server** - Comprehensive feature set
- ✅ **6-step handler pattern** - Consistent, maintainable code
- ✅ **Correlation ID tracing** - Full observability
- ✅ **Error taxonomy** - Structured error handling
- ✅ **Graceful degradation** - Smart fallback strategy
- ✅ **Comprehensive validation** - 27KB of test coverage
- ✅ **Dual output formats** - Markdown + JSON
- ✅ **Performance tuning** - Timeout hierarchy and caching

Use Kit as a reference for your own MCP servers. Copy patterns that work, adapt them to your needs.

**Study these files:**
- `mcp/kit/index.ts` - Tool registration and handlers
- `src/kit-wrapper.ts` - Business logic implementation
- `src/validators.ts` - Input validation patterns
- `src/errors.ts` - Error taxonomy

**Key takeaway:** Production MCP servers are well-structured, thoroughly tested, and obsessively focused on reliability and user experience.
