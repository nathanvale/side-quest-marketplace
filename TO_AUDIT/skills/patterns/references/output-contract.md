# Output Contract: Tri-Modal Output

Every command produces output in one of three modes. The mode is selected by flags or auto-detected from the environment.

## The Three Modes

| Mode | Flag | Channel | Format | Audience |
|------|------|---------|--------|----------|
| Human | (default) | stdout | Prefixed prose lines | Developer at a terminal |
| JSON | `--json` | stdout | `{"status":"data","data":{...}}` | Agent parsing structured output |
| JSONL | `--jsonl` | stdout | One JSON object per line | Agent piping to jq or another tool |

Human mode is the default. JSON mode wraps everything in a typed envelope. JSONL mode streams individual records for piping.

## JSON Success Envelope

All JSON success output uses the same envelope:

```json
{"status":"data","data":{...command-specific payload...}}
```

Reference implementation (`command.ts:1490-1507`):

```typescript
function writeSuccess<T>(
  ctx: OutputContext,
  data: T,
  humanLines: string[],
  quietLine: string,
): void {
  if (ctx.json) {
    process.stdout.write(`${JSON.stringify({ status: "data", data })}\n`)
    return
  }
  if (ctx.quiet) {
    process.stdout.write(`${quietLine}\n`)
    return
  }
  process.stdout.write(`${humanLines.join("\n")}\n`)
}
```

The `data` field contains the full command result. Every command defines a typed interface for its data (e.g., `StartSuccessData`, `StatusSuccessData`, `EventsSuccessData`).

## NDJSON Streaming

For list-style commands, JSONL mode writes one JSON object per line with no wrapping envelope:

```typescript
// command.ts:993-998
if (options.jsonl) {
  for (const event of events) {
    process.stdout.write(`${JSON.stringify(event)}\n`)
  }
  return EXIT_OK
}
```

JSONL is mutually exclusive with `--json`. The parser enforces this:

```typescript
if (json && jsonl) {
  return parseUsageError(
    '--json and --jsonl cannot be used together',
    usageText(), json, quiet,
  )
}
```

## Auto Non-TTY Detection

When stdout is not a TTY (e.g., piped to another process), the CLI automatically switches to machine-friendly output. See `references/agent-mode.md` for details.

## Quiet Mode

`--quiet` suppresses verbose human output and emits a single summary line instead:

- Human mode + quiet: one-line summary on stdout
- JSON mode: quiet has no effect (JSON is already minimal)
- Errors + quiet: plain message on stderr (no `[observability]` prefix)

## Community Validation

**joelclaw.com** advocates JSON-first CLI design where every command returns structured data by default. Our approach is JSON-optional (human default, JSON on request) which is more backwards-compatible while still serving agents.

**Laminar's headless agent guidelines** require "JSON-strict" mode where agents never see prose. Our auto non-TTY detection achieves this without requiring the agent to know about `--json`.

**Advanced pattern (not yet implemented):** joelclaw.com proposes HATEOAS-style `next_actions` in JSON responses, telling agents what they can do next. Example: a `start` response could include `{"next_actions":["status","stop","events"]}`. This is a future enhancement opportunity.

## Implementation Checklist

- [ ] Every command has a typed data interface (e.g., `StartSuccessData`)
- [ ] All success output goes through a single `writeSuccess` function
- [ ] JSON output uses `{"status":"data","data":{...}}` envelope on stdout
- [ ] JSONL mode writes one `JSON.stringify(item)\n` per record
- [ ] `--json` and `--jsonl` are mutually exclusive (parser enforces this)
