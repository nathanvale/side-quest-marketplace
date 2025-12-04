---
description: Find all definitions of a symbol without grepping files
argument-hint: <symbol-name>
allowed-tools: Bash(jq:*), Bash(cat:*), Bash(test:*)
---

# Find Symbol Definitions

Query PROJECT_INDEX.json to find where a symbol is defined.

## Pre-flight Check

```bash
test -f PROJECT_INDEX.json && echo "INDEX_EXISTS" || echo "INDEX_MISSING"
```

If INDEX_MISSING, tell user to run `/kit:prime` first.

## Query

Find all definitions matching the symbol name:

```bash
cat PROJECT_INDEX.json | jq --arg name "$ARGUMENTS" '
  [.symbols | to_entries[] | .value[] | select(.name == $name)] |
  sort_by(.file) |
  .[] |
  {
    file: (.file | split("/") | .[-1]),
    path: .file,
    line: .start_line,
    type: .type
  }
'
```

## Output Format

Present results as a markdown table:

| File | Line | Type |
|------|------|------|
| dataverse-service.ts | 156 | function |
| types.ts | 42 | interface |

Include the full path in a details section if needed.

## No Results

If no matches found:
1. Suggest checking spelling
2. Offer to use fuzzy search: `cat PROJECT_INDEX.json | jq --arg name "$ARGUMENTS" '[.symbols | to_entries[] | .value[] | select(.name | test($name; "i"))]'`

## Token Efficiency

This command queries a pre-built index instead of:
- Running `kit_grep` across all files
- Reading multiple source files

Typical savings: 500-2000 tokens per lookup.
