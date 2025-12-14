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
├── index.ts              # Barrel exports
└── README.md             # This file
```

## Key Exports

- `ExecutionResult` - Result type for executed suggestions
- `ProcessorResult` - Result type for processor operations

## Mental Model

**"I want to move files / create notes"** → Use execute module

## Architecture Decision

The execution logic remains in `../engine.ts` as a single orchestrator by design:

1. **Atomicity**: Registry saves must be sequential to prevent conflicts
2. **Rollback**: Note creation + attachment move are transactional (if move fails, note is rolled back)
3. **Git safety**: Execute checks git status once before processing batch

Splitting into separate files would add complexity without benefit since:
- The `executeSuggestion()` function is already well-isolated
- Registry operations require coordination
- Error handling needs holistic view

## Current Location

Execution logic in `../engine.ts`:
- `execute()` - Main execution orchestration (~100 lines)
- `executeSuggestion()` - Per-suggestion execution (~200 lines)
