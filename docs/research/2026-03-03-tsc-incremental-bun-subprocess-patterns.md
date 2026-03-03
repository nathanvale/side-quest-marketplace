---
created: 2026-03-03
title: tsc --incremental + Bun Subprocess Patterns -- Best Practices and Gotchas
type: research
tags: [typescript, tsc, incremental, tsbuildinfo, bun, subprocess, pipe-deadlock, tsgo]
project: dx-tsc-runner
status: complete
---

# tsc --incremental + Bun Subprocess Patterns -- Best Practices and Gotchas

Research into TypeScript incremental compilation, `.tsbuildinfo` management, Bun subprocess APIs, and the emerging tsgo compiler. Synthesized from newsroom investigation (Reddit, X, web), Bun subprocess best-practices researcher, and Claude Code hooks documentation.

## `--incremental --noEmit` Is Valid and Supported

The TypeScript team confirmed this combination works (issue #40198, closed COMPLETED). Benchmarks:
- Without incremental: **180s**
- With incremental (no changes): **23s**
- 87% reduction on warm cache

Since TypeScript 5.6, `.tsbuildinfo` is **always written** regardless of `incremental` setting (issue #60360, closed "Working as Intended"). You get the file whether you ask for it or not.

Historical gotcha (issue #44305): Early versions of `--incremental --noEmit` showed no speedup because hash-based validation prevented proper skipping. Fixed in PR #44394. Verify actual speedup in your project if using older TypeScript versions.

## `.tsbuildinfo` Management

### Where to put it

| Strategy | Path | Pros | Cons |
|----------|------|------|------|
| Default | Next to `tsconfig.json` | Zero config | Clutters project root |
| Cache dir | `node_modules/.cache/tsc/.tsbuildinfo` | Already gitignored | Cleared on `rm -rf node_modules` |
| Project root | `.tsbuildinfo` | Simple, easy to gitignore | One more gitignore entry |
| Temp dir | `/tmp/tsc-<project>.tsbuildinfo` | No project pollution | Lost across sessions, breaks cache value |

**Recommendation:** Default location (next to tsconfig) for hooks that run per-project. Document in README that users should add `*.tsbuildinfo` to `.gitignore`.

### Corruption and recovery

Delete the file. That's the entire recovery procedure. Forces a clean rebuild on next invocation.

### The sync trap

If you delete `dist/` but not `.tsbuildinfo`, incremental thinks everything is current and **does not regenerate output**. Not a concern for `--noEmit` workflows (no dist to delete), but important to know.

### Concurrent writes -- no file locking

TypeScript has zero concurrency protection on `.tsbuildinfo`. Two concurrent `tsc --incremental` processes writing to the same file can corrupt it. The last writer wins.

**Real-world confirmation from X:** @hnishio0105 reported: "tsc reported 'syntax error at line 73.' The file was 64 lines. tsconfig had `incremental: true`, so tsc cached compilation state in `.tsbuildinfo`. Between verification runs, something rewrote the file; tsc read the stale cache and reported a ghost error."

@gitautoai confirmed the same pattern in agentic workflows -- AI agents rewrite files between tsc runs, causing stale cache reads.

**Mitigation options:**
1. Accept it -- corruption is self-healing (delete and rebuild)
2. Debounce hook invocations (out of scope for dx-tsc-runner v1)
3. Use unique `--tsBuildInfoFile` paths per invocation (defeats caching purpose)

## Bun Subprocess API

### Idiomatic pattern (2026)

Use `proc.stdout.text()` directly -- not `new Response(proc.stdout).text()`:

```typescript
const proc = Bun.spawn(['bunx', 'tsc', '--noEmit'], {
  stdout: 'pipe',
  stderr: 'pipe',  // REQUIRED -- defaults to 'inherit', not 'pipe'
})

const [exitCode, stdout, stderr] = await Promise.all([
  proc.exited,
  proc.stdout.text(),
  proc.stderr.text(),
])
```

The `new Response()` wrapper was common in early Bun but `.text()` on `ReadableStream` is the idiomatic API since v1.x.

### Pipe deadlock prevention

**Always use `Promise.all` for exit + stdout + stderr.** The classic subprocess deadlock:
1. Child writes enough to fill OS pipe buffer (~64KB on macOS)
2. Child blocks waiting for buffer to drain
3. Parent awaits `proc.exited` before reading
4. Deadlock -- both sides wait forever

The `Promise.all` pattern drains pipes concurrently with exit, preventing this.

### stderr defaults to 'inherit'

Unlike stdout (which defaults to `'pipe'`), **stderr defaults to `'inherit'`**. If you want to capture stderr, you must set `stderr: 'pipe'` explicitly. Without it, `proc.stderr` is `undefined` and `.text()` throws.

### Known Bun issues

| Issue | Platform | Status | Impact |
|-------|----------|--------|--------|
| Empty stdout in `bun test` (#24690) | macOS arm64 | Open | `Bun.spawn()` returns empty output inside test runner |
| `bunx tsc --noEmit` crash (#24462) | Windows | Open | Panic in command sequences |
| `bunx --bun tsc` path failure (#20725) | All | Open | `--bun` flag breaks tsc path resolution |

**Rule: Use `bunx tsc` (never `bunx --bun tsc`) for maximum reliability.**

### Signal handling and timeouts

Bun supports both `timeout` and `AbortSignal` for subprocess management:

```typescript
const proc = Bun.spawn({
  cmd: ['bunx', 'tsc', '--noEmit'],
  stdout: 'pipe',
  stderr: 'pipe',
  timeout: 60_000,       // Auto-kill after 60s
  killSignal: 'SIGTERM', // Default, but explicit is good
})
```

- `proc.kill()` sends SIGTERM by default
- `proc.killed` boolean indicates if process was killed
- `proc.signalCode` tells you which signal killed it
- Parent Bun process won't exit until children exit -- use `proc.unref()` to detach

## tsgo (TypeScript 7) -- The Future

Microsoft's Go-based TypeScript compiler achieves 8-10x speedup:

| Project | tsc 6.0 | tsgo 7.0 | Speedup |
|---------|---------|----------|---------|
| VS Code (1.5M lines) | 89.11s | 8.74s | 10.2x |
| TypeORM | 15.80s | 1.06s | 9.88x |
| Sentry | 133.08s | 16.25s | 8.19x |
| Playwright | 9.30s | 1.24s | 7.51x |

Memory: ~2.9x more efficient than tsc.

### What works in tsgo (December 2025)
- `--incremental` flag ported and functional
- `--build` mode works
- Project references work
- Parallel multi-project compilation

### Known tsgo gap (issue #2666, open Feb 2026)
`tsgo --build` fails to invalidate incremental cache when `node_modules` types change. The cache only tracks local source files. **Workaround: delete `.tsbuildinfo` after `bun install` / `npm install`.**

### Forward-compatibility for dx-tsc-runner
The plugin will work with tsgo when it ships -- `bunx tsc` resolves to whatever TypeScript version is installed. No code changes needed. The `--incremental` flag is supported by both compilers.

Svelte-check already shipped `--tsgo` as a flag -- first real-world toolchain integration.

## Claude Code Hooks -- PostToolUse and Stop Protocols

### PostToolUse stdin format

```json
{
  "session_id": "abc123",
  "hook_event_name": "PostToolUse",
  "tool_name": "Write",
  "tool_input": { "file_path": "/path/to/file.ts", "content": "..." },
  "tool_response": { "filePath": "/path/to/file.ts", "success": true },
  "tool_use_id": "toolu_01ABC123..."
}
```

### PostToolUse output protocol

Exit 0 + stdout JSON for structured feedback:

```json
{
  "decision": "block",
  "reason": "3 TypeScript errors in edited files",
  "hookSpecificOutput": {
    "hookEventName": "PostToolUse",
    "additionalContext": "src/index.ts:42:7 - TS2345: ..."
  }
}
```

On exit 2, only stderr plain text is read. Structured JSON must go through exit 0 + `decision: "block"`.

### Stop hook stdin format

```json
{
  "session_id": "abc123",
  "hook_event_name": "Stop",
  "stop_hook_active": true,
  "last_assistant_message": "I've completed..."
}
```

**Critical field:** `stop_hook_active` -- when `true`, Claude is already continuing due to a previous Stop hook. Must check this to prevent infinite loops.

### Hook events (16 total, March 2026)

SessionStart, UserPromptSubmit, PreToolUse, PermissionRequest, PostToolUse, PostToolUseFailure, Notification, SubagentStart, SubagentStop, Stop, TeammateIdle, TaskCompleted, ConfigChange, WorktreeCreate, WorktreeRemove, PreCompact, SessionEnd.

### Timeouts

- Default command hook timeout: **600s** (10 minutes)
- Self-destruct timer convention: 80% of hook timeout, with `.unref()`
- Exit 0 on timeout (non-gating) for quality gates; exit 2 for safety gates

## Sources

### TypeScript
- [TSConfig: incremental](https://www.typescriptlang.org/tsconfig/incremental.html)
- [TSConfig: tsBuildInfoFile](https://www.typescriptlang.org/tsconfig/tsBuildInfoFile.html)
- [Issue #40198: incremental + noEmit](https://github.com/microsoft/TypeScript/issues/40198)
- [Issue #44305: incremental not faster with --noEmit](https://github.com/microsoft/TypeScript/issues/44305)
- [Issue #60360: tsbuildinfo always written since 5.6](https://github.com/microsoft/TypeScript/issues/60360)
- [TypeScript 7 progress -- December 2025](https://devblogs.microsoft.com/typescript/progress-on-typescript-7-december-2025/)
- [tsgo #2666: cache invalidation bug](https://github.com/microsoft/typescript-go/issues/2666)
- [Turborepo: TypeScript build gotchas](https://notes.webutvikling.org/typescript-build-gotchas/)

### Bun
- [Bun Spawn API](https://bun.sh/docs/api/spawn)
- [Bun TypeScript docs](https://bun.com/docs/runtime/typescript)
- [Issue #24690: empty stdout in bun test](https://github.com/oven-sh/bun/issues/24690)
- [Issue #24462: bunx tsc crash on Windows](https://github.com/oven-sh/bun/issues/24462)
- [Issue #20725: --bun flag breaks tsc](https://github.com/oven-sh/bun/issues/20725)

### Claude Code
- [Hooks reference](https://code.claude.com/docs/en/hooks)
- [Plugins reference](https://code.claude.com/docs/en/plugins-reference)
- [Hook SDK](https://github.com/mizunashi-mana/claude-code-hook-sdk)

### Community
- X: @hnishio0105 (stale tsbuildinfo ghost errors)
- X: @gitautoai (agentic stale cache)
- X: @dummdidumm_ (svelte-check --incremental + --tsgo)
- X: @styfle (81% build time reduction with tsgo)
- X: @andrewhong5297 (concurrent bun tsc memory pressure in agents)
- Reddit: r/typescript (TypeScript 6.0 Beta discussion, 340pts)
- Newsroom investigation: Reddit, X, web (March 2026)
