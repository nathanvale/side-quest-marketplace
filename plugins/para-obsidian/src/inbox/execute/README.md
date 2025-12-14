# Execute Module

**Purpose:** Applying approved suggestions (moving files, creating notes)

## What Goes Here

- **Suggestion execution** - Running approved actions
- **Note creation** - Creating Obsidian notes from templates
- **File operations** - Moving/renaming files
- **Attachment management** - Organizing attachments

## Current Structure

```
execute/
├── index.ts              # Barrel exports (re-exports from core/operations)
└── README.md             # This file
```

## Key Exports

- `ExecutionResult` - Result type for executed suggestions
- `ProcessorResult` - Result type for processor operations

## Mental Model

**"I want to move files / create notes"** → Use execute module

## Architecture Decision

Execution logic lives in `core/operations/` as a single orchestrator by design:

1. **Atomicity**: Registry saves must be sequential to prevent conflicts
2. **Rollback**: Note creation + attachment move are transactional (if move fails, note is rolled back)
3. **Git safety**: Execute checks git status once before processing batch

## Actual Implementation

Execution logic in `core/operations/`:
- `execute-suggestion.ts` - Per-suggestion executor
- `report.ts` - Markdown report generation

Orchestration in `core/engine.ts`:
- `execute()` - Main execution loop with registry coordination
