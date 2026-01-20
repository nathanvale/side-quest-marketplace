# Core

**Shared utilities library for SideQuest marketplace plugins** - Type-safe, well-tested foundation modules for plugin development.

---

## CRITICAL RULES

**Testing:**
- **YOU MUST** write tests alongside implementation (TDD preferred)
- **YOU MUST** run `bun test` before committing changes
- Test files use pattern `*.test.ts` alongside source files

**Code Quality:**
- **YOU MUST** pass TypeScript strict mode checks
- **YOU MUST** follow existing patterns in each module
- **YOU MUST** document exported functions with JSDoc comments

**Module Independence:**
- **NEVER** create circular dependencies between modules
- Each module in `src/` should be self-contained
- Use explicit exports in package.json

---

## Quick Reference

**Type:** Internal workspace package | **Package Name:** `@sidequest/core`
**Language:** TypeScript (strict mode) | **Runtime:** Bun | **Test Framework:** Bun test

### Directory Structure

```
core/
├── src/
│   ├── validate/              # Plugin validation engine (12 validators)
│   │   ├── validators/        # Individual validator modules
│   │   │   ├── agents-md.ts          # Validates AGENTS.md syntax
│   │   │   ├── commands-md.ts        # Validates slash command docs
│   │   │   ├── hooks-json.ts         # Validates hooks configuration
│   │   │   ├── marketplace-json.ts   # Validates marketplace metadata
│   │   │   ├── mcp-json.ts           # Validates MCP server config
│   │   │   ├── mcp-tool-naming.ts    # Validates tool naming conventions
│   │   │   ├── plugin-json.ts        # Validates plugin metadata
│   │   │   ├── plugin-structure.ts   # Validates directory structure
│   │   │   ├── skill-md.ts           # Validates skill documentation
│   │   │   └── README.md             # Validator documentation
│   │   ├── cli.ts             # Validation CLI entry point
│   │   ├── reporter.ts        # Formats validation results
│   │   ├── runner.ts          # Orchestrates validation runs
│   │   └── types.ts           # Validation type definitions
│   ├── cli/                   # CLI argument parsing utilities
│   ├── compression/           # Gzip compression helpers
│   ├── formatters/            # Terminal output formatters
│   ├── fs/                    # File system utilities
│   ├── git/                   # Git operations
│   ├── glob/                  # File pattern matching
│   ├── hash/                  # File hashing utilities
│   ├── hooks/                 # Plugin hook utilities
│   ├── html/                  # HTML generation utilities
│   ├── llm/                   # LLM integration (Claude, Ollama)
│   ├── logging/               # Structured logging with correlation IDs
│   ├── mcp/                   # Simplified MCP server API (mcpez fork)
│   ├── password/              # Password validation
│   ├── slo/                   # SLO tracking with burn rate analysis
│   ├── spawn/                 # Process spawning utilities
│   ├── streams/               # Stream processing utilities
│   ├── terminal/              # Terminal utilities (colors, formatting)
│   ├── utils/                 # General utilities
│   └── validation/            # Input validation (identifiers, numbers, names)
├── package.json               # Package metadata with subpath exports
└── tsconfig.json              # TypeScript configuration (extends root)
```

---

## Commands

```bash
bun typecheck            # TypeScript type checking (tsc --noEmit)
bun test                 # Run all tests (Bun test native)
bun test <path>          # Run specific test file or directory
```

---

## Key Modules

### Validation System (`src/validate/`)

The validation engine ensures plugin quality across the marketplace.

**Core Files:**
- `types.ts` - ValidationIssue, ValidationResult, ValidationSeverity
- `runner.ts` - Runs validators against plugin directories
- `reporter.ts` - Formats validation results for CLI output
- `cli.ts` - CLI entry point for validation commands

**12 Validators:** (see `src/validate/validators/README.md`)

| Validator | Purpose | Key Rules |
|-----------|---------|-----------|
| `agents-md` | Validates AGENTS.md structure | Proper headings, content format |
| `commands-md` | Validates slash command docs | Required sections, examples |
| `hooks-json` | Validates hooks configuration | Valid events, command structure |
| `marketplace-json` | Validates marketplace metadata | Schema compliance, plugin refs |
| `mcp-json` | Validates MCP server config | Server definitions, paths |
| `mcp-tool-naming` | Validates tool naming | `mcp__<plugin>_<server>__<tool>` |
| `plugin-json` | Validates plugin metadata | Schema, required fields |
| `plugin-structure` | Validates directory layout | Required files, structure |
| `skill-md` | Validates skill documentation | Proper sections, examples |

**Usage Pattern:**
```typescript
import { validateHooksJson } from "@sidequest/core/validate/validators";

const issues = await validateHooksJson("/path/to/plugin/hooks/hooks.json");
if (issues.length > 0) {
  // Handle validation failures
}
```

### MCP Server Utilities (`src/mcp/`)

Simplified MCP server API forked from mcpez by John Lindquist.

**Why This Exists:**
The official `@modelcontextprotocol/sdk` is powerful but verbose. This module provides a declarative, function-based API with 90% less boilerplate.

**Key Features:**
- Function-based tool/resource/prompt registration
- Automatic transport setup (stdio)
- Type-safe Zod schema integration
- Error handling patterns
- Response format helpers

**Before (official SDK - ~40 lines):**
```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

const server = new McpServer({ name: "my-server", version: "1.0.0" });
server.registerTool(/* ... */);
const transport = new StdioServerTransport();
await server.connect(transport);
```

**After (this module - ~5 lines):**
```typescript
import { tool, z } from "@sidequest/core/mcp";

tool("greet", {
  description: "Greet someone",
  inputSchema: { name: z.string() },
}, async ({ name }) => ({ content: [{ type: "text", text: `Hello ${name}!` }] }));
```

### MCP Response Utilities (`src/mcp-response/`)

High-level wrapper for MCP tool handlers that reduces boilerplate from ~25 lines to ~5 lines per tool.

**Why This Exists:**
Even with the simplified `@sidequest/core/mcp` API, tool handlers still need ~25 lines of repetitive code for correlation IDs, logging, error handling, and response formatting. The `wrapToolHandler` function automates all of this.

**Key Features:**
- Automatic correlation ID generation for request tracing
- Automatic request/response logging with timing
- Automatic error handling with categorization (transient, permanent, configuration, unknown)
- Automatic response format parsing (JSON or Markdown)
- Supports both data handlers (automatic formatting) and formatted handlers (custom formatting)
- Custom log context support (sessionCid, userId, etc.)

**Before (low-level API - ~25 lines per tool):**
```typescript
import { tool, z } from "@sidequest/core/mcp";
import { parseResponseFormat, respondText, respondError, ResponseFormat } from "@sidequest/core/mcp-response";

tool("para_config", {
  inputSchema: { response_format: z.enum(["markdown", "json"]).optional() }
}, async (args) => {
  const cid = createCorrelationId();
  const startTime = Date.now();
  log({ cid, tool: "para_config", event: "request" });

  try {
    const config = loadConfig();
    const format = parseResponseFormat(args.response_format);

    log({ cid, tool: "para_config", event: "response", success: true, durationMs: Date.now() - startTime });

    return respondText(format, JSON.stringify(config));
  } catch (error) {
    log({ cid, tool: "para_config", durationMs: Date.now() - startTime, success: false, error });
    return respondError(format, error);
  }
});
```

**After (wrapToolHandler - ~5 lines per tool):**
```typescript
import { tool, z } from "@sidequest/core/mcp";
import { wrapToolHandler } from "@sidequest/core/mcp-response";

tool("para_config", {
  inputSchema: { response_format: z.enum(["markdown", "json"]).optional() }
}, wrapToolHandler(
  async (args, format) => {
    const config = loadConfig();
    return config; // Wrapper handles formatting
  },
  { toolName: "para_config", logger: myLogger, createCid: () => randomUUID() }
));
```

**Error Categorization:**
The wrapper automatically categorizes errors for better observability:
- **Transient** (NETWORK_ERROR) - ECONNREFUSED, ENOTFOUND, ETIMEDOUT, fetch failed
- **Permanent** (NOT_FOUND, VALIDATION) - File not found, validation failures
- **Configuration** (PERMISSION) - EACCES, EPERM, unauthorized
- **Unknown** (UNKNOWN_ERROR) - Everything else

### LLM Integration (`src/llm/`)

Utilities for calling LLMs (Claude headless CLI, Ollama API) with structured extraction.

**Key Capabilities:**
- Model routing (Claude vs Ollama)
- Prompt building with constraints
- Response parsing
- Field-level constraints for deterministic extraction
- Vault context integration

**Modules:**
- `model-router.ts` - Route calls to Claude/Ollama
- `prompt-builder.ts` - Build structured prompts
- `constraints.ts` - Field constraints for extraction
- `response-parser.ts` - Parse LLM responses
- `types.ts` - Shared types

**Usage:**
```typescript
import { callModel, buildStructuredPrompt } from "@sidequest/core/llm";

const prompt = buildStructuredPrompt({
  objective: "Extract metadata",
  constraints: { /* ... */ },
  examples: [/* ... */]
});

const result = await callModel(prompt, { model: "claude-sonnet-4" });
```

### Logging System (`src/logging/`)

Structured logging with correlation IDs for request tracing.

**Features:**
- LogTape-based logging (file + console)
- Correlation ID tracking across async operations
- Performance metrics collection
- Configurable log levels

**Files:**
- `factory.ts` - Logger creation
- `correlation.ts` - Correlation ID management
- `metrics.ts` - Performance metrics
- `config.ts` - Logger configuration

### Validation Utilities (`src/validation/`)

Input validation for identifiers, numbers, and names.

**Why This Exists:**
Common validation patterns (kebab-case IDs, priority ranges, area names) were
duplicated across plugins. This module consolidates them with comprehensive
tests and security hardening.

**Modules:**
- `identifiers.ts` - Kebab-case and camelCase validation (validateClassifierId, validateFieldName, validateTemplateName)
- `numbers.ts` - Bounded numeric ranges (validatePriority 0-100, validateWeight 0.0-1.0)
- `names.ts` - Human-readable names (validateAreaName, validateDisplayName)

**Usage:**
```typescript
import { validateClassifierId, validatePriority } from "@sidequest/core/validation";

const id = validateClassifierId('medical-bill'); // ✅ OK
validateClassifierId('Medical-Bill'); // ❌ Error: must be kebab-case

const priority = validatePriority(75); // ✅ OK
validatePriority(150); // ❌ Error: must be 0-100
```

### Terminal Utilities (`src/terminal/`)

Terminal output formatting with color support.

**Capabilities:**
- Color formatting (success, error, warning, info)
- Progress indicators
- Box drawing
- ANSI escape sequences

### File System (`src/fs/`)

Enhanced file system operations with safety checks.

**Features:**
- Safe read/write with error handling
- Directory creation with parents
- File existence checks
- Glob pattern matching (via `src/glob/`)

### SLO Tracking (`src/slo/`)

Service Level Objective tracking with error budgets and burn rate analysis.

**Features:**
- Event recording (violations and successes)
- Burn rate calculation (error budget consumption)
- Breach detection
- Persistent JSONL storage with rotation
- Circuit breaker for write failures

**Files:**
- `types.ts` - SLO types and definitions
- `tracker.ts` - Main SLO tracking logic
- `persistence.ts` - JSONL-based event storage

**Usage:**
```typescript
import { createSLOTracker } from "@sidequest/core/slo";

const tracker = createSLOTracker({
  definitions: {
    api_latency: {
      name: "API Latency",
      target: 0.95,
      threshold: 1000,
      unit: "ms",
      window: "24h",
      errorBudget: 0.05
    }
  }
});

tracker.recordEvent("api_latency", false, 850);
const result = await tracker.checkBreach("api_latency", 1100);
```

### Other Utilities

| Module | Purpose |
|--------|---------|
| `cli` | CLI argument parsing and validation |
| `compression` | Gzip compression/decompression |
| `formatters` | Output formatting utilities |
| `git` | Git operations (status, commit, etc.) |
| `hash` | File hashing (MD5, SHA) |
| `hooks` | Plugin hook utilities |
| `html` | HTML generation and templating |
| `mcp-response` | MCP tool handler wrapper (reduces boilerplate by ~20 lines per tool) |
| `password` | Password validation rules |
| `spawn` | Process spawning with stdio capture |
| `streams` | Stream processing utilities |
| `utils` | General-purpose utilities |
| `validation` | Input validation (identifiers, numbers, names) |

---

## Package Exports

The package.json uses subpath exports for explicit module boundaries:

```json
{
  "exports": {
    "./cli": "./src/cli/index.ts",
    "./compression": "./src/compression/index.ts",
    "./formatters": "./src/formatters/index.ts",
    "./fs": "./src/fs/index.ts",
    "./git": "./src/git/index.ts",
    "./glob": "./src/glob/index.ts",
    "./hash": "./src/hash/index.ts",
    "./hooks": "./src/hooks/index.ts",
    "./html": "./src/html/index.ts",
    "./llm": "./src/llm/index.ts",
    "./logging": "./src/logging/index.ts",
    "./mcp": "./src/mcp/index.ts",
    "./password": "./src/password/index.ts",
    "./slo": "./src/slo/index.ts",
    "./spawn": "./src/spawn/index.ts",
    "./streams": "./src/streams/index.ts",
    "./terminal": "./src/terminal/index.ts",
    "./utils": "./src/utils/index.ts",
    "./validation": "./src/validation/index.ts",
    "./validate/types": "./src/validate/types.ts",
    "./validate/runner": "./src/validate/runner.ts",
    "./validate/reporter": "./src/validate/reporter.ts",
    "./validate/validators": "./src/validate/validators/index.ts"
  }
}
```

**Usage in plugins:**
```typescript
import { validateHooksJson } from "@sidequest/core/validate/validators";
import { tool, z } from "@sidequest/core/mcp";
import { callModel } from "@sidequest/core/llm";
import { logger } from "@sidequest/core/logging";
import { createSLOTracker } from "@sidequest/core/slo";
import { validateClassifierId, validatePriority } from "@sidequest/core/validation";
```

---

## Code Conventions

**TypeScript:**
- Strict mode enabled (extends root tsconfig.json)
- No unchecked indexed access
- Bun types included
- ESNext target

**Testing:**
- Pattern: `*.test.ts` alongside source files
- Framework: Bun test native
- Import: `import { describe, expect, test } from "bun:test"`
- Coverage: Comprehensive test coverage required for validators

**File Naming:**
- kebab-case for files/directories
- `index.ts` for module entry points
- `*.test.ts` for tests

**Documentation:**
- JSDoc comments for exported functions
- Module-level documentation in index.ts
- README.md in complex modules (e.g., validators)

---

## Development Workflow

### Adding a New Module

1. Create directory: `src/my-module/`
2. Add entry point: `src/my-module/index.ts`
3. Add tests: `src/my-module/index.test.ts`
4. Export in package.json:
   ```json
   "./my-module": "./src/my-module/index.ts"
   ```
5. Run tests: `bun test src/my-module/`
6. Typecheck: `bun typecheck`

### Adding a Validator

1. Create validator: `src/validate/validators/my-validator.ts`
2. Export function: `export async function validateMyThing(options: ValidatorOptions): Promise<ValidationIssue[]>`
3. Create tests: `src/validate/validators/my-validator.test.ts`
4. Export from index: `src/validate/validators/index.ts`
5. Document in README: `src/validate/validators/README.md`
6. Run tests: `bun test src/validate/validators/my-validator.test.ts`

**Validator Template:**
```typescript
import type { ValidationIssue, ValidatorOptions } from "../types.ts";

export async function validateMyThing(
  options: ValidatorOptions
): Promise<ValidationIssue[]> {
  const issues: ValidationIssue[] = [];

  // Validation logic here
  if (somethingWrong) {
    issues.push({
      ruleId: "my-thing/rule-id",
      message: "Description of the problem",
      severity: "error",
      file: options.pluginRoot,
      suggestion: "How to fix it"
    });
  }

  return issues;
}
```

---

## Dependencies

**Production:**
- `@logtape/logtape` - Structured logging framework
- `@logtape/file` - File logger for LogTape
- `@modelcontextprotocol/sdk` - Official MCP SDK (used by mcp module)
- `zod` - Schema validation (used by mcp module)

**Development:**
- `bun-types` - Bun runtime types
- `typescript` - TypeScript compiler

---

## Testing

**Run all tests:**
```bash
bun test
```

**Run specific module tests:**
```bash
bun test src/validate/
bun test src/mcp/
bun test src/llm/
```

**Run single test file:**
```bash
bun test src/validate/validators/hooks-json.test.ts
```

**Test coverage areas:**
- Validators: Comprehensive coverage with positive/negative cases
- MCP utilities: Tool registration, error handling
- LLM integration: Model routing, prompt building
- File operations: Read/write, error handling
- Logging: Correlation IDs, metrics

---

## Common Patterns

### Error Handling

```typescript
// Validation errors
issues.push({
  ruleId: "module/specific-error",
  message: "Clear description",
  severity: "error",
  file: filePath,
  line: lineNumber, // optional
  suggestion: "How to fix" // optional
});

// Async operations
try {
  const result = await riskyOperation();
  return result;
} catch (error) {
  logger.error("Operation failed", { error });
  throw new Error(`Failed to do thing: ${error.message}`);
}
```

### Logging with Correlation

```typescript
import { logger, withCorrelationId } from "@sidequest/core/logging";

await withCorrelationId(async () => {
  logger.info("Starting operation");
  // ... work ...
  logger.info("Operation complete");
});
```

### MCP Tool Registration

```typescript
import { tool, z } from "@sidequest/core/mcp";

tool("my_tool", {
  description: "What this tool does",
  inputSchema: {
    query: z.string(),
    response_format: z.enum(["markdown", "json"]).default("markdown")
  }
}, async ({ query, response_format }) => {
  try {
    const result = await doWork(query);
    const text = response_format === "json"
      ? JSON.stringify(result)
      : formatMarkdown(result);
    return { content: [{ type: "text", text }] };
  } catch (error) {
    return {
      content: [{ type: "text", text: JSON.stringify({ error: error.message, isError: true }) }],
      isError: true
    };
  }
});
```

---

## Troubleshooting

**TypeScript errors:**
```bash
bun typecheck
```

**Test failures:**
```bash
bun test --watch  # Watch mode for debugging
```

**Module not found:**
Check package.json exports match your import path

**Circular dependencies:**
Use Kit tools to trace: `kit_deps` or `kit_blast`

---

## Notes

- **Token Efficiency:** Validation system designed to run fast with minimal overhead
- **Module Independence:** Each src/ directory is self-contained
- **MCP Fork:** The mcp module is a fork of mcpez with type fixes and enhancements
- **Validator Quality:** Validators are tested against real plugin fixtures
- **Logging Infrastructure:** LogTape provides structured logging with file rotation
- **LLM Abstraction:** Supports both Claude (headless CLI) and Ollama (API)

---

## Key Statistics

From PROJECT_INDEX.json:
- **Complexity Hotspot:** 70 symbols in `src/validate/validators/`
- **Test Coverage:** 17 test files (comprehensive validator coverage)
- **Modules:** 16 independent utility modules
- **Validators:** 12 plugin validation rules

---

## Resources

| Resource | Location |
|----------|----------|
| Validator Documentation | `src/validate/validators/README.md` |
| MCP Documentation | `src/mcp/index.ts` (inline docs) |
| Parent Project CLAUDE.md | `../CLAUDE.md` |
| Root TypeScript Config | `../tsconfig.json` |

---

## Getting Started

**Using core utilities in a plugin:**

1. Add dependency: `"@sidequest/core": "workspace:*"` in plugin package.json
2. Import from subpaths: `import { tool } from "@sidequest/core/mcp"`
3. Run from root: `bun install`
4. Use utilities: See module documentation above

**Contributing to core:**

1. Navigate: `cd core`
2. Make changes: Edit files in `src/`
3. Write tests: Add `*.test.ts` files
4. Run tests: `bun test`
5. Typecheck: `bun typecheck`
6. Commit: Follow conventional commits format

---

**For detailed plugin development guide, see parent @../PLUGIN_DEV_GUIDE.md**
