---
description: Show import/export relationships for a file
argument-hint: <file-path>
allowed-tools: Bash(kit-index:*)
---

# File Dependency Graph

Show what a file imports and what imports it.

## Usage

```bash
cd plugins/kit && bun run src/cli.ts deps $ARGUMENTS
```

The CLI will analyze bidirectional dependencies (what this file imports and what imports it).

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
