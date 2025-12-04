---
description: Show import/export relationships for a file
argument-hint: <file-path>
allowed-tools: Bash(jq:*), Bash(cat:*), Bash(test:*), Grep, Read
---

# File Dependency Graph

Show what a file imports and what imports it.

## Pre-flight Check

```bash
test -f PROJECT_INDEX.json && echo "INDEX_EXISTS" || echo "INDEX_MISSING"
```

If INDEX_MISSING, tell user to run `/kit:prime` first.

## Analysis

### 1. Find What This File Imports

Read the first 50 lines of the file to extract imports:

```bash
head -50 "$ARGUMENTS" | grep -E "^import|^export.*from"
```

Categorize imports:
- **Node built-ins**: `node:fs`, `node:path`, etc.
- **External packages**: From `node_modules`
- **Local imports**: Relative paths (`./`, `../`)

### 2. Find What Imports This File

Search the index for files that reference this file:

```bash
# Get the filename without path for searching
basename "$ARGUMENTS"
```

Then use Grep to find imports of this file across the codebase.

## Output Format

```
📄 src/lib/services/dataverse-service.ts

IMPORTS (8):
━━━━━━━━━━
Node Built-ins:
  └── node:https

External Packages:
  ├── @azure/identity
  ├── @azure/msal-node
  └── zod

Local Imports:
  ├── ../utils/retry.ts
  ├── ../types/dataverse.ts
  ├── ./connection-pool.ts
  └── ../config/environment.ts

IMPORTED BY (12):
━━━━━━━━━━━━━━━━━
Commands:
  ├── src/commands/migrate.ts
  ├── src/commands/create.ts
  └── src/commands/sync.ts

Services:
  ├── src/lib/services/referral-service.ts
  └── src/lib/services/contact-service.ts

Tests:
  ├── tests/unit/dataverse-service.test.ts
  └── tests/integration/dataverse.test.ts
  ... and 5 more
```

## Use Cases

- **Refactoring impact**: Know what breaks if you move/rename
- **Dependency analysis**: Spot circular dependencies
- **Architecture review**: Understand module boundaries
