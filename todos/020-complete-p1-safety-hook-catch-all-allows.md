---
status: complete
priority: p1
issue_id: "020"
tags: [code-review, security]
dependencies: []
---

## Problem Statement

The safety hook's top-level catch block exits with code 0 (allow) when any unexpected exception is thrown during the safety check. This contradicts the fail-closed philosophy that the hook is designed around. The self-destruct timer correctly exits with code 2 (deny) on timeout, but an in-process exception silently permits the command.

## Findings

- File: `plugins/git/hooks/git-safety.ts` lines 1315-1317
- The main execution is wrapped in a try/catch where the catch block calls `process.exit(0)`
- Exit code 0 means "allow the command to proceed"
- Exit code 2 means "deny the command"
- Any unexpected error (e.g., a regex bug, null dereference, or malformed input) causes the safety check to be bypassed entirely
- The self-destruct timer already follows fail-closed by exiting with code 2

## Proposed Solutions

### Solution A: Change catch to exit 2 (deny)

Move `process.exit(0)` inside the try block after all checks pass. Change the catch block to exit with code 2 and a deny message.

**Pros:**
- Simple one-line fix
- Correct fail-closed behavior
- Consistent with the self-destruct timer's approach

**Cons:**
- None

### Solution B: Add structured error logging in catch before denying

Log the caught error with context (command being checked, stack trace) before exiting with code 2.

**Pros:**
- Debuggable -- when the hook denies due to an internal error, the user can see what went wrong
- Still fail-closed

**Cons:**
- Slightly more code
- Need to be careful not to leak sensitive command content in logs

## Technical Details

```typescript
// Current (BROKEN -- fail-open):
try {
  // ... all safety checks ...
  process.exit(0); // allow
} catch {
  process.exit(0); // BUG: allows on error
}

// Fixed (fail-closed):
try {
  // ... all safety checks ...
  process.exit(0); // allow
} catch (error) {
  console.error(`Safety check internal error: ${error}`);
  process.exit(2); // deny on unexpected error
}
```

## Acceptance Criteria

- Any unexpected error thrown during the safety check results in deny (exit 2), not allow (exit 0)
- The self-destruct timer continues to exit with code 2
- Normal allow/deny logic is unchanged when no errors occur
- Error context is logged to stderr for debugging
