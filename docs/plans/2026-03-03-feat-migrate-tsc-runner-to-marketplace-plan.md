---
title: "Migrate tsc-runner to marketplace as dx-tsc-runner"
type: feat
status: active
date: 2026-03-03
deepened: 2026-03-03
---

# Migrate tsc-runner to marketplace as dx-tsc-runner

## Enhancement Summary

**Deepened on:** 2026-03-03
**Agents used:** architecture-strategist, pattern-recognition-specialist, kieran-typescript-reviewer, security-sentinel, performance-oracle, code-simplicity-reviewer, agent-native-reviewer, spec-flow-analyzer, agent-native-architecture skill, naming-conventions skill, best-practices-researcher (Bun subprocess), framework-docs-researcher (Claude Code hooks)

### Key Improvements

1. **stdout not stderr for hook error output** -- Claude Code reads stderr on exit 2, but the backup hook writes error JSON to `console.error()`. Must switch to stdout JSON with `decision: "block"` for PostToolUse, or stderr for Stop hook exit 2.
2. **PostToolUse matcher format validated** -- pipe-separated `Write|Edit|MultiEdit` is regex syntax and works; dx-git uses separate entries for readability, either is valid.
3. **`--incremental` needs .tsbuildinfo management** -- writes files into project tree; concurrent hook fires can corrupt them. Document in README, add `.tsbuildinfo` to `.gitignore` note.
4. **Use `proc.stdout.text()` not `new Response(proc.stdout).text()`** -- Bun's idiomatic API since v1.x; shorter and clearer.
5. **Stop hook must check `stop_hook_active` field** -- prevents infinite loops when Claude continues after a Stop hook fires.
6. **Non-zero exit + zero parsed errors = silent false pass** -- add guard for tsc crashes, corrupt buildinfo, missing binary.

### New Considerations Discovered

- **Agent discoverability gap**: Without a skill (`user-invocable: false`), the agent has zero context about hooks, error model, or when to use the MCP tool proactively. Flagged as high-priority follow-up.
- **Stop hook interaction with dx-git**: If dx-git's `auto-commit-on-stop.ts` runs before tsc-ci, it could commit broken code. Hook execution order is plugin-load-order dependent.
- **`findNearestConfig` unbounded traversal**: Can escape project root via symlinks. Should cap walk at git root (security).
- **Command naming**: `logs.md` should be `show-logs.md` per imperative verb convention.

---

## Overview

Bring the production `tsc-runner` plugin from `side-quest-plugins-backup` into `side-quest-marketplace` as `dx-tsc-runner` -- the second DX-tier plugin after `dx-git`. Not just a copy -- apply all findings from 12 parallel review agents to ship a hardened, production-quality plugin.

The plugin has three components:
- **MCP server** (`@side-quest/tsc-runner` npm) -- `tsc_check` tool with structured JSON responses
- **PostToolUse hook** -- runs tsc scoped to edited .ts files after every Write/Edit/MultiEdit, blocks on errors
- **Stop hook** -- full project-wide type check at session end

## Acceptance Criteria

- [x] `plugins/dx-tsc-runner/` exists with correct structure
- [x] `.claude-plugin/plugin.json` manifest complete (name, description, version, commands)
- [x] `.mcp.json` registers `@side-quest/tsc-runner` MCP server
- [x] `hooks/hooks.json` wires PostToolUse and Stop hooks with description field
- [x] Both hooks have `if (import.meta.main)` guard with self-destruct timer
- [x] Path-scoping bug fixed (`path.relative` instead of `string.replace`)
- [x] Pipe deadlock fixed (`Promise.all` for stdout/stderr/exit)
- [x] Use `proc.stdout.text()` instead of `new Response(proc.stdout).text()`
- [x] `--incremental` flag on tsc invocations
- [x] Serial loops parallelized (`byConfigDir`, git commands)
- [x] Error output uses correct channel (stdout JSON for PostToolUse, stderr for Stop)
- [x] Stop hook checks `stop_hook_active` to prevent infinite loops
- [x] Guard for non-zero exit + zero parsed errors (tsc crash detection)
- [x] `commands/show-logs.md` has proper YAML frontmatter (renamed from `logs.md`)
- [x] `README.md` documents all three components with prerequisites
- [x] Marketplace entry added, version bumped to `1.1.0`
- [x] `bun run validate` passes

## Implementation

### Phase 1: Scaffold and copy

#### Step 1.1: Create directory structure

```
plugins/dx-tsc-runner/
  .claude-plugin/
    plugin.json
  .mcp.json
  hooks/
    hooks.json
    tsc-check.ts
    tsc-ci.ts
  commands/
    show-logs.md
  README.md
```

Source: `~/code/side-quest-plugins-backup/plugins/tsc-runner/`

Copy `.mcp.json` verbatim. Copy `hooks/tsc-check.ts`, `hooks/tsc-ci.ts` as starting points (will be modified in Phase 2).

#### Step 1.2: Create plugin.json

File: `plugins/dx-tsc-runner/.claude-plugin/plugin.json`

```json
{
  "name": "dx-tsc-runner",
  "description": "Runs TypeScript type checking after every edit and at session end, surfacing errors inline",
  "version": "1.0.0",
  "author": { "name": "Nathan Vale" },
  "repository": "https://github.com/nathanvale/side-quest-marketplace",
  "keywords": ["typescript", "tsc", "type-checking", "diagnostics", "hooks"],
  "license": "MIT",
  "commands": ["./commands/show-logs.md"]
}
```

> **Research insight (architecture-strategist):** Remove `mcpServers` from plugin.json. The `.mcp.json` file at plugin root already registers the MCP server. Having both could cause double-registration. dx-git uses `.mcp.json` only -- follow the same pattern.

MCP server key stays `"tsc-runner"` in `.mcp.json` (matches npm package name and existing CLAUDE.md references -- plugin name and MCP key are separate namespaces).

#### Step 1.3: Create hooks.json with description

```json
{
  "description": "TypeScript type checker hooks: incremental post-edit check and full project check on stop",
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Write|Edit|MultiEdit",
        "hooks": [
          {
            "type": "command",
            "command": "bun run ${CLAUDE_PLUGIN_ROOT}/hooks/tsc-check.ts",
            "timeout": 30
          }
        ]
      }
    ],
    "Stop": [
      {
        "matcher": "*",
        "hooks": [
          {
            "type": "command",
            "command": "bun run ${CLAUDE_PLUGIN_ROOT}/hooks/tsc-ci.ts",
            "timeout": 120
          }
        ]
      }
    ]
  }
}
```

> **Research insight (pattern-recognition-specialist):** The pipe-separated `Write|Edit|MultiEdit` matcher is regex syntax and works correctly in Claude Code. dx-git uses separate matcher entries per tool for readability, but both approaches are valid. Keep the compact form since all three tools trigger the same hook.

> **Research insight (framework-docs-researcher):** Timeouts (30s/120s) are justified. Default hook timeout is 600s. PostToolUse fires frequently so 30s keeps it snappy. Stop is a full project check so 120s accommodates large projects. Self-destruct timers at 80% (24s/96s) provide clean exit before Claude Code kills the process.

#### Step 1.4: Create show-logs.md with YAML frontmatter

> **Research insight (naming-conventions skill):** Rename from `logs.md` to `show-logs.md`. Commands should use imperative verbs per the naming conventions. "logs" is a noun; "show-logs" is imperative. This matches dx-git patterns like `commit-push-pr.md`.

Backup has no frontmatter -- add it to match dx-git command conventions:

```yaml
---
description: View tsc-runner MCP server and hook logs
model: haiku
allowed-tools: Read
argument-hint: "[count=N] [level=LEVEL] [errors]"
---
```

Keep the instructions body, but merge the redundant Usage/Instructions sections into one clean section.

#### Step 1.5: Register in marketplace.json

Add to `.claude-plugin/marketplace.json` plugins array:

```json
{
  "name": "dx-tsc-runner",
  "source": "./plugins/dx-tsc-runner",
  "description": "TypeScript type checker MCP server with post-edit hooks for Claude Code",
  "category": "development",
  "tags": ["typescript", "tsc", "type-checking", "hooks", "mcp"]
}
```

Bump root version: `1.0.0` -> `1.1.0`.

---

### Phase 2: Harden tsc-check.ts (PostToolUse hook)

Source: `~/code/side-quest-plugins-backup/plugins/tsc-runner/hooks/tsc-check.ts`

All changes below apply to the copied file.

#### 2.1: Add `import.meta.main` guard + self-destruct timer

Wrap `main()` call in guard. Timer at 80% of hooks.json timeout (24s for 30s timeout).

```typescript
if (import.meta.main) {
  const selfDestruct = setTimeout(() => {
    process.stderr.write('tsc-check: timed out\n')
    process.exit(0) // Non-gating: allow through on timeout
  }, 24_000)
  selfDestruct.unref()
  main()
}
```

> **Research insight (security-sentinel):** Exit 0 on timeout is correct for PostToolUse. A pathological tsc invocation (huge project, cold cache) should not block the session. This differs from dx-git's git-safety.ts which exits 2 (deny) on timeout, but tsc is a quality gate not a safety gate.

#### 2.2: Fix path-scoping bug (line 120)

Replace `string.replace` with `path.relative`:

```typescript
// BEFORE (buggy -- silently drops errors if path format doesn't match)
const editedBasenames = new Set(
  editedFiles.map((f) => resolve(f).replace(`${cwd}/`, '')),
)

// AFTER (correct)
const editedBasenames = new Set(
  editedFiles.map((f) => relative(cwd, resolve(f))),
)
```

Also normalize tsc error file paths for comparison:

```typescript
const normalizedFile = isAbsolute(error.file)
  ? relative(cwd, error.file)
  : error.file
if (editedBasenames.has(normalizedFile)) {
  allErrors.push(error)
}
```

Add `relative, isAbsolute` to the `node:path` import.

> **Research insight (kieran-typescript-reviewer):** Both sides of the comparison must normalize the same way. The `relative()` call produces paths without leading `./` on both sides, so the comparison is safe. This is the most critical bug fix in the migration.

#### 2.3: Fix pipe deadlock + use idiomatic Bun API

Replace sequential `await proc.exited` then `new Response(proc.stdout).text()` with concurrent reads using Bun's native API:

```typescript
// BEFORE (potential deadlock if stdout buffer fills)
const exitCode = await proc.exited
const stdout = await new Response(proc.stdout).text()
const stderr = await new Response(proc.stderr).text()

// AFTER (concurrent reads, idiomatic Bun API)
const [exitCode, stdout, stderr] = await Promise.all([
  proc.exited,
  proc.stdout.text(),
  proc.stderr.text(),
])
```

> **Research insight (best-practices-researcher, Bun subprocess):** Use `proc.stdout.text()` directly -- not `new Response(proc.stdout).text()`. The `new Response()` wrapper was common in early Bun but the direct `.text()` method has been the idiomatic API since v1.x. Both work identically, but the direct method is shorter and what official docs now show.

> **Research insight (performance-oracle):** The pipe deadlock fix is the most important performance fix. OS pipe buffer is ~64KB on macOS. A large project can easily produce more than 64KB of tsc output. Without `Promise.all`, the parent waits for exit while the child blocks on a full pipe buffer -- classic deadlock.

#### 2.4: Add `--incremental` flag

```typescript
const proc = Bun.spawn(
  ['bunx', 'tsc', '--noEmit', '--incremental', '--pretty', 'false'],
  { cwd, stdout: 'pipe', stderr: 'pipe', env: { ...process.env, CI: 'true' } },
)
```

This writes `.tsbuildinfo` next to `tsconfig.json`. Warm cache reduces check time from 5-30s to 0.5-3s.

> **Research insight (kieran-typescript-reviewer):** `--incremental` with `--noEmit` works since TypeScript 4.x. The `.tsbuildinfo` file is written to the project tree next to `tsconfig.json`. This means:
> - Users should add `.tsbuildinfo` to `.gitignore` (document in README)
> - Concurrent hook fires (rapid Write then Edit) could corrupt the file since tsc has no file locking
> - Corruption is recoverable by deleting the `.tsbuildinfo` file
>
> **Risk is acceptable** because: (a) corruption auto-recovers on next cold run, (b) rapid concurrent fires are rare in practice, (c) the 80-95% speedup on warm cache is worth it.

> **Research insight (best-practices-researcher):** Do NOT use `bunx --bun tsc` -- the `--bun` flag causes path resolution failures for tsc (Bun issue #20725). Use plain `bunx tsc`.

#### 2.5: Parallelize `byConfigDir` loop

Replace serial `for...of` with `Promise.all`:

```typescript
const results = await Promise.all(
  [...byConfigDir.entries()].map(async ([cwd, editedFiles]) => {
    const proc = Bun.spawn(
      ['bunx', 'tsc', '--noEmit', '--incremental', '--pretty', 'false'],
      { cwd, stdout: 'pipe', stderr: 'pipe', env: { ...process.env, CI: 'true' } },
    )
    const [exitCode, stdout, stderr] = await Promise.all([
      proc.exited,
      proc.stdout.text(),
      proc.stderr.text(),
    ])
    if (exitCode === 0) return []
    const errors = parseTscOutput(`${stdout}${stderr}`)
    const editedSet = new Set(editedFiles.map((f) => relative(cwd, resolve(f))))
    return errors.filter((e) => {
      const normalizedFile = isAbsolute(e.file)
        ? relative(cwd, e.file)
        : e.file
      return editedSet.has(normalizedFile)
    })
  }),
)
const allErrors = results.flat()
```

Multi-package edits drop from serial O(n * tsc_time) to parallel O(tsc_time).

> **Research insight (code-simplicity-reviewer):** In practice n=1 for most edits (single tsconfig). The parallelization adds minimal complexity and handles the monorepo case correctly. Keep it.

> **Research insight (best-practices-researcher):** Each parallel tsc process writes its own `.tsbuildinfo` in its own `cwd`, so parallel runs in different config dirs are safe. Only concurrent runs in the SAME config dir risk corruption.

#### 2.6: Use Set for deduplication in extractFilePaths

```typescript
function extractFilePaths(input: HookInput): string[] {
  const seen = new Set<string>()
  if (input.tool_input?.file_path) seen.add(input.tool_input.file_path)
  for (const edit of input.tool_input?.edits ?? []) {
    if (edit.file_path) seen.add(edit.file_path)
  }
  return [...seen]
}
```

#### 2.7: Fix HookInput type -- edits[].file_path should be optional

```typescript
edits?: Array<{ file_path?: string }>
```

> **Research insight (spec-flow-analyzer):** The actual MultiEdit `tool_input` schema from Claude Code uses `{ edits: [{ file_path: string, old_string: string, new_string: string }] }`. The `file_path` on each edit object is always present for MultiEdit, but making it optional in the type is defensive and handles future schema changes.

#### 2.8: Switch error output from stderr to stdout JSON (NEW)

> **Research insight (framework-docs-researcher, spec-flow-analyzer):** Claude Code PostToolUse hooks use stdout JSON for structured feedback. On exit 0, stdout is parsed for JSON fields including `decision`, `reason`, and `hookSpecificOutput`. On exit 2, stderr is read as plain text. The backup hook uses `console.error(JSON.stringify(...))` which writes to stderr -- this means the error details are invisible to Claude on exit 0.

Replace exit 2 + stderr pattern with exit 0 + stdout JSON `decision: "block"`:

```typescript
// BEFORE (error details lost -- stderr ignored on exit 0, stdout ignored on exit 2)
console.error(JSON.stringify({ errors: allErrors, errorCount: allErrors.length }))
process.exit(2)

// AFTER (structured feedback via PostToolUse JSON protocol)
const output = {
  decision: 'block',
  reason: `${allErrors.length} TypeScript error(s) in edited files`,
  hookSpecificOutput: {
    hookEventName: 'PostToolUse',
    additionalContext: allErrors
      .slice(0, 20)
      .map((e) => `${e.file}:${e.line}:${e.col} - ${e.message}`)
      .join('\n'),
  },
}
process.stdout.write(JSON.stringify(output))
process.exit(0)
```

This gives Claude the error details in `additionalContext` so it can fix them without needing a separate `tsc_check` call.

#### 2.9: Add guard for non-zero exit + zero parsed errors (NEW)

> **Research insight (spec-flow-analyzer):** If tsc crashes (corrupt `.tsbuildinfo`, out of memory, missing binary, malformed tsconfig), it returns non-zero but produces no parseable error lines. Currently this is a **silent false pass**. Add a guard:

```typescript
if (exitCode !== 0 && errors.length === 0) {
  // tsc crashed or produced unparseable output -- warn but don't block
  process.stderr.write(
    `tsc-check: tsc exited ${exitCode} but no errors parsed (possible crash). Check tsc manually.\n`
  )
  // Don't block -- this is infrastructure failure, not a code error
}
```

---

### Phase 3: Harden tsc-ci.ts (Stop hook)

Source: `~/code/side-quest-plugins-backup/plugins/tsc-runner/hooks/tsc-ci.ts`

#### 3.1: Add `import.meta.main` guard + self-destruct timer

Timer at 80% of hooks.json timeout (96s for 120s timeout).

```typescript
if (import.meta.main) {
  const selfDestruct = setTimeout(() => {
    process.stderr.write('tsc-ci: timed out\n')
    process.exit(0)
  }, 96_000)
  selfDestruct.unref()
  main()
}
```

#### 3.2: Check `stop_hook_active` to prevent infinite loops (NEW)

> **Research insight (framework-docs-researcher):** Stop hooks receive a `stop_hook_active` field in stdin JSON. When `true`, Claude is already continuing due to a previous Stop hook. Without checking this, a Stop hook that blocks could trigger an infinite loop: block -> Claude continues to address -> Stop fires again -> block again.

```typescript
let stopHookActive = false
try {
  const raw = await Bun.stdin.text()
  if (raw.trim()) {
    const input = JSON.parse(raw) as { stop_hook_active?: boolean }
    stopHookActive = input.stop_hook_active === true
  }
} catch {
  // stdin empty or not JSON -- proceed normally
}
if (stopHookActive) {
  // Already in a Stop hook continuation -- don't block again
  process.exit(0)
}
```

> **Note:** The backup tsc-ci.ts does not read stdin at all. This is a new addition. The Stop hook receives `{ session_id, transcript_path, cwd, permission_mode, hook_event_name, stop_hook_active, last_assistant_message }` on stdin.

#### 3.3: Parallelize 3 sequential git commands

```typescript
async function hasChangedTsFiles(): Promise<boolean> {
  const commands = [
    ['git', 'diff', '--cached', '--name-only', '--diff-filter=d'],
    ['git', 'diff', '--name-only', '--diff-filter=d'],
    ['git', 'ls-files', '--others', '--exclude-standard'],
  ]
  const outputs = await Promise.all(
    commands.map(async (cmd) => {
      const proc = Bun.spawn(cmd, { stdout: 'pipe', stderr: 'pipe' })
      const [output] = await Promise.all([
        proc.stdout.text(),
        proc.exited,
      ])
      return output
    }),
  )
  return outputs.some((output) =>
    output.trim().split('\n').some(
      (file) => file && TS_EXTENSIONS.some((ext) => file.endsWith(ext)),
    ),
  )
}
```

> **Research insight (performance-oracle):** Add `--diff-filter=d` to git diff commands to exclude deleted files. Deleted files can't have type errors, and including them could cause tsc to report "file not found" noise.

#### 3.4: Fix pipe deadlock in runTsc

Same `Promise.all` + `proc.stdout.text()` pattern as 2.3 for the tsc subprocess spawn.

#### 3.5: Add `--incremental` to tsc invocation

Same as 2.4 -- add `--incremental` to the non-workspace tsc command.

#### 3.6: Type-safe package.json parsing

```typescript
function isWorkspace(root: string): boolean {
  try {
    const pkg = JSON.parse(readFileSync(`${root}/package.json`, 'utf-8')) as {
      workspaces?: unknown
    }
    return Array.isArray(pkg.workspaces) && pkg.workspaces.length > 0
  } catch {
    return false
  }
}
```

> **Research insight (spec-flow-analyzer):** This only checks array-form workspaces. Object-form (`{ packages: [...] }`) and `bunfig.toml`-based workspaces would be missed. Accept this limitation -- array-form covers 95%+ of projects, and fixing it adds complexity for a rare edge case.

#### 3.7: Add guard for non-zero exit + zero parsed errors (NEW)

Same pattern as 2.9 -- detect tsc crashes and warn via stderr. For the Stop hook, this writes to stderr since Stop hooks use exit 2 + stderr for blocking (not the JSON protocol).

---

### Phase 4: Write README.md

Title: `# dx-tsc-runner Plugin for Claude Code`

Structure:
- One-line description
- Components table:

| Component | Mechanism | Trigger | Behavior |
|-----------|-----------|---------|----------|
| `tsc_check` MCP tool | JSON-RPC over stdio | On-demand | Structured JSON with `file:line:col` errors |
| PostToolUse hook | Shell script via bun | Write/Edit/MultiEdit on .ts | Blocks on errors in edited files only |
| Stop hook | Shell script via bun | Session end | Blocks on any project errors |

- MCP tool usage with `response_format: "json"` example
- Hook behavior (what blocks, what passes, incremental vs full)
- `/dx-tsc-runner:show-logs` command
- Prerequisites (Bun, TypeScript project with tsconfig)
- `.tsbuildinfo` note: add to `.gitignore`, recoverable on corruption by deleting
- License (MIT)

### Phase 5: Validate

```bash
bun run validate    # Full gate: biome + tsc + marketplace
```

Also verify `dx-tsc-runner` hooks don't need a tsconfig exclude like dx-git does -- the hooks are self-contained with only `node:fs` and `node:path` imports, so they should pass tsc under the project config.

---

## Architectural Decisions

> These decisions were surfaced by the review agents and resolved during plan deepening.

### AD-1: MCP server registration -- `.mcp.json` only

**Decision:** Remove `mcpServers` from `plugin.json`. Register the MCP server only in `.mcp.json` at plugin root.

**Rationale (architecture-strategist):** Having both `.mcp.json` and `plugin.json` `mcpServers` could cause double-registration. dx-git uses `.mcp.json` only. Follow the established pattern.

### AD-2: PostToolUse error output -- stdout JSON, not stderr

**Decision:** Use exit 0 + stdout JSON with `decision: "block"` instead of exit 2 + stderr.

**Rationale (framework-docs-researcher):** Claude Code's PostToolUse protocol reads stdout for JSON on exit 0. On exit 2, only stderr plain text is read. The structured JSON approach gives Claude the error details in `additionalContext` so it can fix errors without a separate `tsc_check` call.

### AD-3: Stop hook -- exit 2 + stderr (keep existing pattern)

**Decision:** Stop hook continues to use exit 2 + stderr for blocking errors.

**Rationale:** Stop hooks have simpler semantics -- exit 2 blocks, stderr is the error message. The JSON protocol (`decision: "block"`) is for PostToolUse. Stop hooks don't need structured JSON since they fire once at session end.

### AD-4: Self-destruct exit code -- exit 0 (non-gating)

**Decision:** Both hooks exit 0 on self-destruct timeout.

**Rationale (security-sentinel):** A timeout is an infrastructure failure, not a code quality signal. Blocking the session because tsc was slow would be worse than allowing through. This differs from dx-git's safety hooks which exit 2 on timeout (security gate vs quality gate).

### AD-5: `--incremental` -- accept .tsbuildinfo in project tree

**Decision:** Use `--incremental` without redirecting `.tsbuildinfo`. Document that users should gitignore it.

**Rationale (kieran-typescript-reviewer):** Redirecting to a temp dir (`--tsBuildInfoFile /tmp/...`) would break the cache across sessions (temp dirs are ephemeral). The 80-95% speedup on warm cache is worth the minor gitignore requirement. Concurrent corruption is self-healing (delete the file).

### AD-6: Command naming -- `show-logs.md`

**Decision:** Rename from `logs.md` to `show-logs.md`.

**Rationale (naming-conventions skill):** Commands should use imperative verbs. "logs" is a noun; "show-logs" follows the verb-noun pattern used by other commands.

---

## Out of scope (separate PRs)

### Marketplace repo (side-quest-marketplace)

- Consolidating three runner MCP servers into one (architecture decision)
- Debounce/cooldown mechanism for PostToolUse hook (state management) -- also mitigates `.tsbuildinfo` concurrent-write risk
- `user-invocable: false` knowledge skill for agent discoverability (HIGH PRIORITY follow-up -- agent-native-reviewer and agent-native-architecture skill both flagged this as the single highest-impact improvement)
- Adding `.mcp.json` validation to `validate-marketplace.ts`
- Repo-boundary check on hook `cwd` derivation via `findNearestConfig` (security-sentinel: cap directory traversal at git root to prevent symlink escape)
- Input shape validation / type guard for stdin JSON (security-sentinel: dx-git has `isPreToolUseHookInput()`, tsc-runner should have equivalent)
- Stop hook execution order documentation (interaction with dx-git's `auto-commit-on-stop.ts`)

### npm package (side-quest-runners) -- issues filed

- [#28](https://github.com/nathanvale/side-quest-runners/issues/28) -- Improve `tsc_check` tool description for LLM routing
- [#29](https://github.com/nathanvale/side-quest-runners/issues/29) -- Replace em dash with double hyphen in formatResult
- [#30](https://github.com/nathanvale/side-quest-runners/issues/30) -- Remove pretty-printing from JSON response format
- [#31](https://github.com/nathanvale/side-quest-runners/issues/31) -- Capture TS error codes in structured output
- [#32](https://github.com/nathanvale/side-quest-runners/issues/32) -- Add `--incremental` flag to tsc invocation
- [#33](https://github.com/nathanvale/side-quest-runners/issues/33) -- Narrow `process.env` spread to explicit allowlist

## Sources

- Backup source: `~/code/side-quest-plugins-backup/plugins/tsc-runner/`
- MCP server source: `~/code/side-quest-runners/packages/tsc-runner/mcp/index.ts`
- dx-git migration blueprint: `docs/plans/2026-03-02-feat-git-plugin-v2-marketplace-port-plan.md`
- Worktree validation learnings: `docs/solutions/integration-issues/worktree-validation-and-hook-test-environment-system-20260302.md`
- Review agents: architecture-strategist, pattern-recognition-specialist, kieran-typescript-reviewer, security-sentinel, performance-oracle, code-simplicity-reviewer, agent-native-reviewer, spec-flow-analyzer
- Skills: agent-native-architecture, naming-conventions
- Research: best-practices-researcher (Bun subprocess patterns), framework-docs-researcher (Claude Code hooks docs)
- Research: MCP best practices from newsroom investigation (Reddit, X, web docs) + Firecrawl best-practices researcher
- Claude Code hooks reference: https://code.claude.com/docs/en/hooks
- Bun spawn API: https://bun.sh/docs/api/spawn
