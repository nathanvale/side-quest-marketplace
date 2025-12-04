---
description: Codebase overview and health metrics from the index
allowed-tools: Bash(jq:*), Bash(cat:*), Bash(test:*), Bash(stat:*), Bash(wc:*)
---

# Codebase Statistics

Quick snapshot of codebase health without reading source files.

## Pre-flight Check

```bash
test -f PROJECT_INDEX.json && echo "INDEX_EXISTS" || echo "INDEX_MISSING"
```

If INDEX_MISSING, tell user to run `/kit:prime` first.

## Queries

### Index Metadata

```bash
stat -f "%Sm %z" PROJECT_INDEX.json  # Last modified and size
```

### File Counts

```bash
cat PROJECT_INDEX.json | jq '
  {
    total_files: (.files | length),
    by_extension: (
      [.files[] | split(".") | .[-1]] |
      group_by(.) |
      map({ext: .[0], count: length}) |
      sort_by(-.count) |
      .[0:10]
    )
  }
'
```

### Symbol Counts

```bash
cat PROJECT_INDEX.json | jq '
  [.symbols | to_entries[] | .value[]] |
  group_by(.type) |
  map({type: .[0].type, count: length}) |
  sort_by(-.count)
'
```

### Top Directories by Complexity

```bash
cat PROJECT_INDEX.json | jq '
  [.symbols | to_entries[] | {
    dir: (.key | split("/")[0:-1] | join("/")),
    count: (.value | length)
  }] |
  group_by(.dir) |
  map({dir: .[0].dir, symbols: (map(.count) | add)}) |
  sort_by(-.symbols) |
  .[0:10]
'
```

## Output Format

```
CODEBASE STATISTICS
═══════════════════

Index Status:
├── Last updated: 2 hours ago ✓
├── Index size: 1.7 MB
└── Coverage: Full

Files (2,423 total):
├── TypeScript: 545 (.ts)
├── Markdown: 131 (.md)
├── JSON: 76 (.json)
├── JavaScript: 12 (.js)
└── Other: 1,659

Symbols (3,847 total):
├── Functions: 1,205 (31%)
├── Types: 892 (23%)
├── Interfaces: 634 (16%)
├── Classes: 423 (11%)
├── Variables: 389 (10%)
└── Constants: 304 (8%)

Top Directories by Complexity:
1. src/lib/services/ (234 symbols)
2. src/commands/ (189 symbols)
3. src/lib/utils/ (156 symbols)
4. src/types/ (134 symbols)
5. tests/unit/ (98 symbols)

Health Indicators:
├── Avg symbols per file: 7.0
├── Largest file: dataverse-service.ts (45 symbols)
└── Index freshness: ✓ Up to date
```

## Recommendations

Based on stats, provide insights:
- **High complexity directories**: May need refactoring
- **Files with many symbols**: Consider splitting
- **Stale index**: Suggest running `/kit:prime`
