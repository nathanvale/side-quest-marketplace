---
description: Generate or refresh PROJECT_INDEX.json for fast codebase queries
argument-hint: [--force]
allowed-tools: Bash(kit:*), Bash(test:*), Bash(wc:*), Bash(stat:*)
---

# Prime the Codebase Index

Generate PROJECT_INDEX.json to enable token-efficient codebase queries.

## Pre-flight Check

Check if index already exists and its age:
```bash
test -f PROJECT_INDEX.json && stat -f "%Sm" PROJECT_INDEX.json || echo "NO_INDEX"
```

## Instructions

1. **If index exists and is < 24 hours old** (and no `--force` argument):
   - Report index stats and age
   - Ask if user wants to regenerate

2. **If index is missing, stale, or `--force` specified**:
   - Run: `kit index . -o PROJECT_INDEX.json`
   - Report time taken and stats

## After Indexing

Parse the generated index to report:

```bash
cat PROJECT_INDEX.json | jq '{
  files: (.files | length),
  symbols: ([.symbols | to_entries[] | .value | length] | add),
  has_tree: (.file_tree != null)
}'
```

## Output Format

```
PROJECT_INDEX.json generated successfully

Stats:
- Files indexed: N
- Symbols extracted: N
- Index size: X MB
- Time taken: Xs

You can now use:
- /kit:find <symbol>   - Find symbol definitions
- /kit:callers <fn>    - Find who calls a function
- /kit:overview <file> - Get file symbol summary
- /kit:stats           - Codebase overview
```

## Error Handling

If `kit index` fails:
1. Check if `kit` CLI is installed: `which kit`
2. Report the error message
3. Suggest: `uv tool install cased-kit` or `pipx install cased-kit`
