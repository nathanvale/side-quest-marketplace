---
title: MCP Server Patterns -- Side-Quest Runners Audit & Dual-Surface Template Architecture
date: 2026-03-07
type: research
status: complete
tags: [mcp, cli, dual-surface, template, bun, logtape, observability]
related:
  - docs/research/2026-03-07-agent-native-cli-best-practices.md
  - docs/research/2026-03-07-cli-mcp-dual-surface-patterns.md
  - docs/research/2026-03-07-cli-state-management-idempotency-safety-patterns.md
cross-references:
  # From side-quest-marketplace/docs/research/
  - title: "MCP Best Practices -- Prompt Engineering for Tool Descriptions"
    path: side-quest-marketplace/docs/research/2026-03-03-mcp-best-practices-prompt-engineering.md
    relevance: Tool description patterns, response_format, two-tier error system
  - title: "LogTape Observability for MCP Servers"
    path: side-quest-marketplace/docs/research/2026-03-04-logtape-mcp-server-observability.md
    relevance: stdout-is-sacred, fingers-crossed + isolateByContext, dual sinks
  - title: "MCP SDK Architecture Decision"
    path: side-quest-marketplace/docs/research/2026-03-04-mcp-sdk-architecture-decision.md
    relevance: Raw SDK over wrapper, registerTool() API, shared runner-utils plan
  - title: "MCP Community Intelligence"
    path: side-quest-marketplace/docs/research/2026-03-04-mcp-community-intelligence.md
    relevance: outputSchema early adoption, context pollution, ecosystem trends
  - title: "CLI Skills vs MCP Tools -- Adversarial Analysis"
    path: side-quest-marketplace/docs/research/2026-03-04-cli-skills-vs-mcp-tools-agentic-coding.md
    relevance: Token efficiency (CLI 35x cheaper), when to use CLI vs MCP
  - title: "LogTape Observability for CLI Tools -- Staff Engineer Technical Specification"
    path: side-quest-marketplace/docs/research/2026-02-25-logtape-cli-observability.md
    relevance: Three output tiers, flag-to-level mapping, fingers-crossed, AI agent observability
---

# MCP Server Patterns -- Side-Quest Runners Audit

## Source Material

Audit of three production MCP servers from `side-quest-runners`:

| Package | File | Lines | Tools |
|---------|------|-------|-------|
| bun-runner | `mcp/index.ts` | 1,172 | `bun_runTests`, `bun_testFile`, `bun_testCoverage` |
| biome-runner | `mcp/index.ts` | 1,247 | `biome_lintCheck`, `biome_lintFix`, `biome_formatCheck` |
| tsc-runner | `mcp/index.ts` | 1,152 | `tsc_check` |

Total: ~3,571 lines across 3 servers, 7 tools.

---

## Consistent Patterns Across All Three Servers

### 1. Server Lifecycle

Every server follows the same factory + start pattern:

```typescript
function createXxxServer(): McpServer { ... }
async function startXxxServer(): Promise<void> { ... }
```

- `createXxxServer()` -- registers tools, returns `McpServer` instance
- `startXxxServer()` -- configures LogTape, connects transport, handles signals

### 2. LogTape Configuration

All three servers use identical LogTape setup:

- **Fingers-crossed sink** -- buffers logs, flushes on error, silences on success
- **`isolateByContext`** -- per-request log isolation keyed by `requestId`
- **Dual sinks**: `stderrBuffered` (JSONL to stderr) + `mcpProtocol` (MCP `sendLoggingMessage`)
- **Category hierarchy**: `['side-quest', 'runner-name']`
- **AsyncLocalStorage** context propagation with `requestId`

This matches the pattern documented in the marketplace research doc "LogTape Observability for MCP Servers" and extends the CLI patterns from "LogTape Observability for CLI Tools -- Staff Engineer Technical Specification" into MCP territory.

### 3. Tool Registration Pattern

Every tool follows this structure:

```typescript
server.registerTool(
  'tool_name',
  {
    title: 'Human-readable title',
    description: 'Agent-facing description with usage guidance',
    inputSchema: { /* Zod schema */ },
    outputSchema: { /* Zod schema */ },
    annotations: {
      readOnlyHint: true/false,
      destructiveHint: true/false,
      idempotentHint: true/false,
      openWorldHint: false,
    },
  },
  async (params) => { /* handler */ }
);
```

Key observations:
- **`outputSchema` on every tool** -- early adoption, ahead of most MCP servers (per community intelligence research)
- **`response_format` parameter** on every tool -- `'json' | 'markdown'`, matching the prompt engineering research recommendation
- **MCP annotations** -- semantic hints for agents, all servers mark `openWorldHint: false`
- **Descriptions as routing signals** -- tool descriptions include when-to-use guidance, not just what-it-does

### 4. Path Security Validation

All three servers share identical path validation:

```typescript
function validatePath(inputPath: string, gitRoot: string): string {
  // 1. Null byte check
  // 2. Control character check
  // 3. Resolve to absolute path
  // 4. Boundary check against git root
  // 5. Symlink resolution + re-check boundary
  // 6. Existence check
  return resolvedPath;
}
```

This is ~60 lines duplicated 3 times. Critical security boundary -- validates at system edge, trusts internally.

### 5. Process Spawning

Consistent `spawnWithTimeout()` pattern:

- Configurable timeout (default varies: 120s for tests, 60s for lint/typecheck)
- SIGTERM first, then SIGKILL escalation after grace period
- Captures stdout + stderr separately
- Returns structured result with `exitCode`, `stdout`, `stderr`, `timedOut`

### 6. Error Response Structure

All tools return errors in a consistent envelope:

```typescript
{
  content: [{ type: 'text', text: JSON.stringify(errorPayload) }],
  structuredContent: errorPayload,
  isError: true,
}
```

Error payloads include:
- `error` -- human-readable message
- `errorCode` -- machine-readable code
- `hint` -- agent-actionable suggestion
- `remediationHint` -- specific fix suggestion (tsc-runner)

This aligns with the two-tier error system from the prompt engineering research, and mirrors the CLI's `ERROR_CODE_ACTIONS` pattern.

### 7. Response Format Switching

```typescript
if (params.response_format === 'json') {
  return { structuredContent: result, content: [{ type: 'text', text: JSON.stringify(result) }] };
} else {
  return { content: [{ type: 'text', text: formatAsMarkdown(result) }] };
}
```

JSON mode returns structured data for machine consumption. Markdown mode formats for human display. This is the dual-mode pattern recommended in the prompt engineering research.

---

## Duplicated Code Analysis

~320 lines are nearly identical across all three servers:

| Pattern | Approx Lines | Duplication |
|---------|-------------|-------------|
| LogTape setup (fingers-crossed, isolate, dual sinks) | ~80 | 3x |
| Path validation (`validatePath`) | ~60 | 3x |
| `spawnWithTimeout()` | ~50 | 3x |
| Error response formatting | ~30 | 3x |
| Signal handling (SIGINT, SIGTERM) | ~20 | 3x |
| Git root discovery | ~25 | 3x |
| `response_format` switching | ~20 | 3x |
| Server start boilerplate | ~35 | 3x |

**Total duplicated: ~960 lines** (320 x 3).

This validates the SDK architecture research's recommendation for a shared `runner-utils` package. These patterns are stable, battle-tested, and ready for extraction.

---

## Unique Per-Server Patterns

### bun-runner
- Test file discovery via `Bun.Glob`
- Coverage parsing (line/branch/function/statement)
- Test result aggregation (pass/fail/skip counts)

### biome-runner
- Biome binary discovery (`bunx biome` vs local install)
- Diagnostic severity mapping (error/warning/info)
- Auto-fix diff generation

### tsc-runner
- `detectTsBuildInfoCorruption()` -- checks for corrupt incremental build cache
- `findNearestTsConfig()` -- walks up to git root boundary
- TypeScript diagnostic categorization (error/warning/suggestion)
- `remediationHint` field in error responses

---

## Dual-Surface Template Architecture

Based on the audit of both the xero-cli (CLI surface) and side-quest-runners (MCP surface), here's the proposed template architecture for `bun-typescript-starter`:

```
src/
  core/                    # Shared between CLI and MCP
    schemas/               # Zod schemas (input, output, domain)
    errors.ts              # Error codes, hints, fingerprinting
    logging.ts             # LogTape setup (fingers-crossed, context)
    types.ts               # Shared domain types
    events.ts              # Fire-and-forget event emission

  cli/                     # CLI surface
    cli.ts                 # Entry point, arg parsing
    command.ts             # Discriminated union dispatch
    output.ts              # JSON envelope formatting
    commands/              # Per-command handlers

  mcp/                     # MCP surface
    server.ts              # createServer() + startServer()
    tools/                 # Per-tool registrations
    security.ts            # Path validation, boundary checks
    spawn.ts               # spawnWithTimeout()

  bin/
    cli.ts                 # #!/usr/bin/env bun -- CLI entry
    mcp.ts                 # #!/usr/bin/env bun -- MCP entry
```

### Key Design Principles

1. **Shared core, thin surfaces** -- Business logic lives in `src/core/`. CLI and MCP are thin wrappers that handle I/O serialization.

2. **Same schemas, different serialization** -- Zod schemas define the contract once. CLI wraps in JSON envelopes with `schemaVersion`. MCP uses `outputSchema` + `structuredContent`.

3. **Same errors, different presentation** -- Error codes and hints defined once in `core/errors.ts`. CLI formats via `ERROR_CODE_ACTIONS` + exit codes. MCP formats via `isError` + `hint` fields.

4. **Same logging, different sinks** -- LogTape configured once with fingers-crossed. CLI sends to stderr. MCP sends to stderr + MCP protocol logging.

5. **Independent entry points** -- `bin/cli.ts` and `bin/mcp.ts` can be published as separate binaries or the same package with different `bin` entries in `package.json`.

### Token Efficiency Consideration

Per the CLI-vs-MCP adversarial analysis:
- CLI is ~35x more token-efficient for simple operations
- MCP provides structured schemas, portability, and stateful sessions
- **Recommendation**: Ship both. Let agents choose the right surface for the task.

---

## Gaps and Opportunities

### Compared to CLI Best Practices Research

| CLI Pattern | MCP Equivalent | Status |
|-------------|---------------|--------|
| JSON envelope with `schemaVersion` | `outputSchema` | Covered |
| `ERROR_CODE_ACTIONS` registry | Per-tool `hint` field | Partial -- MCP hints are inline, not centralized |
| Exit code mapping (0-5, 130) | `isError` boolean | Gap -- MCP only has binary error/success |
| Structured error fingerprints | Not implemented | Gap |
| Fire-and-forget events | Not implemented | Gap -- MCP servers don't emit lifecycle events |
| `--dry-run` / preview mode | `readOnlyHint` annotation | Different mechanism, same intent |
| Progress reporting (`--progress`) | MCP progress tokens | Not yet implemented in runners |

### Recommended Additions for Template

1. **Centralized error hint registry for MCP** -- extract from inline strings to a shared `ERROR_CODE_ACTIONS`-style map
2. **Error fingerprinting in MCP** -- reuse `createErrorFingerprint()` from CLI
3. **MCP lifecycle events** -- emit `tool-started`, `tool-completed`, `tool-failed` to observability server
4. **Progress token support** -- for long-running tools like test suites
5. **Health check tool** -- lightweight `ping` tool for connection verification

---

## Relationship to Existing Research

This audit completes the research triangle:

1. **Agent-Native CLI Best Practices** (`2026-03-07-agent-native-cli-best-practices.md`) -- CLI surface patterns from xero-cli
2. **CLI-MCP Dual Surface Patterns** (`2026-03-07-cli-mcp-dual-surface-patterns.md`) -- theoretical framework for dual surfaces
3. **This document** -- empirical MCP patterns from production side-quest-runners

Together with the marketplace research:
- **MCP Prompt Engineering** -- tool descriptions as routing signals (validated by runners)
- **LogTape MCP Observability** -- dual sinks, fingers-crossed (validated by runners)
- **SDK Architecture Decision** -- raw SDK, registerTool() (validated by runners)
- **CLI vs MCP Adversarial Analysis** -- token efficiency, when to use each (informs template design)
- **LogTape CLI Observability** -- three-tier output, staff engineer spec (CLI surface foundation)

The template should synthesize all of these into a zero-config scaffold that ships both surfaces from day one.
