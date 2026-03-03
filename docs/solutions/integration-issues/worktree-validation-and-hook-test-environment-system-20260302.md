---
module: System
date: 2026-03-02
problem_type: integration_issue
component: development_workflow
symptoms:
  - "`bun test plugins/git/` failed with `EADDRINUSE` in `event-bus-client.test.ts` when using `Bun.serve({ port: 0 })`"
  - "`bun run validate` failed in worktree with `biome check --write .` reporting: No files were processed"
  - "Typecheck failed after test harness rewrite because Bun's `fetch` type requires `.preconnect`"
root_cause: config_error
resolution_type: workflow_improvement
severity: medium
tags: [worktree, biome, bun-test, event-bus, fetch-mock, validation]
---

# Troubleshooting: Worktree Validation And Hook Test Environment Instability

## Problem
Validation and plugin test workflows were unstable in a git worktree environment. The suite failed on port-binding assumptions in tests and on a Biome invocation pattern that treated `.` as ignored in this worktree path.

## Environment
- Module: System
- Affected Component: development workflow + testing framework
- Date: 2026-03-02

## Symptoms
- `bun test plugins/git/` failed in `plugins/git/hooks/event-bus-client.test.ts` with repeated `EADDRINUSE` errors from `Bun.serve(...)`.
- `bun run validate` failed at `biome check --write .` with "No files were processed" in this worktree.
- After replacing socket servers with mocked fetch, `tsc --noEmit` failed because direct fetch mock assignments were incompatible with Bun's `typeof fetch` shape.

## What Didn't Work

**Attempted Solution 1:** Re-run full plugin tests as-is.
- **Why it failed:** Socket-based tests remained environment-sensitive and continued to fail under this runtime/sandbox.

**Attempted Solution 2:** Keep direct `globalThis.fetch = async (...) => ...` mock assignments.
- **Why it failed:** TypeScript rejected assignments because Bun's `fetch` type includes a required `preconnect` property.

**Attempted Solution 3:** Keep package `check` script as `biome check --write .`.
- **Why it failed:** In this worktree path, Biome treated the provided root path as ignored and processed zero files.

## Solution

Stabilized the workflow by removing environment-coupled assumptions and making validation file-targeting explicit.

**Code changes**:
```ts
// event-bus-client.test.ts
// Before: real HTTP server per test
const server = Bun.serve({ port: 0, fetch: ... })

// After: fetch-mocked transport with explicit typing
const originalFetch = globalThis.fetch

globalThis.fetch = (async (input, init) => {
  // capture URL/body and return response
  return new Response('ok', { status: 200 })
}) as typeof fetch

// for zero-arg mocks where Bun type overlap is stricter:
globalThis.fetch = (async () => {
  return new Response('Internal Server Error', { status: 500 })
}) as unknown as typeof fetch
```

```json
// package.json
{
  "scripts": {
    "check": "git ls-files -z -- '*.ts' '*.tsx' '*.js' '*.jsx' '*.mjs' '*.cjs' '*.json' '*.jsonc' | xargs -0 biome check --write"
  }
}
```

**Verification commands**:
```bash
bun test plugins/git/hooks/event-bus-client.test.ts
bun test plugins/git/
bun run validate
```

## Why This Works
1. The test failures were not business-logic failures; they were transport-layer assumptions tied to local port availability. Mocking `fetch` directly tests event emission behavior without requiring socket binding.
2. Bun's `fetch` type is richer than a plain async function, so explicit cast strategy (`as typeof fetch` / `as unknown as typeof fetch`) aligns tests with the runtime type contract.
3. `biome check --write .` depended on path interpretation that failed in this worktree context. Using git-tracked file lists makes the lint target explicit and independent of worktree root path quirks.

## Prevention
- Prefer deterministic transport mocks over live sockets in unit tests unless network binding itself is the subject under test.
- For Bun globals with enriched types, standardize a typed mock helper instead of ad-hoc assignments.
- In monorepo/worktree tooling scripts, prefer explicit file lists (e.g., `git ls-files`) over root-dot invocations when tooling path resolution has shown instability.
- Add a CI guard that runs validation from both default checkout and worktree contexts if worktrees are part of normal workflow.

## Related Issues
No related issues documented yet.
