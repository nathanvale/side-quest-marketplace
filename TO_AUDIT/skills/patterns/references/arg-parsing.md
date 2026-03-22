# Arg Parsing: Zero-Dependency Manual Parsing

Parse CLI arguments by hand using a simple for-loop and discriminated union types. No commander, yargs, or other dependencies required.

## Why No Dependencies

1. **Zero runtime deps** - the CLI binary has no `node_modules` to install
2. **Full control** - you own the parsing, error messages, and help output
3. **Agent-compatible output** - parse errors return structured data, not library-formatted strings
4. **Type safety** - discriminated unions make impossible states unrepresentable
5. **Bundle size** - nothing to tree-shake or worry about

## Command Typing

Each command is a separate interface extending shared global flags (`command.ts:40-70`):

```typescript
interface GlobalFlags {
  readonly json: boolean
  readonly quiet: boolean
  readonly nonInteractive: boolean
}

interface StartCommand extends GlobalFlags {
  readonly command: 'start'
  readonly port: number
  readonly hostname: string
  readonly portSource: PortSource
}

interface StatusCommand extends GlobalFlags {
  readonly command: 'status'
}

interface EventsCommand extends GlobalFlags {
  readonly command: 'events'
  readonly jsonl: boolean
  readonly typeFilter: string | null
  readonly fields: readonly string[] | null
  // ... more event-specific flags
}

type CliOptions = StartCommand | StatusCommand | StopCommand | EventsCommand
```

TypeScript narrows the type when you switch on `options.command`. Event-specific flags like `--jsonl` and `--fields` only exist on `EventsCommand` -- you can't accidentally access them on `StartCommand`.

## Parse Result: Discriminated Union

The parser returns success or error, never throws (`command.ts:72-87`):

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

interface ParseCliOk {
  readonly ok: true
  readonly options: CliOptions
}

type ParseCliResult = ParseCliError | ParseCliOk
```

The caller checks `result.ok` and branches. Parse errors carry their own output formatting because the `--json` flag may have been parsed before the error occurred.

## Flag Parsing Patterns

The parser uses a single for-loop with explicit flag handling (`command.ts:177-431`):

**Boolean flags:**
```typescript
if (token === '--json') { json = true; continue }
if (token === '--quiet') { quiet = true; continue }
```

**Value flags (two forms):**
```typescript
// --port 8080
if (token === '--port') {
  const value = args[i + 1]
  if (!value || value.startsWith('--')) {
    return parseUsageError('Missing value for --port', ...)
  }
  portRaw = value
  i++  // skip the value token
  continue
}

// --port=8080
if (token.startsWith('--port=')) {
  const value = token.slice('--port='.length)
  if (!value) {
    return parseUsageError('Missing value for --port', ...)
  }
  portRaw = value
  continue
}
```

**Unknown flags:**
```typescript
if (token.startsWith('-')) {
  return parseUsageError(`Unknown option: ${token}`, ...)
}
```

## Command Normalization

Aliases map to canonical command names:

```typescript
// command.ts:474
const normalizedCommand = commandToken === 'server' ? 'start' : commandToken
```

## Command-Specific Flag Validation

After parsing, validate that flags belong to the right command (`command.ts:485-516`):

```typescript
if (normalizedCommand !== 'start' && portRaw !== null) {
  return parseUsageError(
    '--port is only valid for the start/server command', ...
  )
}

if (normalizedCommand !== 'events' && hasEventsOnlyFlags) {
  return parseUsageError(
    '--jsonl/--type/--since/--limit/--fields are only valid for the events command', ...
  )
}
```

This catches misuse early with clear messages instead of silently ignoring irrelevant flags.

## Community Validation

**@yacineMTB** (569 likes on X): "0 dependencies. It's not hard." -- validating the zero-dep philosophy for CLI tools.

**click-llm** takes the opposite approach: it auto-introspects Python Click CLI definitions to generate agent-compatible schemas. This works for existing CLIs but adds a dependency layer.

Our approach is better for new CLIs where you control the design from the start. For wrapping existing CLIs, tools like click-llm or `mycli llm --json` introspection make more sense.

## Implementation Checklist

- [ ] Define each command as a separate interface with `command` discriminant
- [ ] Shared flags go in a `GlobalFlags` base interface
- [ ] Parse result is `ParseOk | ParseError` discriminated union (never throw)
- [ ] Support both `--flag value` and `--flag=value` forms
- [ ] Unknown flags return a usage error (don't silently ignore)
- [ ] Command-specific flags are validated after the command is identified
