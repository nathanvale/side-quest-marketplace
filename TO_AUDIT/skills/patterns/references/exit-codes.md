# Exit Codes: Typed Semantic Exit Codes

Every CLI command exits with a typed code that has a specific semantic meaning. Agents branch on these codes to determine what happened without parsing output.

## Exit Code Table

| Code | Constant | Meaning | Agent Action |
|------|----------|---------|-------------|
| 0 | `EXIT_OK` | Success | Proceed normally |
| 1 | `EXIT_RUNTIME` | Runtime error | Retry or escalate |
| 2 | `EXIT_USAGE` | Bad arguments | Fix the command and retry |
| 3 | `EXIT_NOT_FOUND` | Resource not found | Start the resource first |
| 4 | `EXIT_UNAUTHORIZED` | Permission denied | Escalate to user |
| 5 | `EXIT_CONFLICT` | Resource conflict | Stop existing resource or use different config |
| 130 | `EXIT_INTERRUPTED` | SIGINT / Ctrl+C | User cancelled, stop gracefully |

## TypeScript Typing

Reference implementation (`command.ts:11-17, 28`):

```typescript
const EXIT_OK = 0
const EXIT_RUNTIME = 1
const EXIT_USAGE = 2
const EXIT_NOT_FOUND = 3
const EXIT_UNAUTHORIZED = 4
const EXIT_CONFLICT = 5
const EXIT_INTERRUPTED = 130

type ExitCode = 0 | 1 | 2 | 3 | 4 | 5 | 130
```

The type union prevents accidental use of arbitrary numbers. Every function that returns an exit code declares `Promise<ExitCode>` or `ExitCode`.

## Why Typed (Not Just 0/1)

Most CLIs use 0 for success and 1 for everything else. This forces agents to parse stderr to understand what went wrong. Typed exit codes let agents branch immediately:

```bash
# Agent can make decisions without parsing output
cli status --json
case $? in
  0) echo "Running" ;;
  3) cli start --json ;;  # Not found -> start it
  4) echo "Need permissions" ;;  # Unauthorized -> escalate
  *) echo "Unexpected error" ;;
esac
```

Each code maps to a distinct failure mode with a clear recovery action. This is the difference between "something went wrong" and "the server isn't running yet."

## Mapping to Error Codes

Exit codes pair with error codes in the JSON error envelope:

| Exit Code | Error Code | Error Name |
|-----------|-----------|------------|
| 1 | `E_RUNTIME` | `RuntimeError` |
| 2 | `E_USAGE` | `UsageError` |
| 3 | `E_NOT_FOUND` | `NotFoundError` |
| 4 | `E_UNAUTHORIZED` | `PermissionError` |
| 5 | `E_CONFLICT` | `ConflictError` |

See `references/error-handling.md` for the full error contract.

## Community Validation

No community standard exists for typed CLI exit codes. The conventional Unix approach is 0/1/2 (success/error/usage). Our extended set is ahead of community practice.

**joelclaw.com** does not cover exit codes at all -- it focuses on JSON output contracts.

**ACP (Agent Communication Protocol)** uses JSON-RPC 2.0 error codes instead of process exit codes, which is a different paradigm (network vs. process).

## Implementation Checklist

- [ ] Define all exit codes as named constants at module scope
- [ ] Create a `type ExitCode` union of literal numbers
- [ ] Every command handler returns `Promise<ExitCode>`
- [ ] Each failure mode maps to a specific exit code (not just 0/1)
