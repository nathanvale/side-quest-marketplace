---
created: 2026-03-04
title: MCP SDK Architecture Decision -- @side-quest/core vs Raw SDK
type: research
tags: [mcp, sdk, architecture, typescript, bun, monorepo, wrapper-libraries, registerTool, outputSchema]
project: dx-tsc-runner
status: complete
builds-on:
  - /Users/nathanvale/code/side-quest-marketplace/docs/research/2026-03-03-mcp-best-practices-prompt-engineering.md
reviewed-by: 12 parallel agents (architecture-strategist, security-sentinel, performance-oracle, code-simplicity-reviewer, kieran-typescript-reviewer, pattern-recognition-specialist, agent-native-reviewer, agent-native-architecture-skill, best-practices-researcher, 3 newsroom beat reporters)
---

# MCP SDK Architecture Decision -- @side-quest/core vs Raw SDK

Deep research into whether `@side-quest/core` wrapper library should be kept or dropped in favor of raw `@modelcontextprotocol/sdk@^1.27.1` for the side-quest-runners monorepo (tsc-runner, bun-runner, biome-runner).

## Summary

**Verdict: Drop core.** Every signal -- agent-native analysis, security review, simplicity analysis, TypeScript review, performance analysis, community patterns -- points the same direction. Core blocks access to SDK features (`title`, `outputSchema`, full `annotations`), pins to an outdated SDK with a CVE, and provides ~140 lines of non-trivial value from a package with 24 subpaths (18 unused).

## SDK Evolution: v1.20 to v1.27.1

### Key releases

| Version | Date | Highlights |
|---------|------|------------|
| v1.20.0 | Oct 2025 | Zod-to-JSONSchema fixes, DCR workflow |
| v1.21.0 | Oct 30, 2025 | Pluggable JSON schema validators, protocol-level errors for disabled tools |
| v1.22.0 | Nov 13, 2025 | `registerTool()` accepts `ZodType<object>` for input/output schemas |
| v1.23.0 | Nov 25, 2025 | **Zod v4 support** (peer dep `^3.25 \|\| ^4.0`), URL elicitation, Sampling with Tools |
| v1.24.0 | Dec 2, 2025 | **MCP Spec 2025-11-25** alignment, Tasks primitive, server refactored to be framework-agnostic |
| v1.25.0 | Dec 15, 2025 | `outputSchema` support ("Support updating output schema"), spec types backwards compat |
| v1.25.2 | Jan 2026 | ReDoS prevention in UriTemplate |
| v1.26.0 | Feb 4, 2026 | **CVE-2026-25536** -- cross-client data leak from transport/server reuse |
| v1.27.0 | Feb 16, 2026 | Conformance test infrastructure, `discoverOAuthServerInfo()` backport |
| v1.27.1 | Feb 24, 2026 | Auth conformance, governance docs, transport error propagation fix |

### CVE-2026-25536 details (GHSA-345p-7cg4-v4c7)

**Severity: HIGH.** Two vulnerabilities:

1. **Transport re-use:** `StreamableHTTPServerTransport` in stateless mode without `sessionIdGenerator` -- JSON-RPC message ID collisions route responses to wrong client
2. **Server/Protocol re-use:** Single `McpServer` connected to multiple transports -- `this._transport` silently overwritten, messages sent to wrong client

**Fix:** `Protocol.connect()` now throws if already connected. Stateless transport throws if `handleRequest()` called more than once.

**Impact on side-quest-runners:** Low risk (single-client stdio), but must upgrade to >= 1.26.0 regardless.

### `registerTool()` vs `tool()` (deprecated)

`tool()`, `prompt()`, `resource()` are all deprecated since v1.25. Confirmed by [GitHub issue #1284](https://github.com/modelcontextprotocol/typescript-sdk/issues/1284), resolved by PR #1285 (Dec 2025).

| Aspect | `tool()` (deprecated) | `registerTool()` |
|--------|----------------------|-----------------|
| `title` support | No | Yes |
| `outputSchema` support | No | Yes |
| Return value | void | `RegisteredTool` with `enable()/disable()/remove()/update()` |
| Error handling | Manual | Built-in try/catch, returns `isError: true` |
| Handler signature | `(args, extra)` | `(args, ctx)` where `ctx.mcpReq.log()` available |

## What @side-quest/core Actually Provides

### Used modules (6 of 24 subpaths)

| Module | What runners use | Lines | Inline difficulty |
|--------|-----------------|-------|-------------------|
| `/mcp` | `tool()`, `startServer()`, `z` re-export | ~300 | Medium |
| `/mcp-response` | `wrapToolHandler()`, `ResponseFormat`, `createLoggerAdapter` | ~130 | Easy |
| `/spawn` | `spawnWithTimeout()`, `spawnAndCollect()` | ~120 | Very easy |
| `/validation` | `validatePath()`, `validatePathOrDefault()`, `validateShellSafePattern()` | ~200 | Medium (security-critical) |
| `/fs` | `findNearestConfig()`, `NearestConfigResult` | ~30 | Easy (tsc-runner only) |
| `/logging` | `createPluginLogger()`, `createCorrelationId()` | ~350 | Medium |

### Unused subpaths (18)

`/cli`, `/compression`, `/concurrency`, `/errors`, `/formatters`, `/geo`, `/git`, `/glob`, `/hash`, `/html`, `/instrumentation`, `/oauth`, `/password`, `/slo`, `/streams`, `/terminal`, `/testing`, `/utils`, `/vtt`

### Core's deferred queue pattern

Core uses a module-level singleton with deferred registration:

1. `tool('name', ...)` queues registration in an array
2. `startServer()` creates `McpServer`, drains queue, calls `connect()`
3. Auto-start timer schedules server start on next tick if not explicitly called

The raw SDK does not need this -- `registerTool()` works before or after `connect()`.

### Core's lifecycle behaviors (~40 lines to replicate)

1. `stdin.resume()` -- prevents Bun from exiting early
2. `transport.onclose = () => process.exit(0)` -- clean shutdown on client disconnect
3. Server singleton enforcement -- prevents double-start
4. Capability normalization -- ensures logging capability present
5. Signal handling -- SIGINT/SIGTERM graceful shutdown

## Security Findings

### Pre-existing vulnerability: `isFileInRepo()` symlink bypass

Core's `isFileInRepo()` has a catch fallback that skips `realpath()` symlink resolution:

```javascript
async function isFileInRepo(filePath) {
  const gitRoot = await getGitRoot();
  try {
    const realGitRoot = await realpath(gitRoot);
    const realAbsolutePath = await realpath(absolutePath);
    return realAbsolutePath.startsWith(realGitRoot);
  } catch {
    // VULNERABLE: falls back to naive prefix check
    return absolutePath.startsWith(gitRoot);
  }
}
```

If `realpath()` fails (file doesn't exist, permission error), a symlink at `./link` pointing to `/etc/` would pass the naive `startsWith` check.

**Fix during migration:** Reject paths when `realpath` fails instead of falling back.

### Environment variable leaking

- tsc-runner passes `{ ...process.env, CI: 'true' }` to child processes
- Core's `spawnAndCollect` always merges `...process.env` even with caller-provided partial env
- **Fix:** Replace with explicit allowlist: `PATH`, `HOME`, `TMPDIR`, `LANG`, `NODE_PATH`, `BUN_INSTALL`, `CI`

### Shell metacharacter validation gap

`validateShellSafePattern()` does NOT reject `\n` or `\r`. Safe only because arguments are passed as array elements to `Bun.spawn()`, not shell-interpolated. Must document this assumption.

## TypeScript Findings

### Zod instance compatibility risk

SDK declares `zod@^3.25 || ^4.0` as peer dep. Two different Zod versions in the dependency tree can cause schema validation to silently fail at runtime (Zod uses `instanceof` checks internally). Must verify in PoC that Zod from separately-installed package works with `registerTool()`.

### `wrapToolHandler` type hole

bun-runner uses `Record<string, unknown>` for handler args then casts with `as { pattern?: string }`. The ported version should use a generic `<TInput>` that preserves Zod-inferred types.

### bun-runner error attachment anti-pattern

```typescript
const error = new Error(text)
;(error as Error & { summary?: TestSummary }).summary = summary
```

Should define a proper `ToolError` class instead.

### Inconsistencies across runners

- `createLoggerAdapter`: tsc-runner skips it, bun-runner and biome-runner use it
- biome-runner uses `error_count`/`warning_count` (snake_case) while others use camelCase

## Agent-Native Analysis

### Error contract problem

All runners conflate operational errors with domain results. bun-runner throws `Error` for test failures -- agents can't distinguish "tool crashed" from "found bugs."

**Required contract:**

| Category | `isError` | Examples |
|----------|-----------|---------|
| Operational errors | `true` | `CONFIG_NOT_FOUND`, `TIMEOUT`, `SPAWN_FAILURE` |
| Domain results (problems found) | `false` | Type errors, test failures, lint issues |
| Domain results (clean) | `false` | No errors, all pass |

### Agent-native score (current state)

- 0/7 tools have `title` (blocked by core)
- 0/7 tools have `outputSchema` (blocked by core)
- 7/7 tools have `annotations` (partial)
- 0/7 tools have correct error semantics

## Performance Analysis

**Architecture decision is performance-neutral.** Subprocess execution dominates by 99%+.

High-ROI optimizations (independent of decision):

1. **Cache git root per process lifetime** -- saves ~10ms per tool invocation
2. **Compact JSON** -- `JSON.stringify(obj)` vs `JSON.stringify(obj, null, 2)` saves 30-50% bytes
3. **`--incremental` tsc** -- 10-30x speedup on warm runs (Phase C)

## Community Patterns

### ESLint MCP -- linter-native, no wrapper

ESLint implements MCP as a first-class feature: "the ESLint CLI contains an MCP server." Same config works across VS Code, Cursor, Windsurf. Tools: lint analysis, auto-fix, rule explanation. **Validates the "drop wrapper" direction.**

### Cloudflare MCP -- minimal surface area

Just 2 tools (search + execute), reduced input tokens by 99.9%. Design principle: fewer tools with better descriptions = better agent routing.

### InMemoryTransport testing

SDK ships `InMemoryTransport` for in-process integration testing. Creates linked transport pairs -- no subprocess management, deterministic, full protocol compliance.

### FastMCP framework

3,000+ stars community wrapper. Provides session management, auth, HTTP streaming, edge runtime support. Not relevant to our stdio-based runners but shows the community values higher-level abstractions for complex use cases.

## Migration Recommendation

### Shared code: `packages/runner-utils` (workspace-internal, `"private": true`)

**Boundary rule:** MUST NOT re-export or wrap MCP SDK types.

Modules:
- `spawn.ts` -- `spawnWithTimeout()`, `spawnAndCollect()` (~120 lines)
- `validation.ts` -- `validatePath()`, `validatePathOrDefault()`, `validateShellSafePattern()` (~200 lines)
- `response.ts` -- `wrapToolHandler()`, `ResponseFormat` (~130 lines)
- `env.ts` -- `safeEnv()` allowlist (~20 lines)

**Not shared:**
- Server lifecycle -- each runner owns its 15-20 line bootstrap (healthy duplication)
- `findNearestConfig()` -- tsc-runner only

### Effort estimate

- Phase 0 (PoC + decision): 1 day
- Phase A (SDK upgrade + migration): 1-2 days
- Total for all 3 runners: 3-4 days

## Sources

- [MCP TypeScript SDK releases](https://github.com/modelcontextprotocol/typescript-sdk/releases)
- [registerTool migration (Issue #1284)](https://github.com/modelcontextprotocol/typescript-sdk/issues/1284)
- [CVE-2026-25536](https://github.com/modelcontextprotocol/typescript-sdk/security/advisories/GHSA-345p-7cg4-v4c7)
- [MCP Tools spec](https://modelcontextprotocol.io/docs/concepts/tools)
- [MCP Security Best Practices](https://modelcontextprotocol.io/specification/draft/basic/security_best_practices)
- [MCPcat testing guide](https://mcpcat.io/guides/writing-unit-tests-mcp-servers/)
- [Snyk - Path Traversal in MCP Servers](https://snyk.io/articles/preventing-path-traversal-vulnerabilities-in-mcp-server-function-handlers/)
- [ESLint MCP](https://eslint.org/docs/latest/use/mcp)
- [Nx - Building MCP Server with Nx](https://nx.dev/blog/building-mcp-server-with-nx)
- `@side-quest/core@0.1.1` source audit (built artifacts in node_modules)
