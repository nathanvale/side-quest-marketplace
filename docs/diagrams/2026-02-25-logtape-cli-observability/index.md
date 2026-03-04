---
created: 2026-03-04
title: LogTape CLI Observability
type: diagram
engine: markmap
tags: [logtape, logging, observability, cli, bun, mindmap]
project: word-on-the-street
status: draft
source:
  - docs/research/2026-02-25-logtape-cli-observability.md
---

## Mind Map

```markmap
---
markmap:
  color:
    - '#0072B2'
    - '#E69F00'
    - '#009E73'
    - '#D55E00'
    - '#56B4E9'
    - '#CC79A7'
    - '#F0E442'
  colorFreezeLevel: 2
  maxWidth: 320
  spacingVertical: 12
  spacingHorizontal: 80
  paddingX: 16
---

# LogTape CLI Observability

## Output Architecture
### Tier 1: stdout
- Program output only
- JSON envelopes, tables, markdown
- Never touched by logging
### Tier 2: stderr (LogTape)
- Diagnostic output
- --verbose / --debug / --quiet
- Human or JSON Lines format
### Tier 3: Side-channel
- Rotating log files
- OpenTelemetry spans
- Post-mortem analysis

## Why LogTape
### Zero dependencies
- 5.3 KB min+gz
- CLI cold start matters
### No-op by default
- Silent when unconfigured
- Library-first philosophy
### Bun-native
- 225ns/iteration (fastest)
- Pino 3.9x slower
- Winston 7.9x slower
### Async context
- withContext() + AsyncLocalStorage
- Propagates across Promise.all()

## Core Concepts
### Categories
- Hierarchical string arrays
- ["wots", "search", "reddit"]
- Logs propagate upward
### Sinks
- Console, Stream, File
- OpenTelemetry, Sentry
- Custom functions
### Formatters
- Text (human-readable)
- ANSI (colorized terminal)
- JSON Lines (machine-readable)
### Contexts
- Explicit: logger.with()
- Implicit: withContext()
- Lazy: evaluated at log time
### Fingers Crossed
- Buffers debug logs silently
- Flushes all on error
- No --debug flag needed

## CLI Architecture
### Category Hierarchy
- wots.cli (arg parsing)
- wots.cache (hits/misses)
- wots.search.reddit
- wots.search.x
- wots.search.youtube
- wots.score (relevance)
- wots.render (formatting)
### Flag-to-Level Mapping
- (none) -> warning
- --verbose -> info
- --debug -> debug
- --quiet -> error

## AI Agent Observability
### JSON Lines on stderr
- Structured diagnostics
- Source identification
- Rate limit details
### Context Properties
- source, topic, phase
- fromCache, rateLimited
- itemCount, cacheAgeHours
### Agent Workflow
- Run with --json --debug
- Parse stdout (result)
- Parse stderr (diagnostics)

## Gotchas
### Non-blocking loses logs
- Don't use for CLIs
- Short-lived processes
### Sentry init order
- Must init BEFORE configure()
- Silent event loss if reversed
### Bun stream sink
- process.stderr not WritableStream
- Use getConsoleSink() instead
### Duplicate categories
- Throws ConfigError
- One entry, multiple sinks
```

**Export:** Markmap engine, A4 landscape.
