# Help System: Topic-Based Self-Documenting Help

The help system lets both humans and agents query specific domains of the CLI. Running the CLI with no arguments returns the complete command tree.

## Help Topics

| Topic | Aliases | Content |
|-------|---------|---------|
| `overview` | `usage`, `all` | Full command tree, all flags, examples |
| `start` | `server` | Start command details |
| `status` | -- | Status command details |
| `stop` | -- | Stop command details |
| `events` | -- | Events command with filtering flags |
| `api` | `http`, `routes` | HTTP routes, envelope shape |
| `contract` | `output`, `json` | Machine output contract, exit codes |

## Access Patterns

Three ways to request help:

```bash
# Topic-based help
observability help api
observability help contract

# Command-specific help
observability start --help
observability events -h

# Inline topic after --help
observability --help api
```

All three forms resolve to the same output. The parser handles this in `command.ts:181-206`.

## Topic Normalization

Raw input is normalized to a canonical topic (`command.ts:1271-1301`):

```typescript
function normalizeHelpTopic(raw: string): HelpTopic | null {
  const value = raw.trim().toLowerCase()
  switch (value) {
    case 'overview': case 'usage': case 'all': return 'overview'
    case 'start': case 'server': return 'start'
    case 'api': case 'http': case 'routes': return 'api'
    case 'contract': case 'output': case 'json': return 'contract'
    // ...
    default: return null
  }
}
```

Unknown topics return a usage error, not a silent fallback. This helps agents detect typos.

## Self-Documenting Root Command

Running with no arguments returns the complete usage text (`command.ts:173-175`):

```typescript
if (args.length === 0) {
  return parseHelp(false, false)
}
```

The overview text (`command.ts:1083-1151`) includes:
- Command summary with all commands and aliases
- Global options
- Per-command options
- CLI output contract (JSON success/error shapes)
- HTTP API routes and envelope shape
- Environment variables
- Exit code table
- Human and agent usage examples
- Available help topics

This is critical for agents -- they can run the CLI once with no arguments and learn everything they need to construct valid commands.

## Help as ParseCliError

Help requests are returned as `ParseCliError` with `exitCode: EXIT_OK` (`command.ts:1050-1064`):

```typescript
function parseHelp(
  json: boolean,
  quiet: boolean,
  topic: HelpTopic = 'overview',
): ParseCliError {
  return {
    ok: false,
    exitCode: EXIT_OK,
    message: 'Help requested',
    output: helpText(topic),
    errorCode: 'E_HELP',
    json, quiet,
  }
}
```

This reuses the error path for output formatting while exiting cleanly with code 0.

## Community Validation

**joelclaw.com** emphasizes the "self-documenting root" pattern where running a CLI with no args returns everything an agent needs. Our implementation follows this exactly.

**click-llm** takes it further with `mycli llm --json`, which returns a machine-readable schema of all commands and their flags. This is a more structured alternative -- our help text is prose-oriented, which works for both humans and LLM agents but isn't ideal for programmatic introspection.

## Implementation Checklist

- [ ] Running with no args returns the complete command tree
- [ ] Help topics cover every command plus cross-cutting concerns (API, contract)
- [ ] Topic aliases normalize common synonyms (http -> api, json -> contract)
- [ ] Unknown topics return a usage error, not silent fallback
