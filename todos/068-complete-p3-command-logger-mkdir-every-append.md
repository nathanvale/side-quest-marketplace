---
status: complete
priority: p3
issue_id: "068"
tags: [code-review, performance]
dependencies: []
---

## Problem Statement

`command-logger.ts` calls `mkdir({ recursive: true })` before every JSONL append. After the first call, the directory already exists but the syscall still fires.

## Findings

- `command-logger.ts` lines 88-89: `await mkdir(logDir, { recursive: true })` on every PostToolUse
- Each hook invocation is a fresh process, so no cross-invocation cache is possible
- A try/catch on appendFile with ENOENT fallback avoids the mkdir on the happy path

## Proposed Solutions

Use try/catch pattern:
```typescript
try {
    await appendFile(logPath, line)
} catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        await mkdir(logDir, { recursive: true })
        await appendFile(logPath, line)
    }
}
```

## Technical Details

- **File**: `plugins/git/hooks/command-logger.ts` lines 88-89

## Acceptance Criteria

- `mkdir` only called on first-ever invocation (ENOENT case)
- All subsequent appends skip mkdir
- No behavioral change
