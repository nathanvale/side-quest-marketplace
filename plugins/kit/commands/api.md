---
description: List all exported symbols from a module/directory
argument-hint: <directory-path>
allowed-tools: Bash(kit-index:*)
model: claude-haiku-4-5-20251001
---

# Module Public API

List all exports from a directory to understand its public interface.

## Usage

```bash
bun run ${CLAUDE_PLUGIN_ROOT}/src/cli.ts api $ARGUMENTS
```

The CLI will scan the directory and list all exported symbols grouped by file and type.

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
