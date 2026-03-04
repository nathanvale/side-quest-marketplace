---
created: 2026-02-25
title: LogTape Observability for CLI Tools -- Staff Engineer Technical Specification
type: research
tags: [logtape, logging, observability, cli, bun, structured-logging, async-context, ai-agent, typescript]
project: word-on-the-street
status: draft
---

# LogTape Observability for CLI Tools

Staff engineer technical specification for structured logging, AI-agent observability, and production debugging in Bun CLI tools -- with `@side-quest/word-on-the-street` (wots) as the reference implementation.

## Summary

LogTape is a zero-dependency, runtime-agnostic structured logging library with a "library-first" philosophy. Its defining property: if nobody calls `configure()`, all logging is a silent no-op. This makes it uniquely suited to CLI tools serving three audiences: humans (clean output), developers (structured context), and AI agents (machine-readable diagnostics).

## Key Findings

- LogTape is the fastest logger on Bun (225ns/iteration vs Pino 874ns, Winston 1,770ns)
- Zero dependencies, 5.3 KB min+gz -- ideal for CLI tools distributed via `bunx`
- `withContext()` + `AsyncLocalStorage` propagates context across `Promise.all()` branches automatically
- "Fingers crossed" sink buffers debug logs silently, flushes everything on error -- no `--debug` flag needed for post-mortem
- Library consumers who never call `configure()` see zero output, zero warnings, zero overhead
- Bun requires manual `WritableStream` wrapping for stream sinks -- simpler to use `getConsoleSink()` with a formatter

## Details

### Why Logging in CLI Tools is Different

Backend servers have one output consumer (log aggregator). CLIs have three:

| Consumer | Wants | Channel |
|----------|-------|---------|
| End user | Clean program output, no noise | `stdout` |
| Developer | Structured debug context | `stderr` |
| AI agent | Machine-parseable diagnostics | `stderr` (JSON Lines) |

**Rule #1**: Program output goes to `stdout`. Logs go to `stderr`. Always.

### The Three Output Tiers

```
Tier 1: Program output (stdout)
  - The actual result: JSON envelopes, compact tables, markdown
  - NEVER touched by logging

Tier 2: Diagnostic output (stderr)         <-- LogTape lives here
  - Progress indicators, debug messages, warnings
  - Controlled by --verbose / --debug / --quiet

Tier 3: Side-channel output (files, telemetry)
  - Rotating log files, OpenTelemetry spans
  - For post-mortem analysis
```

### CLIs vs Backends

| Concern | Backend Server | CLI Tool |
|---------|---------------|----------|
| Default output | JSON Lines to aggregator | Human-readable to stderr |
| stdout | N/A (or health checks) | Sacred -- reserved for program output |
| Lifetime | Long-running process | Seconds to minutes |
| Verbosity control | Per-service config file | `--verbose` / `--debug` flags |
| Default formatter | Always JSON Lines | Human-readable; JSON when piped |
| Log volume | High (requests/sec) | Low (one run = one execution) |
| Buffering tradeoff | Throughput > durability ok | Durability > throughput (short-lived) |

### Why LogTape

Selection criteria for Bun CLI logging:

1. **Zero-dependency** -- CLI tools distributed via `bunx`; every dependency is download time
2. **No-op by default** -- library consumers who don't configure see zero output
3. **First-class Bun support** -- tested and benchmarked on Bun
4. **Structured + human-readable** -- same log call, different formatters per context
5. **Async context propagation** -- `Promise.all()` orchestration needs implicit context
6. **Small bundle** -- CLI cold start matters

| Criterion | LogTape | Pino | Winston |
|-----------|---------|------|---------|
| Dependencies | 0 | 1 | 17 |
| Bundle (min+gz) | 5.3 KB | 3.1 KB | 38.3 KB |
| No-op default | Yes (core design) | No (requires config) | No |
| Bun support | Full (official) | Limited (unofficial) | Limited |
| Async context | `withContext()` + `AsyncLocalStorage` | Via `pino.child()` (manual) | Via `child()` (manual) |
| Tree-shakable | Yes | No | No |

### Core Concepts

**Categories** -- hierarchical string arrays forming a tree. Logs propagate upward to parent loggers:

```typescript
const root   = getLogger(["wots"]);
const cache  = getLogger(["wots", "cache"]);
const reddit = getLogger(["wots", "search", "reddit"]);
```

**Sinks** -- functions receiving log records. Built-in: Console, Stream, File, Rotating File. Ecosystem: OpenTelemetry, Sentry, CloudWatch.

**Formatters** -- three built-in:
- Default text (human-readable)
- ANSI color (colorized terminal)
- JSON Lines (machine-readable)

**Contexts** -- key-value properties attached to log messages:
- Explicit: `logger.with({ topic: "Claude Code" })`
- Implicit: `withContext({ topic }, async () => { ... })` -- propagates across async boundaries
- Lazy: `lazy(() => computeExpensiveValue())` -- evaluated at log time only

**Levels**: fatal > error > warning > info > debug > trace

**Fingers Crossed Sink** -- buffers debug/trace logs silently, flushes entire buffer on error:

```typescript
await configure({
  sinks: {
    console: fingersCrossed(getConsoleSink(), {
      triggerLevel: "error",
      maxBufferSize: 500,
    }),
  },
  loggers: [
    { category: ["wots"], sinks: ["console"], lowestLevel: "debug" },
  ],
});
```

### Architecture for CLI Tools

**Category hierarchy design** (functional boundaries, not file structure):

```
wots                          # Root -- catch-all
├── wots.cli                  # Arg parsing, flag resolution, entry/exit
├── wots.cache                # Cache hits, misses, stale fallbacks, locks
├── wots.search               # Search orchestration
│   ├── wots.search.reddit    # OpenAI Responses API calls
│   ├── wots.search.x         # xAI API calls
│   ├── wots.search.youtube   # yt-dlp invocations
│   └── wots.search.web       # Web search instructions
├── wots.score                # Relevance/recency/engagement scoring
├── wots.render               # Output formatting decisions
└── wots.watchlist            # SQLite ops, briefing generation
```

**Sink configuration strategy**:

```typescript
export async function setupLogging(opts: LoggingOptions): Promise<void> {
  const level = opts.debug ? "debug"
    : opts.verbose ? "info"
    : opts.quiet ? "error"
    : "warning";

  const isInteractive = process.stderr.isTTY && !opts.json;

  await configure({
    contextLocalStorage: new AsyncLocalStorage(),
    sinks: {
      stderr: getConsoleSink({
        formatter: isInteractive ? ansiColorFormatter : jsonLinesFormatter,
      }),
    },
    loggers: [
      { category: ["wots"], sinks: ["stderr"], lowestLevel: level },
    ],
  });
}
```

**Flag-to-level mapping**:

| User Intent | Flag | Level | What They See |
|------------|------|-------|---------------|
| Normal use | (none) | `warning` | Only problems |
| Curious | `--verbose` | `info` | Lifecycle events |
| Debugging | `--debug` | `debug` | Full diagnostic detail |
| Silent | `--quiet` | `error` | Only errors |
| AI agent | `--json --quiet` | `error` + JSON | Machine-readable errors only |
| AI agent debugging | `--json --debug` | `debug` + JSON | Full structured diagnostics |

### Implementation Guide

**Installation**: `bun add @logtape/logtape` (only required package)

**Entry point wiring** -- call `setupLogging()` as the first async operation in `main()`.

**Parallel search context wrapping** -- wrap each `Promise.all()` branch with `withContext()`:

```typescript
promises.push(
  withContext({ source: "reddit", topic }, async () => {
    logger.info("Search started");
    const result = await searchRedditTask(/* ... */);
    if (result.fromCache) {
      logger.debug("Cache hit (age={ageHours}h)", { ageHours: result.cacheAgeHours });
    }
    logger.info("Search complete: {count} items", { count: result.items.length });
  })
);
```

**What NOT to log**:

| Don't Log | Why | Instead |
|-----------|-----|---------|
| Raw API responses | Huge, may contain user data | Log item counts and status codes |
| Scoring loop iterations | 50+ items * multiple factors = noise | Log final top-5 scores |
| API keys or tokens | Security risk | Log `"key=present"` / `"key=missing"` |

### AI Agent Observability

With LogTape, agents can run `wots "topic" --json --debug` and parse structured JSON Lines from stderr:

```typescript
const proc = Bun.spawn(["wots", topic, "--json", "--debug"], {
  stdout: "pipe",
  stderr: "pipe",
});
const result = JSON.parse(await new Response(proc.stdout).text());
const diagnostics = (await new Response(proc.stderr).text())
  .split("\n").filter(Boolean).map(line => JSON.parse(line));
```

**Context properties for agent consumption**:

| Property | Type | Purpose |
|----------|------|---------|
| `source` | `"reddit" \| "x" \| "youtube" \| "web"` | Which search source |
| `topic` | `string` | The search topic |
| `phase` | `"search" \| "score" \| "render"` | Pipeline stage |
| `fromCache` | `boolean` | Whether result came from cache |
| `rateLimited` | `boolean` | Whether source was rate-limited |
| `itemCount` | `number` | Number of results returned |

### Testing

- Reset LogTape between tests with `await reset()` (global singleton)
- Use buffer sink pattern: `const buffer: LogRecord[] = []; ... sinks: { buffer: buffer.push.bind(buffer) }`
- Configure `contextLocalStorage: new AsyncLocalStorage()` when testing `withContext()` code
- Assert on: log level, category, context properties. Don't assert on: exact message text, timestamps, log ordering

### The Library/CLI Boundary

Two entry points:
- `cli.ts` -- CLI entry point (owns I/O, calls `configure()`)
- `index.ts` -- library barrel export (pure, no side effects)

**Rules**: Only `cli.ts` calls `configure()`. Library code calls `getLogger()` freely. Consumers configure their own LogTape or get silence.

### Gotchas and Pitfalls

1. **Non-blocking mode loses logs on crash** -- don't use `nonBlocking: true` for CLIs (short-lived processes)
2. **Sentry init order** -- must initialize Sentry BEFORE `configure()`, or events silently drop
3. **OTel nested object serialization** -- bug fixed Jan 2026 in `logtape-otel`, ensure latest version
4. **Redaction is partial** -- `@logtape/redaction` is "not foolproof", sanitize PII before log calls
5. **Duplicate categories throw ConfigError** -- use one entry with multiple sinks, not multiple entries
6. **Don't mix sync/async config** -- `configure()`/`reset()` and `configureSync()`/`resetSync()` are separate tracks
7. **Bun stream sink** -- `process.stderr` isn't a `WritableStream` on Bun; use `getConsoleSink()` with a formatter instead

### Migration Guide

| Phase | Effort | What |
|-------|--------|------|
| 1. Foundation | ~30 min | Add LogTape, config module, wire into CLI, replace `[debug]` stderr writes |
| 2. Async context | ~1 hour | Wrap `Promise.all()` branches with `withContext()`, add cache logging |
| 3. Fingers crossed | ~30 min | Buffer debug logs, auto-flush on error |
| 4. Ecosystem | As needed | File sinks, OTel, Sentry, config-from-file, redaction |

### Performance

**Console logging (ns/iteration on Bun)**:

| Library | Bun (ns) | Relative |
|---------|----------|----------|
| LogTape | 225 | 1.0x (baseline) |
| Pino | 874 | 3.9x slower |
| Winston | 1,770 | 7.9x slower |

A typical wots run logs ~20-50 messages. At 225ns each, that's ~11 microseconds total -- invisible.

No-op overhead (library consumer case): ~187ns per call. For 100 calls, ~19 microseconds.

`withContext()` cost: ~200-500ns per async operation via `AsyncLocalStorage`.

### Comparison Matrix

| Feature | LogTape | Pino | Winston | Console |
|---------|---------|------|---------|---------|
| Bundle (min+gz) | 5.3 KB | 3.1 KB | 38.3 KB | 0 KB |
| Dependencies | 0 | 1 | 17 | 0 |
| Bun support | Full | Limited | Limited | Full |
| No-op default | Yes | No | No | N/A |
| Async context | Built-in | Manual child() | Manual child() | No |
| Hierarchical categories | Yes | No (flat) | No (flat) | No |
| Fingers crossed | Built-in | No | No | No |
| Lazy evaluation | Built-in | No | No | No |

### Decision Framework for wots

| Factor | Assessment |
|--------|-----------|
| Parallel async orchestration | Yes -- Reddit, X, YouTube, web in `Promise.all()` |
| Called by AI agents | Yes -- Beat Reporter sub-agents via `bunx` |
| Multiple failure modes | Yes -- rate limits, stale cache, API errors, yt-dlp failures |
| Distributed to users | Yes -- published on npm |
| Library export | Yes -- `src/index.ts` barrel for programmatic use |

**Verdict**: LogTape is a clear fit. All checklist items are true.

### When NOT to Use LogTape

- Single-file scripts with one code path -- just use `console.error()`
- No async orchestration -- context propagation provides no benefit
- Bundle size is sacred and you have zero runtime deps
- Personal tool you only debug by reading source code

**Add LogTape if 2+ are true**: parallel async ops, called by AI agents, multiple failure modes, distributed to users, need per-module verbosity, want structured diagnostics.

## Sources

- [LogTape Home](https://logtape.org/) -- main documentation site
- [Quick Start](https://logtape.org/manual/start) -- installation and basic setup
- [Configuration](https://logtape.org/manual/config) -- full `configure()` reference
- [Categories](https://logtape.org/manual/categories) -- hierarchical logger design
- [Sinks](https://logtape.org/manual/sinks) -- all sink types and custom sinks
- [Formatters](https://logtape.org/manual/formatters) -- text, ANSI, JSON Lines, Pretty
- [Contexts](https://logtape.org/manual/contexts) -- explicit, implicit, lazy contexts
- [Library Authors](https://logtape.org/manual/library) -- guide for library-first design
- [Testing](https://logtape.org/manual/testing) -- reset, buffer sinks, test isolation
- [Comparison](https://logtape.org/comparison) -- benchmarks and feature matrix vs alternatives
- [Logging in Node.js/Deno/Bun 2026](https://hackers.pub/@hongminhee/2026/logging-nodejs-deno-bun-2026) -- author's comprehensive guide
- [Trace-Connected Structured Logging with LogTape and Sentry](https://blog.sentry.io/trace-connected-structured-logging-with-logtape-and-sentry/) -- Sentry integration guide
- [Fedify Case Study](https://hackers.pub/@hongminhee/2025/logtape-fedify-case-study) -- origin story and library-first design rationale

### Ecosystem Packages

| Package | Purpose |
|---------|---------|
| `@logtape/file` | File + rotating file sinks |
| `logtape-otel` | OpenTelemetry sink |
| `@logtape/sentry` | Sentry error tracking |
| `@logtape/config` | Config from JSON/YAML/TOML |
| `@logtape/redaction` | Pattern-based PII masking |
| `@logtape/pretty` | Emoji-rich dev formatter |
| `@logtape/adaptor-pino` | Bridge to Pino infrastructure |

## Open Questions

- Should `fingersCrossed` be the default sink for wots, or opt-in via a flag?
- When to add `@logtape/config` for per-category debugging without `--debug` flooding?
- Is the Bun `WritableStream` wrapping issue resolved in newer Bun versions?
- Worth adding `logtape-otel` for wots watchlist/briefing cron jobs?
