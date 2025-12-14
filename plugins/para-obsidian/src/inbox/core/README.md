# Core Module

**Purpose:** Main inbox processing engine and orchestration

## What Goes Here

- **Engine factory** - Creating and configuring the inbox engine
- **Scan orchestration** - File discovery, extraction, classification
- **Execute orchestration** - Applying approved suggestions
- **LLM client** - Wrapper for LLM API calls
- **Vault context** - Loading projects/areas from vault
- **Staging** - Temporary file management and cleanup

## Current Structure

```
core/
├── engine.ts              # InboxEngine factory (main entry point)
├── engine.test.ts         # Comprehensive engine tests
├── engine-utils.ts        # Title/filename generation utilities
├── engine-utils.test.ts   # Utils tests
├── llm/                   # LLM client wrapper
│   ├── client.ts          # callLLM abstraction
│   └── index.ts           # Barrel exports
├── operations/            # Execution operations
│   ├── execute-suggestion.ts  # Per-suggestion executor
│   ├── report.ts          # Markdown report generation
│   └── index.ts           # Barrel exports
├── staging/               # Temporary file management
│   ├── cleanup.ts         # Orphaned staging cleanup
│   ├── rollback.ts        # Transaction rollback
│   └── index.ts           # Barrel exports
└── vault/                 # Vault context loading
    ├── context.ts         # Projects/areas loader
    └── index.ts           # Barrel exports
```

## Key Exports

### Engine
- `createInboxEngine()` - Factory to create engine instance
- `InboxEngine` - Engine interface with scan/execute/edit methods

### Internal Helpers (used by engine.ts)
- `loadAndCleanRegistry()` - Load registry and clean orphaned staging
- `findSupportedFiles()` - Find files in inbox by extension
- `validateDependencies()` - Check pdftotext availability
- `buildVaultContext()` - Load vault areas/projects
- `processSingleFile()` - Process one file through pipeline
- `logScanStatistics()` - Log scan completion metrics

### Operations
- `executeSuggestion()` - Execute a single suggestion
- `generateReport()` - Generate markdown execution report

### Staging
- `cleanupOrphanedStaging()` - Remove stale staging files
- `rollbackStagedFiles()` - Undo failed operations

### Vault
- `getVaultAreas()` - Get PARA areas from vault
- `getVaultProjects()` - Get PARA projects from vault

## Mental Model

**"I want to run the inbox pipeline"** → Use `createInboxEngine()`

## Architecture

The engine uses a **factory pattern** returning an object with methods:

```typescript
const engine = createInboxEngine({ vaultPath: "/vault" })

// Scan returns suggestions (no side effects)
const suggestions = await engine.scan()

// Execute applies suggestions (creates files, updates registry)
const results = await engine.execute(approvedIds)

// Edit re-processes with user hint
const updated = await engine.editWithPrompt(id, "hint")

// Challenge re-classifies with audit trail
const challenged = await engine.challenge(id, "why this area?")

// Generate markdown report
const report = engine.generateReport(suggestions)
```

## Concurrency Model

- **Scan**: Parallel file processing (p-limit controlled)
- **Execute**: Sequential to ensure atomic registry saves
- **LLM calls**: Rate-limited separately from file I/O
