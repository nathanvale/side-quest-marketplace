---
description: Get all symbols in a file without reading the source
argument-hint: <file-path> [index-path]
allowed-tools: Bash(kit-index:*)
model: claude-haiku-4-5-20251001
---

# File Symbol Overview

Query PROJECT_INDEX.json to see all symbols in a file without reading the source.

## Usage

```bash
bun run ${CLAUDE_PLUGIN_ROOT}/src/cli.ts overview $ARGUMENTS
```

The CLI will output colorized markdown (optimized for parsing) grouped by symbol type.

## Output Format

```
📄 dataverse-service.ts (1,245 lines)

Interfaces (3):
├── DataverseConfig (line 12)
├── QueryOptions (line 28)
└── BatchResult (line 45)

Types (2):
├── EntityType (line 52)
└── OperationResult (line 58)

Classes (1):
└── DataverseService (line 67)
    ├── constructor (line 72)
    ├── connect (line 89)
    ├── query (line 112)
    ├── create (line 156)
    ├── update (line 189)
    └── delete (line 215)

Functions (4):
├── createClient (line 245)
├── batchRequest (line 278)
├── retryWithBackoff (line 312)
└── parseResponse (line 356)

Constants (2):
├── DEFAULT_TIMEOUT (line 8)
└── MAX_BATCH_SIZE (line 9)
```

## Token Efficiency

Comparison:
- Reading the full file: ~5,000 tokens for a 1,245-line file
- This overview: ~100 tokens

**50x token savings** for understanding file structure.

## Use Cases

- **Quick orientation**: Understand a file before diving in
- **API discovery**: See what a module exports
- **Code review**: Get structure before reading details
