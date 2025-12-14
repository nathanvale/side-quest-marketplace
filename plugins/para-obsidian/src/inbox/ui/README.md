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
└── index.ts              # Barrel exports (re-exports from ../cli.ts)
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
- `a` - Approve all suggestions
- `1,2,5` - Approve specific suggestion numbers
- `e3 prompt` - Edit suggestion #3 with custom prompt
- `s3` - Skip suggestion #3
- `q` - Quit interactive loop
- `h` or `?` - Show help

## Security

- Prompt sanitization (removes code blocks, injection patterns)
- Length limits (500 chars)
- Logs when sanitization modifies input
