---
description: List all exported symbols from a module/directory
argument-hint: <directory-path>
allowed-tools: Bash(jq:*), Bash(cat:*), Bash(test:*), Bash(find:*)
---

# Module Public API

List all exports from a directory to understand its public interface.

## Pre-flight Check

```bash
test -f PROJECT_INDEX.json && echo "INDEX_EXISTS" || echo "INDEX_MISSING"
```

If INDEX_MISSING, tell user to run `/kit:prime` first.

## Query

Find all symbols in files within the specified directory:

```bash
cat PROJECT_INDEX.json | jq --arg dir "$ARGUMENTS" '
  .symbols | to_entries[] |
  select(.key | contains($dir)) |
  {
    file: (.key | split("/") | .[-1]),
    path: .key,
    symbols: [.value[] | {name, type, line: .start_line}]
  }
' | jq -s '.'
```

## Output Format

```
📁 src/lib/services/ - Public API
══════════════════════════════════

dataverse-service.ts:
├── DataverseService (class)
├── DataverseConfig (interface)
├── createDataverseClient (function)
└── QueryOptions (type)

sharepoint-service.ts:
├── SharePointService (class)
├── uploadFile (function)
├── downloadFile (function)
└── SharePointConfig (interface)

referral-service.ts:
├── ReferralService (class)
├── createReferral (function)
├── updateReferral (function)
├── ReferralInput (type)
└── ReferralOutput (type)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Summary:
- Files: 3
- Classes: 3
- Functions: 5
- Types/Interfaces: 5
- Total exports: 13
```

## Grouping

Group symbols by type for easier scanning:
- Classes
- Functions
- Types & Interfaces
- Constants

## Use Cases

- **Onboarding**: Quickly understand what a module offers
- **API review**: Check public surface area
- **Documentation**: Generate API reference
- **Dependency audit**: See what you're importing
