---
description: Codebase overview and health metrics from the index
argument-hint: [index-path]
allowed-tools: Bash(kit-index:*)
model: claude-haiku-4-5-20251001
---

# Codebase Statistics

Quick snapshot of codebase health without reading source files.

## Usage

```bash
bun run ${CLAUDE_PLUGIN_ROOT}/src/cli.ts stats --format json
```

The CLI will output colorized markdown with symbol distribution and complexity hotspots.

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
