# Shared Module

**Purpose:** Cross-cutting concerns used by multiple domains

## What Goes Here

- **Error handling** - Structured error types and factory
- **Common utilities** - Small helpers used everywhere
- **Constants** - Shared configuration values
- **Type guards** - Runtime type checking

## Current Structure

```
shared/
├── index.ts              # Barrel exports
└── errors.ts             # Error system
```

## Key Exports

### Errors
- `createInboxError()` - Create structured errors
- `InboxError` - Error class with context
- `isInboxError()` - Type guard for errors
- `isRecoverableError()` - Check if error can be retried

### Error Codes
- **Dependency** - `DEP_PDFTOTEXT_MISSING`, `DEP_LLM_UNAVAILABLE`
- **Extraction** - `EXT_PDF_CORRUPT`, `EXT_PDF_TOO_LARGE`
- **Detection** - `DET_TYPE_UNKNOWN`, `DET_LLM_PARSE_FAILED`
- **Validation** - `VAL_AREA_NOT_FOUND`, `VAL_DUPLICATE_NOTE`
- **Execution** - `EXE_NOTE_CREATE_FAILED`, `EXE_PERMISSION_DENIED`
- **Registry** - `REG_WRITE_FAILED`, `REG_CORRUPT`
- **User** - `USR_INVALID_COMMAND`, `USR_EDIT_PROMPT_EMPTY`
- **System** - `SYS_UNEXPECTED`

## Mental Model

**"I want to handle errors"** → Use shared/errors.ts

## Error Categories

Errors are categorized for handling strategies:
- `dependency` - External tool/service unavailable
- `extraction` - Failed to read/parse file
- `detection` - LLM classification failed
- `validation` - Data doesn't meet requirements
- `execution` - File operation failed
- `registry` - Tracking system failed
- `user` - Invalid user input
- `system` - Unexpected internal error

## Future Work

- Add logger.ts for logging utilities
- Add utils.ts for small helpers
- Add constants.ts for shared config
