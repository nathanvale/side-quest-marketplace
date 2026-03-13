# Agent Mode: Automatic Machine-Friendly Output

When stdout is not a TTY (piped to another process, run by an agent, or in CI/CD), the CLI automatically switches to machine-friendly output. No flags required.

## Detection

Reference implementation (`command.ts:710-712`):

```typescript
function shouldUseAutomaticMachineMode(): boolean {
  return !isatty(1)  // fd 1 = stdout
}
```

This is checked once at the top of `runCli()` and threaded through all output functions.

## Behavior

When auto machine mode is active (`command.ts:714-727`):

```typescript
function applyAutomaticOutputMode(
  options: CliOptions,
  autoMachineMode: boolean,
): CliOptions {
  if (!autoMachineMode) return options

  // JSONL is already machine-friendly, so just suppress prose
  if (options.command === 'events' && options.jsonl) {
    return { ...options, quiet: true }
  }

  // Everything else: force JSON + quiet
  return { ...options, quiet: true, json: true }
}
```

Key behaviors:
- **Non-TTY + no flags**: Forces `--json --quiet` automatically
- **Non-TTY + `--jsonl`**: Keeps JSONL, adds `--quiet` (JSONL is already machine-friendly)
- **TTY (terminal)**: No changes, human output as normal
- **Explicit `--json`**: Works regardless of TTY state

This means an agent never needs to remember to pass `--json`. Piping the output is enough:

```bash
# Agent gets JSON automatically
result=$(observability status)
echo "$result" | jq '.data.port'

# Explicit --json works too (redundant but harmless)
observability status --json | jq '.data.port'
```

## The `--non-interactive` Flag

Separate from output mode, `--non-interactive` disables interactive prompts:

```typescript
interface GlobalFlags {
  readonly json: boolean
  readonly quiet: boolean
  readonly nonInteractive: boolean  // disable prompts, fail fast
}
```

This is for scenarios where the CLI might prompt for user input (e.g., confirmation dialogs). In non-interactive mode, the CLI fails fast instead of blocking.

Current implementation doesn't have interactive prompts, but the flag is in place for future use. Always include it in new CLIs -- agents should never be blocked waiting for stdin.

## Three Audiences

Every command serves three audiences simultaneously:

| Audience | Detection | Output |
|----------|-----------|--------|
| Human at terminal | `isatty(1) === true` | Prose with `[observability]` prefix |
| Agent parsing output | `isatty(1) === false` or `--json` | JSON envelope on stdout |
| Agent piping to tools | `--jsonl` | One JSON object per line |

The key insight: the CLI doesn't need to know *which* agent is calling it. The non-TTY detection handles the general case, and explicit flags handle specific needs.

## Community Validation

**Laminar's headless agent guidelines**: "Never block for standard input." Our `--non-interactive` flag implements this. Their guidelines also require "JSON-strict mode" for agent output -- our auto non-TTY detection achieves the same result without requiring agents to configure anything.

**@Douglance's dbg tool**: "Stateless, one command in, one response out." This describes the ideal agent CLI interaction. Our auto machine mode ensures that every invocation produces clean, parseable output without state or setup.

**Key community principle**: An agent should be able to call any CLI command and get usable output without knowing anything about the CLI's configuration. Auto non-TTY detection makes this possible.

## Implementation Checklist

- [ ] Check `isatty(1)` at the start of the main entry point
- [ ] Non-TTY forces `--json --quiet` unless JSONL is already requested
- [ ] Include `--non-interactive` flag even if no prompts exist yet
- [ ] Never block for stdin when `--non-interactive` is set or stdout is non-TTY
