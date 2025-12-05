# Bun CLI Standard for SideQuest Marketplace

Unified CLI patterns and best practices for all plugins with command-line interfaces.

---

## Overview

This standard ensures consistency, maintainability, and predictability across all CLI tools in the marketplace. Based on:
- Bun documentation and stdlib (process, stdio, shell)
- Existing patterns in Kit, Para Obsidian, and MCP Manager CLIs
- Node.js CLI best practices adapted for Bun

---

## File Structure

```
plugin/
├── src/
│   ├── cli.ts                    # Main CLI entry point
│   ├── utils/
│   │   ├── args.ts              # Argument parsing
│   │   └── output.ts            # Output formatting
│   └── commands/                # Optional: separate command files
│       ├── config.ts
│       └── search.ts
└── bin/                         # Optional: wrapper scripts
    └── plugin-name              # Shebang wrapper
```

---

## 1. Entry Point (`cli.ts`)

### Shebang & Imports

```typescript
#!/usr/bin/env bun

/**
 * Plugin Name CLI
 *
 * Command-line interface for [description].
 * Output formats: markdown (default) for humans, JSON for machines.
 */

import { parseOutputFormat, type OutputFormat } from "@sidequest/core/formatters";
```

**Rules:**
- ✅ Always include shebang: `#!/usr/bin/env bun`
- ✅ Include JSDoc comment explaining purpose
- ✅ Import `OutputFormat` and `parseOutputFormat` from core/formatters
- ✅ Use absolute imports for @sidequest modules (workspace protocol)

### Structured Argument Parsing

```typescript
interface ParsedArgs {
  command: string;
  subcommand?: string;
  positional: string[];
  flags: Record<string, string | boolean>;
}

function parseArgs(argv: string[]): ParsedArgs {
  const positional: string[] = [];
  const flags: Record<string, string | boolean> = {};

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg) continue;

    if (arg.startsWith("--")) {
      const [keyRaw, value] = arg.split("=");
      const key = keyRaw?.slice(2);
      if (!key) continue;

      const next = argv[i + 1];
      if (value !== undefined) {
        // --key=value
        flags[key] = value;
      } else if (next && !next.startsWith("--")) {
        // --key value
        flags[key] = next;
        i++;
      } else {
        // --flag (boolean)
        flags[key] = true;
      }
    } else {
      positional.push(arg);
    }
  }

  const [command, subcommand, ...rest] = positional;
  return { command: command ?? "", subcommand, positional: rest, flags };
}
```

**Rules:**
- ✅ Support three flag formats: `--key=value`, `--key value`, `--flag`
- ✅ Separate positional args from flags
- ✅ Return structured object with command/subcommand/positional/flags
- ✅ Handle edge cases (missing args, trailing flags)

### Usage Output

```typescript
function printUsage(): void {
  const lines = [
    color("cyan", "Plugin Name CLI"),
    "",
    "Usage:",
    "  bun run src/cli.ts command [subcommand] [args] [--flags]",
    "  bun run src/cli.ts config [--format md|json]",
    "  bun run src/cli.ts search <query> [--dir path] [--format md|json]",
    "",
    "Options:",
    "  --format md|json   Output format (default: md)",
    "  --dry-run          Preview changes without writing",
    "  --help             Show this help message",
    "",
    "Examples:",
    '  bun run src/cli.ts config --format json',
    '  bun run src/cli.ts search "pattern" --dir src',
  ];
  console.log(lines.map((line) => emphasize("cyan", line)).join("\n"));
}
```

**Rules:**
- ✅ Use cyan color for headers (from @sidequest/core/formatters)
- ✅ Structure: Usage → Options → Examples
- ✅ Keep under 30 lines (fit in terminal)
- ✅ Show command variations clearly
- ✅ Include real examples users can copy-paste

### Main Function

```typescript
async function main() {
  try {
    // Skip first two args: 'bun' and 'src/cli.ts'
    const args = process.argv.slice(2);
    const { command, subcommand, positional, flags } = parseArgs(args);

    const outputFormat = parseOutputFormat(flags.format) ?? "md";

    // Handle help
    if (!command || flags.help) {
      printUsage();
      process.exit(0);
    }

    // Dispatch to command handlers
    switch (command) {
      case "config":
        await handleConfig(outputFormat);
        break;
      case "search":
        if (!positional[0]) {
          console.error("Error: search requires a query");
          process.exit(1);
        }
        await handleSearch(positional[0], flags, outputFormat);
        break;
      default:
        console.error(`Unknown command: ${command}`);
        printUsage();
        process.exit(1);
    }
  } catch (error) {
    console.error("Error:", error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main();
```

**Rules:**
- ✅ Always wrap in try/catch
- ✅ Skip first two argv (bun + script path)
- ✅ Check for help flag first
- ✅ Validate required positional args
- ✅ Use switch for command dispatch
- ✅ Exit with code 1 on error, 0 on success
- ✅ Use console.error for errors

---

## 2. Argument Utilities (`utils/args.ts`)

```typescript
/**
 * Parse key=value pairs into object
 */
export function parseKeyValuePairs(
  inputs: ReadonlyArray<string>,
): Record<string, string> {
  const entries: Record<string, string> = {};
  for (const input of inputs) {
    const [key, ...rest] = input.split("=");
    if (!key || rest.length === 0) continue;
    entries[key.trim()] = rest.join("=").trim();
  }
  return entries;
}

/**
 * Parse comma-separated list
 */
export function parseList(
  input: string | boolean | undefined,
): string[] {
  if (typeof input !== "string") return [];
  return input
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Coerce string value to appropriate type
 */
export function coerceValue(raw: string): unknown {
  const trimmed = raw.trim();
  if (trimmed === "true") return true;
  if (trimmed === "false") return false;
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) return Number(trimmed);
  if (trimmed.includes(",")) return trimmed.split(",").map((s) => s.trim());
  return trimmed;
}
```

**Rules:**
- ✅ Extract parsing logic into utilities
- ✅ Handle edge cases (empty, malformed)
- ✅ Type coercion for JSON output
- ✅ Document with JSDoc

---

## 3. Output Formatting (`utils/output.ts`)

**Use core/formatters:**

```typescript
import {
  color,
  emphasize,
  parseOutputFormat,
  type OutputFormat,
} from "@sidequest/core/formatters";

interface FormattedOutput {
  markdown: string;
  json: Record<string, unknown>;
}

function formatOutput(result: unknown, format: OutputFormat): string {
  if (format === "json") {
    return JSON.stringify(result, null, 2);
  }

  // Markdown output (human-readable)
  return formatMarkdown(result);
}
```

**Rules:**
- ✅ Always support `--format md|json`
- ✅ Default to markdown (human-readable)
- ✅ Use color() for colored output (cyan, green, yellow, red)
- ✅ JSON output for machine parsing
- ✅ Never mix formats in single output

### Color Palette

```typescript
// From @sidequest/core/formatters
color("cyan", "Header")      // Information, CLI banners
color("green", "Success")    // Successful operations
color("yellow", "Warning")   // Warnings, dry-run
color("red", "Error")        // Errors, failures
color("gray", "Muted")       // Less important info
```

---

## 4. Error Handling

### Exit Codes

```typescript
// process.exit(code)
process.exit(0)  // Success
process.exit(1)  // General error
process.exit(2)  // Argument parsing error
process.exit(3)  // Validation error
```

**Rules:**
- ✅ Exit 0 on success
- ✅ Exit non-zero on any error
- ✅ Print error to stderr with console.error
- ✅ Include helpful context in error message

### Error Messages

```typescript
// BAD ❌
console.error("Error");

// GOOD ✅
console.error(`Error: File not found at ${path}`);
console.error("Usage: bun run src/cli.ts read <file>");
```

**Rules:**
- ✅ Be specific about what failed
- ✅ Include the value that caused error
- ✅ Suggest how to fix (if obvious)
- ✅ Use color("red", ...) for errors

---

## 5. Configuration & Environment

### Environment Variables

```typescript
// CRITICAL: Document required env vars
function loadConfig() {
  const vault = process.env.PARA_VAULT;
  if (!vault) {
    console.error("Error: PARA_VAULT environment variable required");
    process.exit(1);
  }
  return { vault };
}
```

**Rules:**
- ✅ Document all required env vars in comments
- ✅ Validate at startup
- ✅ Provide helpful error if missing
- ✅ Use `process.env.VAR_NAME`

### Package.json Bin Entry

```json
{
  "name": "@sidequest/plugin-name",
  "bin": {
    "plugin-name": "./src/cli.ts"
  },
  "scripts": {
    "typecheck": "tsc --noEmit",
    "test": "bun test --recursive",
    "check": "biome check --write ."
  }
}
```

**Rules:**
- ✅ Add bin entry pointing to cli.ts
- ✅ Include executable scripts in package.json

---

## 6. Testing CLI

```typescript
// src/cli.test.ts
import { describe, it, expect } from "bun:test";
import { parseArgs } from "./utils/args";

describe("CLI argument parsing", () => {
  it("should parse flags with values", () => {
    const result = parseArgs(["config", "--format", "json"]);
    expect(result.command).toBe("config");
    expect(result.flags.format).toBe("json");
  });

  it("should parse --key=value format", () => {
    const result = parseArgs(["search", "query", "--dir=src"]);
    expect(result.flags.dir).toBe("src");
  });

  it("should separate positional args from flags", () => {
    const result = parseArgs(["read", "file.md", "--format", "json"]);
    expect(result.positional[0]).toBe("file.md");
    expect(result.flags.format).toBe("json");
  });
});
```

**Rules:**
- ✅ Test argument parsing thoroughly
- ✅ Test flag formats: `--key value`, `--key=value`, `--flag`
- ✅ Test error cases (missing args, invalid flags)
- ✅ Mock file I/O and external calls
- ✅ Use Bun test native (no jest/vitest)

---

## 7. Bun-Specific Patterns

### Process I/O

```typescript
// Reading stdin (interactive)
for await (const line of console) {
  console.log(`Got: ${line}`);
}

// Writing to stdout/stderr
process.stdout.write("message");
process.stderr.write("error");
console.error("error");  // Preferred

// Running subprocesses
import { $ } from "bun";
const result = await $`ls -la`.text();
```

**Rules:**
- ✅ Use `Bun.$` for shell commands (pipes, redirects)
- ✅ Use `Bun.spawn()` for simple commands
- ✅ Capture stdout/stderr as needed
- ✅ Handle exit codes from subprocesses

### File I/O

```typescript
// Use core/fs utilities (sync + async variants)
import {
  pathExistsSync,
  readJsonFileSync,
  writeJsonFileSync,
  readTextFile,
  writeTextFile,
} from "@sidequest/core/fs";

// Don't use Node.js fs directly in new code
// ❌ import { readFileSync } from "node:fs";
```

**Rules:**
- ✅ Use @sidequest/core/fs for file operations
- ✅ Use sync versions in CLI (faster feedback)
- ✅ Validate paths (vault-scoped if applicable)
- ✅ Error on missing files early

---

## 8. Command Dispatch Pattern

### Simple Commands (Same File)

```typescript
// For 1-3 commands
async function handleConfig(format: OutputFormat) {
  try {
    const config = await loadConfig();
    console.log(formatOutput(config, format));
  } catch (error) {
    console.error("Failed to load config:", error);
    process.exit(1);
  }
}

async function handleSearch(
  query: string,
  flags: Record<string, string | boolean>,
  format: OutputFormat,
) {
  // ...
}
```

### Complex Commands (Separate Files)

```typescript
// For 5+ commands, separate into command files
import { searchCommand } from "./commands/search";
import { configCommand } from "./commands/config";

switch (command) {
  case "search":
    await searchCommand(positional, flags, outputFormat);
    break;
  case "config":
    await configCommand(flags, outputFormat);
    break;
}
```

**Rules:**
- ✅ 1-3 commands: keep in cli.ts
- ✅ 5+ commands: split into commands/
- ✅ Each command function takes (args, flags, format)
- ✅ Commands always async (for future I/O)
- ✅ Commands handle their own errors

---

## 9. Examples from Codebase

### Para Obsidian (Comprehensive)

```
✅ Structured parseArgs
✅ Color-coded usage output
✅ Multiple output formats (md/json)
✅ Key=value pair parsing
✅ Subcommands (frontmatter migrate)
✅ Dry-run support
✅ Error messages with context
```

### Kit CLI

```
✅ Long usage with command descriptions
✅ Separate command functions
✅ Format-agnostic output
✅ Help text extensive
```

### MCP Manager

```
✅ Configuration loading from ENV
✅ Interactive mode integration
✅ File path validation
```

---

## 10. Checklist for New CLI Tools

### Implementation

- [ ] Shebang `#!/usr/bin/env bun`
- [ ] `parseArgs()` function with flag support
- [ ] `printUsage()` function with examples
- [ ] Output formatter (md/json)
- [ ] Error handling with exit codes
- [ ] JSDoc on all public functions

### Testing

- [ ] Test argument parsing (all flag formats)
- [ ] Test command dispatch
- [ ] Test error cases
- [ ] Test output formats (md/json)
- [ ] Manual test in shell: `bun run src/cli.ts --help`

### Documentation

- [ ] Document required environment variables
- [ ] Usage examples in --help
- [ ] README with examples
- [ ] CLAUDE.md with CLI section

### Package.json

- [ ] Bin entry pointing to cli.ts
- [ ] Scripts: typecheck, test, check
- [ ] @sidequest/core in dependencies (if using formatters/fs)

### CI/CD

- [ ] Typecheck passes (`bun typecheck`)
- [ ] Tests pass (`bun test`)
- [ ] Biome lint passes (`bun check`)

---

## 11. Anti-Patterns (Don't Do These)

❌ **No custom argument parsing**
```typescript
// BAD - fragile, doesn't handle edge cases
const args = process.argv.slice(2);
const format = args[args.indexOf("--format") + 1];
```

❌ **No color/emphasis on output**
```typescript
// BAD - hard to read in terminal
console.log("Usage: ...");  // Should be colored

❌ **Mixing stdout and stderr**
```typescript
// BAD - logs errors to stdout
console.log("error details");

❌ **No validation of environment variables**
```typescript
// BAD - crashes later with cryptic error
const vault = process.env.VAULT_PATH;  // Could be undefined

❌ **Hardcoding file paths**
```typescript
// BAD - not portable
const configPath = "/Users/nathan/.config/app.json";

❌ **No exit codes**
```typescript
// BAD - parent process can't tell if succeeded
process.exit();  // Default exit code?
```

---

## 12. Migration Guide for Existing CLIs

If updating existing CLI to match this standard:

1. **Extract parseArgs** → Move to utils/args.ts
2. **Standardize usage** → Use printUsage() with color
3. **Add output formatting** → Support --format md|json
4. **Use core/formatters** → Import from @sidequest/core
5. **Use core/fs** → Replace node:fs with core/fs
6. **Add tests** → Test parsing and commands
7. **Document** → Update CLAUDE.md CLI section

---

## 13. Performance Notes

**Optimization for CLI speed:**

- ✅ Use sync file I/O for CLI (faster than async)
- ✅ Defer heavy operations (only run when needed)
- ✅ Cache index files (para-obsidian, kit)
- ✅ Use Bun's native `$` shell for pipes (faster than spawn)
- ✅ Lazy-load modules (require only used commands)

**Bun vs Node.js:**
- Bun startup: ~10-20ms
- Node.js startup: ~50-100ms
- Bun Bun.$ pipes: 2-3x faster than Node.js exec

---

## 14. Resources

- **Bun Process API:** https://bun.sh/docs/guides/process
- **Bun Shell:** https://bun.sh/docs/runtime/shell
- **Bun File I/O:** https://bun.sh/docs/runtime/file-io
- **CLI Best Practices:** https://12factor.net (especially config section)
- **Exit Codes:** https://en.wikipedia.org/wiki/Exit_status

---

## Summary

**Key Principles:**
1. **Consistency** — All CLIs follow same pattern
2. **Clarity** — Help text is comprehensive and examples work
3. **Predictability** — Flags work the same everywhere
4. **Maintainability** — Code is organized and testable
5. **Performance** — Leverage Bun's speed (sync I/O, $, startup)
6. **Accessibility** — Colored output, JSON for machines, markdown for humans

Apply these standards to all new CLI tools and refactor existing ones incrementally.
