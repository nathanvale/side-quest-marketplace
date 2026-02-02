# Marketplace Core

**Internal marketplace utilities for SideQuest plugins** - Specialized modules for plugin development, validation, and LLM integration.

**Note:** This package (`@sidequest/marketplace-core`) contains marketplace-specific utilities. For general-purpose utilities (fs, glob, terminal, etc.), use `@side-quest/core` published on npm.

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

**Type:** Internal workspace package | **Package Name:** `@sidequest/marketplace-core`
**Language:** TypeScript (strict mode) | **Runtime:** Bun | **Test Framework:** Bun test

## Published vs Marketplace-Specific

**Published on npm as `@side-quest/core`:**
- cli, compression, concurrency, errors, formatters
- fs, geo, git, glob, hash, html
- instrumentation, logging, mcp, mcp-response
- oauth, password, slo, spawn, streams
- terminal, testing, utils, validation, vtt

**Marketplace-specific in `@sidequest/marketplace-core`:**
- hooks - Plugin hook utilities
- llm - LLM integration (Claude, Ollama)
- obsidian - Obsidian-specific utilities
- validate/* - Plugin validation engine

### Directory Structure

```
core/  (@sidequest/marketplace-core)
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
│   ├── hooks/                 # Plugin hook utilities (marketplace-specific)
│   ├── llm/                   # LLM integration - Claude, Ollama (marketplace-specific)
│   └── obsidian/              # Obsidian utilities (marketplace-specific)
│
│   # Published modules (use @side-quest/core instead):
│   # cli, compression, concurrency, errors, formatters,
│   # fs, geo, git, glob, hash, html, instrumentation,
│   # logging, mcp, mcp-response, oauth, password, slo,
│   # spawn, streams, terminal, testing, utils, validation, vtt
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

## Marketplace-Specific Modules

This package contains modules that are specific to the SideQuest marketplace infrastructure. For general-purpose utilities, use `@side-quest/core` published on npm.

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
import { validateHooksJson } from "@sidequest/marketplace-core/validate/validators";

const issues = await validateHooksJson("/path/to/plugin/hooks/hooks.json");
if (issues.length > 0) {
  // Handle validation failures
}
```

### Plugin Hooks (`src/hooks/`)

Utilities for plugin lifecycle hooks (SessionStart, PreToolUse, PostToolUse, Stop).

**Usage:**
```typescript
import { hookTypes } from "@sidequest/marketplace-core/hooks";
```

### LLM Integration (`src/llm/`)

Utilities for calling LLMs (Claude headless CLI, Ollama API) with structured extraction.

### Obsidian Utilities (`src/obsidian/`)

Obsidian-specific utilities for working with wiki links and markdown.

**Usage:**
```typescript
import { stripWikilinks, stripWikilinksOrValue } from "@sidequest/marketplace-core/obsidian";

const cleaned = stripWikilinks("Text with [[wikilink]]");
// Returns: "Text with "
```

---

## Removed Modules (Now in @side-quest/core)

The following modules have been published to npm as `@side-quest/core` and should be imported from there:

**MCP & Response Utilities:**
- `@side-quest/core/mcp` - Simplified MCP server API
- `@side-quest/core/mcp-response` - Tool handler wrapper (reduces boilerplate)

**Logging & Instrumentation:**
- `@side-quest/core/logging` - Structured logging with correlation IDs
- `@side-quest/core/instrumentation` - Performance metrics, timing wrappers

**File Operations:**
- `@side-quest/core/fs` - File system utilities
- `@side-quest/core/glob` - Pattern matching
- `@side-quest/core/git` - Git operations

**Process & Concurrency:**
- `@side-quest/core/spawn` - Process spawning
- `@side-quest/core/concurrency` - File locking, transactions

**Validation & Security:**
- `@side-quest/core/validation` - Input validation
- `@side-quest/core/oauth` - OAuth 2.0 token management
- `@side-quest/core/password` - Password validation

**CLI & Terminal:**
- `@side-quest/core/cli` - Argument parsing
- `@side-quest/core/terminal` - Terminal formatting
- `@side-quest/core/formatters` - Output formatters

**Other:**
- `@side-quest/core/utils` - General utilities
- `@side-quest/core/testing` - Test fixtures
- `@side-quest/core/slo` - SLO tracking
- `@side-quest/core/hash` - File hashing
- `@side-quest/core/html` - HTML generation
- `@side-quest/core/compression` - Gzip utilities
- `@side-quest/core/streams` - Stream processing
- `@side-quest/core/errors` - Error utilities
- `@side-quest/core/geo` - Geographic utilities
- `@side-quest/core/vtt` - VTT/subtitle utilities

---

## Package Exports

The package.json uses subpath exports for marketplace-specific modules:

```json
{
  "exports": {
    "./hooks": "./src/hooks/index.ts",
    "./llm": "./src/llm/index.ts",
    "./obsidian": "./src/obsidian/index.ts",
    "./validate/types": "./src/validate/types.ts",
    "./validate/runner": "./src/validate/runner.ts",
    "./validate/reporter": "./src/validate/reporter.ts",
    "./validate/validators": "./src/validate/validators/index.ts"
  }
}
```

**Usage in plugins:**
```typescript
// Marketplace-specific utilities
import { validateHooksJson } from "@sidequest/marketplace-core/validate/validators";
import { callModel } from "@sidequest/marketplace-core/llm";
import { stripWikilinks } from "@sidequest/marketplace-core/obsidian";

// General utilities (from published package)
import { tool, z } from "@side-quest/core/mcp";
import { logger } from "@side-quest/core/logging";
import { createSLOTracker } from "@side-quest/core/slo";
import { validateClassifierId, validatePriority } from "@side-quest/core/validation";
import { loadTokenFile, saveTokenFile, isTokenExpired } from "@side-quest/core/oauth";
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
import { logger, withCorrelationId } from "@side-quest/core/logging";

await withCorrelationId(async () => {
  logger.info("Starting operation");
  // ... work ...
  logger.info("Operation complete");
});
```

### MCP Tool Registration

```typescript
import { tool, z } from "@side-quest/core/mcp";

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

**Using marketplace-core utilities in a plugin:**

1. Add dependency: `"@sidequest/marketplace-core": "workspace:*"` in plugin package.json
2. Import from subpaths: `import { callModel } from "@sidequest/marketplace-core/llm"`
3. Run from root: `bun install`
4. Use utilities: See module documentation above

**Using published core utilities:**

1. Add dependency: `"@side-quest/core": "^x.x.x"` in plugin package.json
2. Import from subpaths: `import { tool } from "@side-quest/core/mcp"`
3. Run from root: `bun install`
4. Reference: See npm package documentation

**Contributing to core:**

1. Navigate: `cd core`
2. Make changes: Edit files in `src/`
3. Write tests: Add `*.test.ts` files
4. Run tests: `bun test`
5. Typecheck: `bun typecheck`
6. Commit: Follow conventional commits format

---

**For detailed plugin development guide, see parent @../PLUGIN_DEV_GUIDE.md**
