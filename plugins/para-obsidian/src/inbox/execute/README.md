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
└── index.ts              # Barrel exports (types only currently)
```

## Key Exports

- `ExecutionResult` - Result type for executed suggestions

## Mental Model

**"I want to move files / create notes"** → Use execute module

## Future Work

Extract from engine.ts:
- `executor.ts` - Main execution orchestration
- `attachment-mover.ts` - File move/rename operations
- `note-creator.ts` - Note creation from templates
- `validator.ts` - Pre-execution validation

## Current Location

Execution logic currently in `../engine.ts` (pending split)
