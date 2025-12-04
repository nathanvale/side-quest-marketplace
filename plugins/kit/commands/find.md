---
description: Find all definitions of a symbol without grepping files
argument-hint: <symbol-name>
allowed-tools: Bash(kit-index:*)
---

# Find Symbol Definitions

Use kit-index CLI to find where a symbol is defined in PROJECT_INDEX.json.

## Usage

```bash
cd plugins/kit && bun run src/cli.ts find <symbol-name>
```

The CLI will:
1. Search PROJECT_INDEX.json for exact symbol matches
2. Fall back to fuzzy search if no exact match found
3. Display results grouped by file with colorized output
4. Show symbol type, name, and line number

## Arguments

- `<symbol-name>` - Symbol to search for (function, class, interface, type, etc.)
- `--format json` - Output JSON instead of markdown (optional)

## Examples

```bash
# Find exact symbol
cd plugins/kit && bun run src/cli.ts find parseArgs

# Get JSON output
cd plugins/kit && bun run src/cli.ts find parseArgs --format json

# Fuzzy search (automatic fallback)
cd plugins/kit && bun run src/cli.ts find parse
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
