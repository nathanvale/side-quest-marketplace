# UI Module

**Purpose:** Terminal interaction and user input

## What Goes Here

- **Interactive prompts** - User approval workflow
- **Display formatting** - Pretty-printing suggestions
- **Command parsing** - Interpreting user commands
- **Progress indicators** - Spinners and status updates

## Current Structure

```
ui/
└── index.ts              # Barrel exports from ../cli-adapter.ts (pending move)
```

## Key Exports

- `runInteractiveLoop()` - Main interactive approval workflow
- `displayResults()` - Show processing results
- `formatSuggestion()` - Format single suggestion for display
- `formatSuggestionsTable()` - Format all suggestions as table
- `parseCommand()` - Parse user commands (approve, skip, edit, etc.)
- `formatConfidence()` - Format confidence levels with colors

## Mental Model

**"I want to display stuff to user"** → Use ui module

## Commands

Supported user commands:
- `approve <id>` - Approve suggestion
- `skip <id>` - Skip suggestion
- `edit <id> <prompt>` - Re-classify with custom prompt
- `approve-all high` - Auto-approve high confidence
- `quit` - Exit interactive loop

## Future Work

- Move cli-adapter.ts → ui/cli-adapter.ts
- Move cli.ts → ui/cli.ts
- Extract formatters.ts for display logic
- Extract prompts.ts for input handling
