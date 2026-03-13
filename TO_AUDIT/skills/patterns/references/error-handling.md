# Error Handling: Structured JSON Errors

Errors go to stderr as structured JSON when in machine mode, or as human-readable prefixed lines in default mode. Every error includes a typed name and code for agent branching.

## Error Envelope

JSON error output on stderr:

```json
{
  "status": "error",
  "message": "Human-readable error description",
  "error": {
    "name": "ConflictError",
    "code": "E_CONFLICT"
  }
}
```

Reference implementation (`command.ts:1525-1538`):

```typescript
function writeJsonError(
  message: string,
  code: string,
  name = 'CliError',
): void {
  const payload: JsonErrorBody = {
    status: 'error',
    message,
    error: { name, code },
  }
  process.stderr.write(`${JSON.stringify(payload)}\n`)
}
```

## Error Code Taxonomy

| Code | Meaning | When Used |
|------|---------|-----------|
| `E_USAGE` | Bad arguments or invalid flags | Malformed commands, unknown options |
| `E_RUNTIME` | Unexpected failure | Server crash, network error, timeout |
| `E_NOT_FOUND` | Resource doesn't exist | No running server, endpoint 404 |
| `E_UNAUTHORIZED` | Permission denied | EACCES, HTTP 401/403 |
| `E_CONFLICT` | Resource state conflict | Port in use, server already running |
| `E_HELP` | Help requested | `--help` flag (exits 0, not an actual error) |

## Error Name Taxonomy

| Name | Maps To | Recovery |
|------|---------|----------|
| `UsageError` | `E_USAGE` | Fix the command syntax |
| `RuntimeError` | `E_RUNTIME` | Retry or investigate |
| `NotFoundError` | `E_NOT_FOUND` | Create/start the missing resource |
| `PermissionError` | `E_UNAUTHORIZED` | Escalate to user or fix permissions |
| `ConflictError` | `E_CONFLICT` | Resolve the conflict (stop existing, use different port) |

## Dual-Mode Error Writing

The central error function (`command.ts:1509-1523`) routes to JSON or human output based on context:

```typescript
function writeError(
  ctx: OutputContext,
  message: string,
  errorCode: string,
  _exitCode: ExitCode,
  errorName: string,
): void {
  if (ctx.json) {
    writeJsonError(message, errorCode, errorName)
    return
  }
  const line = ctx.quiet ? message : `[observability] ${message}`
  process.stderr.write(`${line}\n`)
}
```

Key behaviors:
- **JSON mode**: Full JSON envelope on stderr
- **Human mode**: `[observability] message` on stderr
- **Quiet mode**: Plain `message` on stderr (no prefix)

## Parse-Time Errors

Argument parsing errors are caught before command dispatch. The parser returns a discriminated union (`command.ts:72-80`):

```typescript
interface ParseCliError {
  readonly ok: false
  readonly exitCode: ExitCode
  readonly message: string
  readonly output: string
  readonly errorCode: string
  readonly json: boolean
  readonly quiet: boolean
}
```

This allows the main `runCli` function to format the error correctly even when parsing fails.

## Catch-All Error Handling

The top-level `runCli` wraps everything in a try/catch (`command.ts:688-707`) to ensure no error escapes without proper formatting:

```typescript
catch (err) {
  if (isInterruptedError(err)) {
    // SIGINT -> exit 130
    return EXIT_INTERRUPTED
  }
  const message = err instanceof Error ? err.message : String(err)
  // Fallback -> exit 1
  return EXIT_RUNTIME
}
```

## Community Validation

**agent-browser** uses a simpler error shape: `{ success: false, error: "message" }`. Our approach adds `name` and `code` fields for more granular agent branching.

**joelclaw.com** proposes an additional `fix` field with actionable recovery guidance:

```json
{
  "error": "Port 7483 is already in use",
  "fix": "Run 'observability stop' first, or use --port to specify a different port"
}
```

This is not yet implemented in our CLI but is a compelling future enhancement -- it lets agents self-recover without needing to understand the error taxonomy.

## Implementation Checklist

- [ ] All errors go to stderr (never stdout)
- [ ] JSON errors use `{"status":"error","message":"...","error":{"name":"...","code":"..."}}` envelope
- [ ] Every error includes both a human message and a typed error code
- [ ] Parse errors are caught and formatted before command dispatch
- [ ] Top-level catch-all ensures no unformatted errors escape
