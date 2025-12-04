---
description: Find all definitions of a symbol without grepping files
argument-hint: <symbol-name> [index-path]
allowed-tools: Bash(kit-index:*)
model: claude-haiku-4-5-20251001
---

# Find Symbol Definitions

Use kit-index CLI to find where a symbol is defined in PROJECT_INDEX.json.

## Usage

```bash
bun run ${CLAUDE_PLUGIN_ROOT}/src/cli.ts find <symbol-name> --format json
```

The CLI will:
1. Search PROJECT_INDEX.json for exact symbol matches
2. Fall back to fuzzy search if no exact match found
3. Display results grouped by file with colorized output
4. Show symbol type, name, and line number

## Arguments

- `<symbol-name>` - Symbol to search for (function, class, interface, type, etc.)
- `[index-path]` - Optional path to PROJECT_INDEX.json or directory containing it
- `--format json` - Output JSON for token optimization (recommended for Claude)

## Examples

```bash
# Find symbol with JSON output (recommended)
bun run ${CLAUDE_PLUGIN_ROOT}/src/cli.ts find parseArgs --format json

# Find in specific index
bun run ${CLAUDE_PLUGIN_ROOT}/src/cli.ts find MyClass /path/to/project --format json

# Human-readable markdown output
bun run ${CLAUDE_PLUGIN_ROOT}/src/cli.ts find parseArgs
```

## Output

**Markdown (default):**
- Grouped by file
- Colorized by symbol type
- Line numbers included
- ADHD-friendly visual hierarchy

**JSON:**
```json
{
  "query": "parseArgs",
  "count": 1,
  "results": [{
    "file": "/path/to/file.ts",
    "name": "parseArgs",
    "type": "function",
    "line": 40
  }]
}
```

## Token Efficiency

Queries pre-built index instead of:
- Running grep across all files
- Reading multiple source files

Typical savings: 500-2000 tokens per lookup.
