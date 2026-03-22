# Best Practices: Building CLI Tools for AI Agent Consumption

> Research synthesis - 2026-03-07
> Sources: curated skills, online articles, framework docs, real-world CLIs

---

## Table of Contents

1. [Output Contracts](#1-output-contracts)
2. [Error Design for Agents](#2-error-design-for-agents)
3. [Observability Stack](#3-observability-stack)
4. [Command Architecture](#4-command-architecture)
5. [MCP Integration](#5-mcp-integration)
6. [Agent-Native Design Principles](#6-agent-native-design-principles)
7. [Bun-Specific Patterns](#7-bun-specific-patterns)
8. [Reference Implementations](#8-reference-implementations)

---

## 1. Output Contracts

### The Cardinal Rule

**JSON to stdout, everything else to stderr.** This is the single most important rule for agent-consumable CLIs. Mixing human text into stdout breaks machine parsing.

### Envelope Pattern

Wrap all output in a stable envelope with a schema version. This allows agents to detect breaking changes and adapt.

```json
{
  "status": "data",
  "schemaVersion": 1,
  "data": {
    "command": "transactions",
    "count": 42,
    "items": [...]
  },
  "warnings": []
}
```

**Why `schemaVersion`:** When you add fields, agents built against v1 keep working. When you rename or remove fields, bump the version so agents can detect the change instead of silently breaking.

**Why `warnings`:** An optional array that surfaces non-fatal issues (typos in field names, deprecation notices) without polluting the data or causing a non-zero exit. Agents should inspect warnings and self-correct.

### Format Recommendations

| Format | When to Use | Trade-offs |
|--------|-------------|------------|
| **JSON** | Default for structured responses | Parseable, but verbose. Token-expensive for large payloads. |
| **NDJSON (JSON Lines)** | Streaming/incremental output | One JSON object per line. Great for progress, large result sets, multi-phase flows. |
| **TOON (Token-Oriented Object Notation)** | Extreme token optimization | Sol's columnar format. 98% fewer tokens than JSON, 15% fewer than plain text. Experimental but promising. |
| **Tab-delimited** | Pipe-friendly bare output | GitHub CLI's approach for `--quiet` mode. One value per line or tab-separated fields. |

### Auto-Detection

The CLI should detect whether stdout is a TTY:
- **TTY (human):** Pretty-print, colors, tables, progress bars
- **Non-TTY (agent/pipe):** Structured JSON, no colors, no truncation, no interactive prompts

GitHub CLI does this automatically. Your CLI should too. Implement a `--json` flag as an explicit override, but make non-TTY default to JSON.

### Channel Discipline

| Channel | Content | Examples |
|---------|---------|----------|
| **stdout** | Machine-parseable data only | JSON envelopes, NDJSON streams |
| **stderr** | Diagnostics, logs, progress | LogTape output, debug traces, spinners |
| **exit code** | Categorical result status | 0=success, 2=usage error, 4=auth failure |

**Non-negotiable:** Never write a log line, a progress update, or a human-friendly message to stdout in JSON mode.

### Field Naming

- Use **PascalCase dot paths** for API-derived fields (e.g., `Contact.Name`, `BankTransactionID`)
- Use **camelCase** for CLI-native fields (e.g., `schemaVersion`, `count`)
- Be **consistent** across commands -- same field name means same type everywhere
- Keep output **flat over deeply nested** when possible -- agents parse shallow structures more reliably

---

## 2. Error Design for Agents

### The Problem

When an agent gets an error, it needs to answer three questions:
1. **What went wrong?** (error code + message)
2. **Is it worth retrying?** (retryable flag + delay hint)
3. **What should I do next?** (action hint + suggested fallbacks)

Generic "Error occurred" messages answer none of these. Structured error envelopes answer all three.

### Error Envelope Schema

```json
{
  "status": "error",
  "message": "Rate limit exceeded",
  "error": {
    "name": "XeroApiError",
    "code": "E_RATE_LIMITED",
    "action": "WAIT_AND_RETRY",
    "retryable": true,
    "errorFamily": "rate_limit",
    "severity": "warning",
    "recoverability": "retry",
    "hintVersion": 2,
    "exitCodeHint": 1,
    "recommendedDelayMs": 30000,
    "safeToRetrySameInput": true,
    "idempotencyRisk": "none",
    "context": {
      "retryAfterMs": 30000
    }
  }
}
```

### Required Fields

| Field | Purpose | Example |
|-------|---------|---------|
| `code` | Machine-parseable error identifier | `E_RATE_LIMITED`, `E_USAGE`, `E_UNAUTHORIZED` |
| `action` | What the agent should do | `WAIT_AND_RETRY`, `FIX_ARGS`, `RUN_AUTH`, `ESCALATE` |
| `retryable` | Whether retry is worth attempting | `true` / `false` |
| `errorFamily` | Classification bucket | `auth`, `rate_limit`, `validation`, `network`, `conflict` |

### Recommended Optional Fields

| Field | Purpose |
|-------|---------|
| `recommendedDelayMs` | How long to wait before retry |
| `safeToRetrySameInput` | Whether the exact same input can be retried |
| `idempotencyRisk` | `none`, `low`, `high` -- risk of duplicate side effects |
| `nextCommand` | Specific command to run next (e.g., `"auth"`) |
| `suggestedFallbacks` | Ordered list of recovery strategies |
| `canResume` | Whether a checkpoint exists to resume from |
| `stateFile` / `checkpointId` | Resume coordinates |
| `context` | Structured metadata for programmatic recovery |

### Action Value Taxonomy

Define a finite set of machine-readable actions:

| Action | Meaning | Agent Behavior |
|--------|---------|---------------|
| `NONE` | No action needed | Log and continue |
| `FIX_ARGS` | Invalid arguments | Re-read --help, fix flags |
| `RUN_AUTH` | Auth expired | Prompt user for auth flow |
| `WAIT_AND_RETRY` | Rate limit or lock | Wait `recommendedDelayMs`, retry |
| `RETRY_WITH_BACKOFF` | Transient failure | Exponential backoff retry |
| `REFETCH_AND_RETRY` | Stale data | Re-fetch dependencies, retry |
| `INSPECT_AND_RESOLVE` | Conflict | Show details to user |
| `CHECK_NETWORK` | Network failure | Verify connectivity |
| `ESCALATE` | Unrecoverable | Stop and ask user |

### Exit Code Convention

Go beyond 0/1. A richer exit code set lets agents make decisions without parsing JSON:

| Exit Code | Constant | Meaning |
|-----------|----------|---------|
| 0 | `EXIT_OK` | Success |
| 1 | `EXIT_RUNTIME` | Runtime error (API, network) |
| 2 | `EXIT_USAGE` | Invalid arguments or flags |
| 3 | `EXIT_NOT_FOUND` | Resource not found |
| 4 | `EXIT_UNAUTHORIZED` | Auth expired/invalid |
| 5 | `EXIT_CONFLICT` | Concurrent modification |
| 130 | `EXIT_INTERRUPTED` | SIGINT |

### Echo the Failing Input

When an error is caused by bad input, **include the rejected value** in the error context. This is one of the highest-impact patterns for agent self-correction:

```json
{
  "code": "E_USAGE",
  "action": "FIX_ARGS",
  "context": {
    "invalidFields": ["Contcat.Name"],
    "validFieldsHint": "Fields are PascalCase dot paths (e.g., Contact.Name)"
  }
}
```

The agent sees "Contcat.Name" is wrong, sees the hint about PascalCase dot paths, and self-corrects to "Contact.Name" without human intervention.

### Unknown Error Fallback

Every error code mapping system needs a default case. Unknown/unmapped errors should degrade to `action: "ESCALATE"` with `retryable: false`. Never leave an agent guessing.

---

## 3. Observability Stack

### Three-Tier Architecture

| Tier | Destination | Content | Blocking? |
|------|-------------|---------|-----------|
| **Stdout** | Program output | JSON data envelopes | Yes (primary output) |
| **Stderr** | Diagnostic logs | Structured logs via LogTape | No (buffered) |
| **Events** | Observability server | Fire-and-forget telemetry | Never |

### Logging Framework: LogTape

**Why LogTape over pino/winston:**
- Zero dependencies (critical for CLI cold start)
- Library-first design -- libraries can log without configuration, apps control output
- Native Bun/Deno/Node support
- Hierarchical categories with level inheritance
- Built-in structured logging with message templates
- Built-in redaction support
- OpenTelemetry integration via `@logtape/otel`
- Fingers-crossed sink (the killer feature for CLIs)

### Fingers-Crossed Pattern

This is the most important logging pattern for agent-consumed CLIs:

1. Buffer ALL log messages (including debug-level) during execution
2. If the command **succeeds**: discard the buffer (zero noise)
3. If the command **fails**: flush the ENTIRE buffer to stderr (full diagnostic context)

**Why this matters for agents:** Agents don't need verbose logs on success -- they waste tokens. But on failure, having the full debug trace is invaluable for self-correction. The fingers-crossed pattern gives you both: silence on success, full context on failure.

### Flag-to-Level Mapping

| Flag | Log Level | Agent Experience |
|------|-----------|-----------------|
| (none) | silent | Zero noise on success; full trace on error (fingers-crossed) |
| `--quiet` | silent | Absolute silence (fingers-crossed disabled) |
| `--verbose` | info | Lifecycle events, API summaries |
| `--debug` | debug | Everything: request/response, parsed options, state |

### Log Format Auto-Detection

| Context | Format |
|---------|--------|
| TTY stderr | Console-formatted text (colors, indentation) |
| Non-TTY stderr or `--json` | JSON Lines (one JSON object per line) |
| Override | `XERO_LOG_FORMAT=text` or `XERO_LOG_FORMAT=json` |

### Events Channel

For external observability (dashboards, alerting, analytics):

```bash
my-cli reconcile --execute --json --events-url http://localhost:3000/events
```

Rules:
- Events are fire-and-forget HTTP POSTs
- **Never block** CLI completion on event delivery
- Implement bounded timeouts (e.g., 5s) and bounded retries (e.g., 1 retry)
- Include run correlation ID for tracing
- Support disable flag: `--no-events` or `EVENTS=0`
- Validate URL scheme (http/https only)

### Redaction

Always redact from ALL output channels:
- Access/refresh tokens
- Bearer and Authorization headers
- Client secrets and API keys
- Tenant identifiers (if they identify customer data)

Apply redaction to: error messages, structured context, debug log fields, event payloads. Use both key-based (`token`, `authorization`) and pattern-based (`Bearer .*`) redaction. Redact recursively in nested objects.

---

## 4. Command Architecture

### Framework Recommendation for Bun/TypeScript

| Framework | Best For | Notes |
|-----------|----------|-------|
| **Commander.js** | Most Bun CLIs | Mature, well-documented, works with Bun. Good default. Pair with Zod for type-safe flag validation. |
| **oclif** | Enterprise-scale CLIs | Plugin system, auto-generated help, TypeScript-first. Heavier. Has a community Bun fork (`oclif-bun`). |
| **Clipanion** | Type-safe CLIs | Powers Yarn. Excellent TypeScript integration. Less community adoption. |
| **util.parseArgs** | Simple CLIs | Built into Bun (via Node compat). Zero dependencies. Limited features. |
| **Bunli** | Bun-native CLIs | Minimal framework built specifically for Bun. Emerging. |

**Recommendation:** Commander.js for most cases. It's battle-tested, has the largest ecosystem, and works well with Bun. Use Zod schemas for flag validation to get type safety without oclif's weight.

### Command Structure

Follow noun-verb (or noun only) hierarchical grammar:

```
my-cli transactions --unreconciled --json
my-cli accounts --fields Code,Name,Type
my-cli reconcile --dry-run --json
my-cli status --json
```

**Aliases matter for agents:** `transactions` / `tx`, `reconcile` / `rec`. Agents learn either form.

### Making --help Useful for Agents

Agents read `--help` output when they don't know what flags to use. Make it count:

1. Mark required vs. optional flags clearly
2. Include realistic examples (not placeholder `<value>`)
3. Document `--json` flag prominently
4. Show the output schema or link to it
5. Consider `--schema` flag that dumps the JSON schema of the output (Sol's approach)

### Flag Design Principles

| Principle | Example |
|-----------|---------|
| Boolean flags for modes | `--json`, `--dry-run`, `--verbose`, `--quiet` |
| String flags for values | `--fields Code,Name`, `--since 2025-01-01` |
| Stdin for large/complex input | `echo '[...]' \| my-cli reconcile --json` |
| Numeric flags with defaults | `--limit 50` (default), `--timeout 30000` |
| Short aliases for common flags | `-j` for `--json`, `-v` for `--verbose` |

### Non-Interactive by Default

- Detect non-TTY and skip ALL prompts
- Provide `--yes` / `--force` flags for bypassing confirmations
- Use `--dry-run` for previewing destructive operations
- If auth requires a browser, tell the agent to instruct the user -- don't try to open a browser from a non-TTY context

---

## 5. MCP Integration

### When CLI, When MCP

| Factor | CLI Wins | MCP Wins |
|--------|----------|----------|
| **Command count** | < 15 commands | 50+ tools |
| **State** | Stateless operations | Stateful sessions |
| **Access** | Agent has shell access | API-only (no shell) |
| **Token budget** | Constrained (40% savings) | Less constrained |
| **Existing tool** | Wrap existing CLI | Build from scratch |
| **Multi-agent** | Single agent | Multi-agent composition |

### Wrapping a CLI as an MCP Server

The pattern is straightforward: spawn the CLI as a subprocess, capture stdout/stderr, parse the JSON envelope, and return it as the MCP tool result.

```typescript
// Simplified MCP tool that wraps a CLI command
server.tool("xero_transactions", {
  description: "Fetch unreconciled Xero bank transactions. Returns JSON array.",
  inputSchema: {
    type: "object",
    properties: {
      unreconciled: { type: "boolean", default: true },
      limit: { type: "number", default: 50 },
      fields: { type: "string", description: "Comma-separated PascalCase dot paths" }
    }
  }
}, async (params) => {
  const args = ["transactions", "--json"];
  if (params.unreconciled) args.push("--unreconciled");
  if (params.limit) args.push("--limit", String(params.limit));
  if (params.fields) args.push("--fields", params.fields);

  const proc = Bun.spawn(["bun", "run", "xero-cli", ...args]);
  const stdout = await new Response(proc.stdout).text();
  const stderr = await new Response(proc.stderr).text();
  const exitCode = await proc.exited;

  if (exitCode !== 0) {
    return { content: [{ type: "text", text: stderr }], isError: true };
  }
  return { content: [{ type: "text", text: stdout }] };
});
```

### MCP Tool Description Best Practices

Tool descriptions are how agents discover capabilities. Write them for machines:

1. **State purpose, constraints, and side effects** in the description
2. **Include usage guidance** -- what combination of params is common
3. **Document error codes** the tool can return
4. **Specify follow-up steps** -- "After fetching transactions, use xero_reconcile to categorize them"
5. **Keep descriptions focused** -- one tool, one purpose (single responsibility)

### MCP Security

- OAuth 2.0 per MCP specification for remote servers
- Per-tool authorization scopes (read vs. write)
- Default to read-only tools; require explicit approval for writes
- Never inline secrets in tool configs
- Sanitize output to prevent injection into downstream systems

### MCP Transport

- **stdio**: For local processes (Claude Code, Cursor, etc.)
- **Streamable HTTP**: For remote/deployed servers (the modern standard, replacing SSE)

---

## 6. Agent-Native Design Principles

### Idempotency

The foundation of agent reliability. If an agent retries a command, the result should be the same (or safely detected as a duplicate).

**Strategies:**
- **Declarative verbs:** `ensure`, `apply`, `sync` over `create`, `delete`
- **State file deduplication:** Track completed operations by key (e.g., `BankTransactionID`). On retry, skip already-processed items.
- **Conflict detection:** Return exit code 5 for "already exists" so the agent can distinguish success-because-done from success-because-new.
- **Client-generated idempotency keys:** For write operations, accept a UUID that the agent generates. Store it server-side. On retry with same key, return cached result.

```json
// State file pattern (keyed by resource ID)
{
  "abc-123": { "status": "reconciled", "at": "2026-03-07T10:00:00Z" },
  "def-456": { "status": "reconciled", "at": "2026-03-07T10:00:01Z" }
}
```

### Deterministic Output

Same input must produce the same **shape** of output every time. The values change, but the structure is constant.

- Always include all envelope fields (even if empty: `"warnings": []`)
- Never add/remove fields based on runtime conditions without bumping `schemaVersion`
- Sort object keys consistently
- Use ISO 8601 for all timestamps
- Use consistent null handling (explicit `null` vs. omitted field -- pick one and document it)

### Dry-Run First

Every destructive operation should support `--dry-run`:

```bash
# Preview what would happen
my-cli reconcile --dry-run --json < proposal.json

# Execute for real
my-cli reconcile --execute --json < proposal.json
```

The dry-run output should be identical in structure to the execute output, just with a flag indicating no side effects occurred. This lets agents validate their plan before committing.

### State Management

| Pattern | Use Case | Implementation |
|---------|----------|----------------|
| **State file** | Track completed work across retries | JSON file keyed by resource ID |
| **Lock file** | Prevent concurrent modifications | Atomic file creation, bounded TTL |
| **Checkpoint** | Resume long-running operations | Periodic state snapshots with checkpoint IDs |

Lock file rules:
- Use atomic creation (write-if-not-exists)
- Include a TTL/expiry timestamp to prevent stale locks
- Include PID for debugging
- Clean up on SIGINT/SIGTERM

### Progressive Loading (Token Budget)

Never dump everything into a single response. Design commands that support:

1. **Field selection:** `--fields Code,Name,Type` (only return what's needed)
2. **Pagination:** `--limit 50 --offset 0`
3. **Date filtering:** `--since 2025-01-01`
4. **Aggregation:** `--group-by Contact` (summarize instead of listing)

Target: < 20K tokens per agent analysis step.

### Stop/Ask-User Gates

Define clear boundaries where the agent must stop and ask:

- Ambiguous categorization (confidence < threshold)
- Missing or conflicting data
- > 10% of items need manual review
- Same error repeats twice in a row
- Destructive operations exceeding a threshold

Encode these gates in documentation (skill files, --help) so agents know the rules before they start.

---

## 7. Bun-Specific Patterns

### Why Bun for CLIs

| Advantage | Impact |
|-----------|--------|
| **~6ms startup** | CLI feels instant (vs. Node's ~170ms). Critical for agent workflows that call CLIs dozens of times. |
| **Native TypeScript** | No transpilation step. `bun run my-cli.ts` just works. |
| **Built-in test runner** | `bun test` with watch mode, coverage. No vitest/jest setup needed. |
| **Single executable compilation** | `bun build --compile` produces a standalone binary. No runtime needed. |
| **Built-in APIs** | `Bun.spawn`, `Bun.file`, `Bun.serve` -- fast, ergonomic. |
| **bunx distribution** | `bunx my-cli` runs without global install. Faster than npx. |

### Compilation and Distribution

```bash
# Compile to standalone binary
bun build ./src/cli.ts --compile --outfile dist/my-cli

# Cross-compile
bun build ./src/cli.ts --compile --target=bun-darwin-arm64 --outfile dist/my-cli-macos
bun build ./src/cli.ts --compile --target=bun-linux-x64 --outfile dist/my-cli-linux
```

### package.json for CLI Distribution

```json
{
  "name": "my-cli",
  "bin": {
    "my-cli": "./src/cli.ts"
  },
  "scripts": {
    "my-cli": "bun run src/cli.ts",
    "build": "bun build ./src/cli.ts --compile --outfile dist/my-cli"
  }
}
```

Users install via `bun add -g my-cli` or run without install via `bunx my-cli`.

### Bun.spawn for Subprocess Management

When your CLI needs to call other tools:

```typescript
const proc = Bun.spawn(["git", "status", "--porcelain"], {
  stdout: "pipe",
  stderr: "pipe",
});
const stdout = await new Response(proc.stdout).text();
const exitCode = await proc.exited;
```

### Shebang Pattern

```typescript
#!/usr/bin/env bun
// src/cli.ts
import { parseArgs } from "util";
// ... CLI implementation
```

Then `chmod +x src/cli.ts` and run directly.

---

## 8. Reference Implementations

### Gold Standard: xero-cli (This Project)

The xero-cli in this repository implements nearly all patterns described above:
- Stable JSON envelope with `schemaVersion`
- Structured error codes (`E_USAGE`, `E_RATE_LIMITED`, etc.) with action hints
- Three-tier observability (stdout/stderr/events)
- Fingers-crossed logging
- State file for idempotent reconciliation
- `--dry-run` before `--execute`
- Field selection via `--fields`
- Auto-JSON in non-TTY mode
- Comprehensive skill documentation for agent discovery

### Notable External CLIs

| CLI | Pattern Worth Studying |
|-----|----------------------|
| **GitHub CLI (gh)** | TTY auto-detection, `--json` with field selection, `--jq` for inline filtering, tab-delimited pipe mode |
| **Sol (Upsun)** | TOON format for extreme token efficiency, `--schema` for programmatic discovery, zero interactive prompts |
| **kubectl** | Declarative `apply` for idempotency, `--dry-run=client\|server`, multiple output formats (`-o json\|yaml\|wide`) |
| **Vercel CLI** | Project-scoped config, environment detection, `--json` output |

### Anti-Patterns to Avoid

| Anti-Pattern | Why It Breaks Agents |
|-------------|---------------------|
| Mixing human text into stdout | Breaks JSON parsing |
| Exit code 1 for everything | Agent can't classify the error |
| Interactive prompts without `--yes` bypass | Agent hangs waiting for input |
| Deeply nested JSON output | Token-expensive, hard to extract fields |
| Unstable output schema (fields appear/disappear) | Agent code breaks silently |
| Error messages without error codes | Agent can't build retry logic |
| Unbounded retry delays | Agent loops forever |
| Logging secrets in debug mode | Security breach on fingers-crossed flush |
| Blocking on telemetry/events | CLI hangs if observability server is down |
| No `--dry-run` for destructive ops | Agent can't preview before committing |

---

## Summary: The Minimum Viable Agent-Native CLI

If you're building a new CLI for agent consumption, implement these in order of priority:

1. **JSON envelope on stdout** with `schemaVersion` (day 1)
2. **Structured error codes** with `action` and `retryable` fields (day 1)
3. **Meaningful exit codes** beyond 0/1 (day 1)
4. **Non-TTY auto-detection** -- skip prompts, output JSON (day 1)
5. **`--dry-run`** for any write operation (week 1)
6. **Field selection** via `--fields` to control token budget (week 1)
7. **Fingers-crossed logging** on stderr (week 1)
8. **State file** for idempotent writes (week 2)
9. **Events channel** for external observability (week 2)
10. **MCP wrapper** if agents lack shell access (when needed)

---

## Sources

### Curated Skills (Highest Authority)
- `agent-reliability-guardrails` skill: `/Users/nathanvale/.claude/skills/agent-reliability-guardrails/SKILL.md`
- `xero-cli` skill: `/Users/nathanvale/code/side-quest-xero-cli/.claude/skills/xero-cli/SKILL.md`

### Online Sources
- [Writing CLI Tools That AI Agents Actually Want to Use](https://dev.to/uenyioha/writing-cli-tools-that-ai-agents-actually-want-to-use-39no) - DEV Community
- [Why CLIs Beat MCP for AI Agents](https://lalatenduswain.medium.com/why-clis-beat-mcp-for-ai-agents-and-how-to-build-your-own-cli-army-8db9e0467dd8) - Medium
- [Designing API Error Messages for AI Agents](https://nordicapis.com/designing-api-error-messages-for-ai-agents/) - Nordic APIs
- [MCP Best Practices](https://mcp-best-practice.github.io/mcp-best-practice/best-practice/) - MCP Best Practice Guide
- [Sol - Agent-Optimized CLI](https://heysol.dev/) - Upsun
- [Scripting with GitHub CLI](https://github.blog/engineering/engineering-principles/scripting-with-github-cli/) - GitHub Blog
- [How to Build CLI Applications with Bun](https://oneuptime.com/blog/post/2026-01-31-bun-cli-applications/view) - OneUptime
- [LogTape Documentation](https://logtape.org/) - LogTape
- [Making Retries Safe with Idempotent APIs](https://aws.amazon.com/builders-library/making-retries-safe-with-idempotent-APIs/) - AWS Builders Library
- [MCP Specification](https://modelcontextprotocol.io/specification/2025-11-25) - Model Context Protocol
- [GitHub CLI Formatting](https://cli.github.com/manual/gh_help_formatting) - GitHub CLI Manual
