---
created: 2026-03-02
deepened: 2026-03-02
title: "Git Plugin V2 - Phase 2: Marketplace Compliance"
type: plan
tags: [git, plugin, marketplace, compliance, hooks, self-destruct, references]
project: git-plugin
status: draft
parent: docs/plans/2026-03-02-feat-git-plugin-v2-marketplace-port-plan.md
prerequisite: docs/plans/2026-03-02-feat-git-plugin-v2-phase-1-port-plan.md
---

> Phase 2 of 5 from the master plan: `docs/plans/2026-03-02-feat-git-plugin-v2-marketplace-port-plan.md`
> Prerequisite: Phase 1 (port) must be complete -- all V1 files in `plugins/git/`, validate passing

## Enhancement Summary

**Deepened on:** 2026-03-02
**Sections enhanced:** 7 steps + 3 new steps added
**Research agents used:** architecture-strategist, security-sentinel, performance-oracle, code-simplicity-reviewer, pattern-recognition-specialist, agent-native-reviewer, best-practices-researcher (x3), spec-flow-analyzer

### Key Improvements

1. **CRITICAL: git-safety.ts must use `process.exit(2)` (deny) on timeout, not `process.exit(1)` (allow)** -- a timed-out safety hook must fail-closed to prevent destructive commands executing during hangs
2. **Timeout values recalibrated** -- aligned with brainstorm spec (3-5s, not 5-15s), set to 80% of hooks.json timeout to avoid race conditions
3. **Step 6 (event bus path) restored with hardening** -- global observability server exists; use `homedir()` instead of `process.env.HOME`, add port range validation, add `repoName` sanitization
4. **3 new steps added** -- marketplace.json registration, stale path grep pass, hooks.json path verification
5. **Steps 2+3 merged** -- file moves and link updates are one atomic operation with no valid intermediate state
6. **`process.env.HOME` replaced with `homedir()`** -- matches cortex-engineering's established pattern for non-interactive contexts
7. **SKILL.md description upgraded** -- verb-led opener per description-writing.md, expanded WHAT clause to cover rebase/merge/stash

### New Considerations Discovered

- Stop hook self-destruct (10s) races hooks.json timeout (10s) -- reduce to 8s or bump hooks.json to 15s
- Reference files may cross-link each other -- intra-reference links need updating too, not just SKILL.md
- PreCompact cortex extraction overlap with cortex-engineering remains unresolved -- explicitly defer to V3
- Port range not validated in event-bus-client.ts (`parseInt` accepts >65535 and 0) -- add range check
- `repoName` in port file path is unsanitized -- add `sanitizeRepoName()` to prevent path traversal

---

# Phase 2: Marketplace Compliance

## Goal

Align the ported git plugin with cortex-engineering conventions. No new features, no behavior changes -- just structural compliance and polish. After this phase, the plugin follows every marketplace convention.

## Summary of Changes

8 categories of work (revised from original 6):

1. Self-destruct timers on 5 hook entry points (with fail-closed on safety hook)
2. Skill reference restructure + link updates (atomic operation)
3. SKILL.md description polish (WHAT+WHEN+WHEN-NOT pattern)
4. plugin.json metadata update (description, author, repository, version)
5. marketplace.json registration + version bump (NEW)
6. Event bus discovery path + hardening (global path first, `homedir()`, port validation, repoName sanitization)
7. Stale path verification + hooks.json path audit (NEW)
8. Validate + test + smoke test

---

## Step 1: Add self-destruct timers to 5 hook entry points

Insert the self-destruct timer block immediately after each hook's JSDoc comment, **before all import statements**. The timer MUST be the first executable statement in the file. This matches cortex-engineering's `bootstrap.ts` pattern.

**Placement rule (semantic, not line-number-based):**
```
JSDoc comment block
↓
Self-destruct timer (first executable line)
↓
import statements
↓
Hook logic
```

Do NOT use line numbers from V1 files for placement -- they may shift during Phase 1 porting. Use the semantic rule: after JSDoc, before first import.

### Research Insights

**Best Practices (self-destruct timers):**
- `setTimeout` + `.unref()` is the correct pattern for both Bun and Node.js -- Bun v1.2.5+ fully supports `.unref()` semantics (GitHub issue #880 resolved)
- `.unref()` allows the process to exit naturally when all async work completes, without waiting for the timer
- `process.stderr.write()` is synchronous in both Node.js and Bun -- safe to call before `process.exit()`
- No cleanup needed before exit in the timeout path -- stderr is synchronous, and the hook is hung by definition

**Timeout calibration rule:** Set the self-destruct timer to **80% of the hooks.json timeout** (converted to milliseconds). This ensures:
1. Self-destruct fires first, writes a diagnostic message, exits cleanly
2. If self-destruct itself is broken (event loop genuinely blocked), hooks.json SIGKILL catches it as backstop
3. No race condition between the two timeout mechanisms

**CRITICAL -- Exit code semantics for Claude Code hooks:**
- Exit 0 = allow (pass through to tool execution)
- Exit 1 = error (Claude Code treats as allow by default)
- Exit 2 = deny (block tool, show reason to Claude)

The cortex `bootstrap.ts` uses `process.exit(1)` because it's a context loader -- timing out loses context, not safety. **git-safety.ts MUST use `process.exit(2)` on timeout** because it's a gatekeeper -- a timed-out safety check is grounds for denial, not silent permission.

**References:**
- [Bun Timer .unref() Support](https://github.com/oven-sh/bun/issues/880)
- [Unblocking Node With Unref()](https://httptoolkit.com/blog/unblocking-node-with-unref/)
- [Node.js stdout not flushed on exit](https://github.com/nodejs/node/issues/2972)

### 1a. `hooks/git-context-loader.ts` (SessionStart, 12_000ms)

```typescript
// Self-destruct timer MUST be the first executable line.
// Set to 80% of hooks.json timeout (15s). .unref() lets the process
// exit naturally when work completes.
const selfDestruct = setTimeout(() => {
	process.stderr.write('git-context-loader: timed out\n')
	process.exit(1)
}, 12_000)
selfDestruct.unref()
```

**Why 12s:** 80% of hooks.json 15s timeout. The hook runs `git status` + `git log` -- typically <75ms, but on monorepos with 100K+ files without `core.fsmonitor`, `git status` can take 500ms-2s. 12s provides ample headroom while leaving a 3s window for the hooks.json backstop.

### 1b. `hooks/git-safety.ts` (PreToolUse, 4_000ms) -- FAIL-CLOSED

**This hook is different from all others.** It must fail-closed on timeout.

```typescript
// Self-destruct timer MUST be the first executable line.
// FAIL-CLOSED: PreToolUse safety hook exits with code 2 (deny) on timeout.
// A timed-out safety check is grounds for denial, not silent permission.
// Set to 80% of hooks.json timeout (5s).
const selfDestruct = setTimeout(() => {
	process.stderr.write('git-safety: timed out, failing closed\n')
	console.log(JSON.stringify({
		hookSpecificOutput: {
			hookEventName: 'PreToolUse',
			permissionDecision: 'deny',
			permissionDecisionReason:
				'Safety hook timed out. Please retry the command.',
		},
	}))
	process.exit(2)
}, 4_000)
selfDestruct.unref()
```

**Why 4s:** 80% of hooks.json 5s timeout. The safety check is pure regex + one conditional `git branch --show-current` call (8-25ms on local filesystem). 4s is 80-500x the typical execution time.

**Why exit(2), not exit(1):** Exit code 1 means "error/allow" -- Claude Code proceeds with the tool call. For a safety hook that blocks `git reset --hard`, `git push --force`, etc., a timeout MUST deny. The research confirms this follows the "hard deny for irreversible" principle from Blake Crosley's practitioner guide and the claude-code-safety-net strict mode philosophy.

**Concrete risk this prevents:** If `git branch --show-current` hangs (NFS mount, corrupt lockfile, git index contention), the timer fires and the command is denied. Without this, exit(1) would silently allow `git reset --hard` through.

### 1c. `hooks/command-logger.ts` (PostToolUse, 4_000ms)

```typescript
// Self-destruct timer MUST be the first executable line.
// Set to 80% of hooks.json timeout (5s).
const selfDestruct = setTimeout(() => {
	process.stderr.write('command-logger: timed out\n')
	process.exit(1)
}, 4_000)
selfDestruct.unref()
```

**Why 4s:** 80% of hooks.json 5s timeout. The hook appends one line to a JSONL file + fire-and-forget event bus call (500ms AbortController timeout). Worst case ~520ms total.

### 1d. `hooks/session-summary.ts` (PreCompact, 12_000ms)

```typescript
// Self-destruct timer MUST be the first executable line.
// Set to 80% of hooks.json timeout (15s).
const selfDestruct = setTimeout(() => {
	process.stderr.write('session-summary: timed out\n')
	process.exit(1)
}, 12_000)
selfDestruct.unref()
```

**Why 12s:** 80% of hooks.json 15s timeout. This is the most I/O-intensive hook -- reads full transcript JSONL (up to 2MB for long sessions), runs 3 git commands, writes 2 files. Worst case ~500ms for realistic transcripts, but 12s provides headroom for pathological sessions.

### 1e. `hooks/auto-commit-on-stop.ts` (Stop, 8_000ms)

```typescript
// Self-destruct timer MUST be the first executable line.
// Set to 80% of hooks.json timeout (10s).
const selfDestruct = setTimeout(() => {
	process.stderr.write('auto-commit-on-stop: timed out\n')
	process.exit(1)
}, 8_000)
selfDestruct.unref()
```

**Why 8s (changed from 10s):** The original plan used 10s, which exactly matches the hooks.json timeout (10s), creating a race condition. Setting self-destruct to 8s (80% of 10s) gives a 2s window for the hooks.json backstop to fire if the self-destruct itself fails.

### Files NOT getting timers

- `event-bus-client.ts` -- shared module, imported by other hooks. Not an entry point.
- `git-status-parser.ts` -- shared module, imported by other hooks. Not an entry point.
- `*.test.ts` -- test files, not hooks.

### Performance Considerations

- PreToolUse hooks **block tool execution**. Every Bash, Write, and Edit tool call waits for `git-safety.ts` to complete. Typical execution: 5-50ms. The 4s timeout is 80-800x headroom.
- PostToolUse `command-logger.ts` incurs ~16ms overhead per Bash command (one `git worktree list` subprocess + one stat for port file). For 50 Bash calls per session, that's 800ms total -- negligible.
- SessionStart runs once per session -- 12s is generous but fires only once.

### Edge Cases

- If `Bun.spawn` in `session-summary.ts` or `auto-commit-on-stop.ts` keeps a reference alive, the process may not exit naturally. Verify all spawned processes are properly awaited before relying on `.unref()`.
- The `postEvent()` call inside the safety hook has its own 500ms AbortController timeout. If the event bus is unreachable, this adds 500ms to the total hook time. The 4s self-destruct accommodates this.

---

## Step 2: Restructure skill references AND update all paths (atomic operation)

**This is a single atomic step.** Moving files and updating links must happen together -- there is no valid intermediate state where files are moved but links point to old locations.

Move the 4 flat companion files into a `references/` subdirectory with lowercase names, then immediately update all paths.

**Before:**
```
skills/workflow/
  SKILL.md
  CONVENTIONS.md
  EXAMPLES.md
  WORKFLOWS.md
  WORKTREE.md
```

**After:**
```
skills/workflow/
  SKILL.md
  references/
    conventions.md
    examples.md
    workflows.md
    worktree.md
```

**Commands:**
```bash
mkdir -p plugins/git/skills/workflow/references
mv plugins/git/skills/workflow/CONVENTIONS.md plugins/git/skills/workflow/references/conventions.md
mv plugins/git/skills/workflow/EXAMPLES.md plugins/git/skills/workflow/references/examples.md
mv plugins/git/skills/workflow/WORKFLOWS.md plugins/git/skills/workflow/references/workflows.md
mv plugins/git/skills/workflow/WORKTREE.md plugins/git/skills/workflow/references/worktree.md
```

### Research Insights

**Naming conventions (confirmed):**
- Lowercase kebab-case for all reference files -- only `SKILL.md` is uppercase
- Single-word names (`conventions.md`) are valid -- kebab-case only needed for multi-word names
- No YAML frontmatter in reference files -- start with `# Title` heading
- Confirmed by all 18 reference files in cortex-engineering plugin

**Progressive disclosure best practices:**
- SKILL.md: target 150-300 lines for knowledge skills, hard limit 500 lines
- Reference files: no enforced limit, but add table of contents over 100 lines
- Links must be one level deep from SKILL.md -- no chained references
- Include a description after each link for Claude to understand what to expect before reading

**Link update table (SKILL.md):**

All links in SKILL.md that reference old locations:

| Old | New |
|-----|-----|
| `[WORKFLOWS.md](WORKFLOWS.md)` | `[workflows.md](references/workflows.md)` |
| `[CONVENTIONS.md](CONVENTIONS.md)` | `[conventions.md](references/conventions.md)` |
| `[EXAMPLES.md](EXAMPLES.md)` | `[examples.md](references/examples.md)` |
| `[WORKTREE.md](WORKTREE.md)` | `[worktree.md](references/worktree.md)` |

This covers the 8 links in the routing table and 2 links in the "Commit Format" section. Total: 10 link updates in SKILL.md.

### Edge Cases

**Intra-reference cross-links:** The 4 reference files may link to each other using old flat paths (e.g., CONVENTIONS.md linking to EXAMPLES.md). After moving both to `references/`, these cross-links change from `EXAMPLES.md` to just `examples.md` (same directory). **Check all 4 files for cross-references and update them.**

**Case sensitivity on macOS:** macOS default filesystem (APFS) is case-insensitive. Moving `CONVENTIONS.md` to `conventions.md` via `mv` may silently succeed even if the name didn't change. Verify with `ls` after the move that files are actually lowercase.

---

## Step 3: Polish SKILL.md description

Update the frontmatter `description` to follow the WHAT+WHEN+WHEN-NOT pattern.

**Before:**
```yaml
description: Git workflow expert — conventional commits, history exploration, worktree management, PR creation, squash, and safety. Activates for any git-related task including committing, branching, history, and repository analysis.
```

**After:**
```yaml
description: Provides git workflow expertise -- conventional commits, history exploration, worktree management, PR creation, squash, rebase, merge, stash, and safety guards. Use for any git-related task including committing, branching, history, repository analysis, or worktree coordination. Do not use when no git operations are involved.
```

### Research Insights

**Description writing best practices:**
- **Verb-led opener** per `description-writing.md`: "Provides git workflow expertise" (verb-led) outperforms "Git workflow expert" (noun phrase) for Claude's routing
- **Third person always** -- descriptions are injected into the system prompt; first/second person confuses Claude's self-model
- **Expanded WHAT clause** -- V1 omits rebase, merge, and stash, which are common git operations the skill handles. Missing keywords means undertriggering for those operations
- **Tighter WHEN-NOT** -- "Do not use when no git operations are involved" is clearer than "Do not use for non-git file operations" and avoids false negatives for mixed tasks like "edit these files and commit"
- **Pushy language** can improve activation rate but "MUST BE USED" phrasing shows mixed results -- assertive but not coercive is the sweet spot

**Changes from original plan:**
- Verb-led opener (was noun phrase)
- Added rebase, merge, stash to WHAT clause (were missing)
- Added "worktree coordination" to WHEN clause
- Tighter WHEN-NOT: "when no git operations are involved" vs "for non-git file operations or general coding tasks"
- Replace em dash with `--` per CLAUDE.md rule (unchanged from original plan)

---

## Step 4: Update plugin.json

Update `plugins/git/.claude-plugin/plugin.json` metadata:

**Before:**
```json
{
  "description": "Git intelligence for Claude Code - session context, commit history, smart commits with Conventional Commits. Includes 5 lifecycle hooks (SessionStart/PreToolUse/PostToolUse/PreCompact/Stop) and slash commands.",
  "version": "1.0.0",
  "author": { "name": "Nathan Vale", "email": "hi@nathanvale.com" },
  "repository": "https://github.com/nathanvale/side-quest-plugins"
}
```

**After:**
```json
{
  "description": "Enforces conventional commits, blocks destructive git operations, and automates the commit-push-PR workflow",
  "version": "2.0.0",
  "author": { "name": "Nathan Vale" },
  "repository": "https://github.com/nathanvale/side-quest-marketplace"
}
```

### Research Insights

**Description improvement:** The original plan's description ("Git workflow automation with conventional commits, 5 lifecycle hooks, safety guards, worktree management, and PR creation") reads as a feature enumeration. The "5 lifecycle hooks" detail is an implementation count that will be wrong the moment hooks are added or removed. The revised description focuses on **capabilities** (what the plugin does for you), not implementation details.

Changes:
- **description:** Capability-focused single sentence, present tense, no trailing period, no implementation counts
- **version:** `1.0.0` -> `2.0.0` (major bump -- new home, convention changes)
- **author:** Remove `email` field (matches cortex-engineering pattern)
- **repository:** Point to marketplace repo (new canonical home)

---

## Step 5: Register in marketplace.json (NEW)

**This step was missing from the original plan.** The git plugin must be registered in `.claude-plugin/marketplace.json` to appear in the marketplace.

Add git plugin entry and bump the marketplace version:

```json
{
  "name": "side-quest-marketplace",
  "version": "0.2.0",
  "plugins": [
    {
      "name": "cortex-engineering",
      "source": "./plugins/cortex-engineering",
      "description": "Agent-native knowledge system with research, brainstorm, and knowledge capture skills",
      "category": "development",
      "tags": ["knowledge", "research", "brainstorm", "documentation"]
    },
    {
      "name": "git",
      "source": "./plugins/git",
      "description": "Git workflow automation with conventional commits, safety guards, and lifecycle hooks",
      "category": "development",
      "tags": ["git", "commits", "safety", "hooks", "worktrees"]
    }
  ]
}
```

**Version bump:** `0.1.0` -> `0.2.0` (minor bump for plugin addition, per validation script enforcement).

**Note:** Confirm whether Phase 1 already adds this entry. If so, this step is a verification, not an addition.

---

## Step 6: Update event bus discovery path + hardening

Update `hooks/event-bus-client.ts` to try the global observability server path first, with fallback to the per-repo V1 path. Also apply three security/reliability improvements from research.

**Before (line 90):**
```typescript
const portFile = `${process.env.HOME}/.cache/side-quest-git/${repoName}/events.port`
```

**After:**
```typescript
import { homedir } from 'node:os'

// Use homedir() instead of process.env.HOME -- more robust in non-interactive
// contexts (launchd, cron). Matches cortex-engineering bootstrap.ts pattern.
const HOME = homedir()

// Sanitize repo name to prevent path traversal
function sanitizeRepoName(name: string): string {
	const safe = name.replace(/[^a-zA-Z0-9._-]/g, '_')
	return safe || 'unknown'
}

const safeRepoName = sanitizeRepoName(repoName)

// Primary: global observability server
const globalPortFile = `${HOME}/.cache/side-quest-observability/events.port`
// Fallback: per-repo path (V1 convention)
const repoPortFile = `${HOME}/.cache/side-quest-git/${safeRepoName}/events.port`

const globalFile = Bun.file(globalPortFile)
const portFile = (await globalFile.exists()) ? globalPortFile : repoPortFile
```

And add port range validation after `parseInt`:
```typescript
const port = parseInt(await file.text(), 10)
if (Number.isNaN(port) || port < 1 || port > 65535) return
```

### Research Insights

**Why `homedir()` instead of `process.env.HOME`:**
- `os.homedir()` falls back to `getpwuid()` (the system user database) when `HOME` is unset
- `process.env.HOME` returns `undefined` in some non-interactive contexts (launchd, cron, sudo)
- `undefined/.cache/...` silently creates a relative path, potentially reading/writing unexpected files
- cortex-engineering's `bootstrap.ts` already uses `homedir()` for exactly this reason (JSDoc documents it)

**Why sanitize repoName:**
- `getStableRepoName()` derives from `git worktree list --porcelain` -> `split('/').pop()`
- While `split('/').pop()` strips directory separators, directory names with unusual characters could still cause issues
- A regex allowlist (`/[^a-zA-Z0-9._-]/g` -> `_`) is defensive and costs nothing

**Why validate port range:**
- `parseInt("99999")` produces 99999 (above valid 1-65535 range)
- Port 0 connects to kernel's ephemeral port assignment -- unpredictable
- One-line check closes both cases

**XDG consideration:** Could respect `$XDG_CACHE_HOME` if set, falling back to `~/.cache`. This is spec-correct but can be deferred -- all macOS CLI tools default to `~/.cache` anyway.

**Test impact:** The existing `event-bus-client.test.ts` creates temp directories with the per-repo path. Tests should still pass because:
- `HOME` is set to a temp directory (now via mocked `homedir()`)
- The global path won't exist in the temp directory
- Discovery falls back to the repo path (V1 behavior)

Consider adding a test case for the global path. Also consider adding a test for `sanitizeRepoName()` edge cases.

---

## Step 7: Verify paths and audit for stale references (NEW)

### 6a. Grep pass for stale reference paths

After the restructure in Step 2, confirm zero occurrences of old flat paths:

```bash
grep -r "CONVENTIONS.md\|WORKFLOWS.md\|WORKTREE.md\|EXAMPLES.md" plugins/git/skills/workflow/ \
  | grep -v "references/"
```

**Must return empty.** Any result not including `references/` in the path is a stale link.

### 6b. Verify hooks.json paths

Confirm all hook file paths in `hooks/hooks.json` resolve correctly against the ported directory structure:

```bash
# List all hook command paths from hooks.json
grep -o '"command": "[^"]*"' plugins/git/hooks/hooks.json
```

Each referenced file must exist at the specified path relative to `${CLAUDE_PLUGIN_ROOT}`.

### 6c. Verify intra-reference cross-links

Check if any of the 4 reference files link to each other:

```bash
grep -l "conventions\|examples\|workflows\|worktree" plugins/git/skills/workflow/references/*.md
```

If cross-links exist, verify they use the new paths (just the filename, since they're now in the same directory).

---

## Step 8: Validate + test + smoke test

### 8a. Automated validation

```bash
bun run validate && bun test plugins/git/
```

Both must pass with zero errors.

### 8b. Smoke test in Claude Code (recommended)

After automated validation passes, do a quick integration check:

1. Start a Claude Code session in any git repo with the plugin loaded
2. Confirm the SessionStart hook fires (git context appears in Claude's awareness)
3. Run a blocked command (e.g., `git reset --hard`) and confirm the safety hook denies it
4. Verify the deny reason message is clear and actionable

This takes 2 minutes and catches integration failures that unit tests miss (hook registration issues, runtime errors in new self-destruct code, path resolution failures).

---

## Success Criteria

- [ ] 5 hook entry points have self-destruct timers as first executable line (after JSDoc, before imports)
- [ ] git-safety.ts uses `process.exit(2)` (deny) on timeout, not `process.exit(1)`
- [ ] All other hooks use `process.exit(1)` on timeout
- [ ] Self-destruct timers are set to 80% of their hooks.json counterpart (no exact-match races)
- [ ] 2 shared modules (`event-bus-client.ts`, `git-status-parser.ts`) do NOT have timers
- [ ] Reference files moved to `references/` subdirectory with lowercase names
- [ ] No files remain at old flat locations (CONVENTIONS.md, EXAMPLES.md, WORKFLOWS.md, WORKTREE.md)
- [ ] All 10 SKILL.md reference links point to `references/` paths
- [ ] No stale flat-path references remain anywhere in `plugins/git/skills/workflow/` (grep verification)
- [ ] Intra-reference cross-links updated if they exist
- [ ] SKILL.md description has verb-led WHAT + WHEN + WHEN-NOT pattern
- [ ] No em dashes in SKILL.md description (uses `--`)
- [ ] plugin.json version is `2.0.0`
- [ ] plugin.json author has no email field
- [ ] plugin.json repository points to marketplace repo
- [ ] plugin.json description is capability-focused, no trailing period, no implementation counts
- [ ] Git plugin registered in marketplace.json
- [ ] marketplace.json version bumped (minor bump for plugin addition)
- [ ] hooks.json paths verified against actual directory structure
- [ ] event-bus-client.ts uses `homedir()` instead of `process.env.HOME`
- [ ] event-bus-client.ts tries global path first, falls back to repo path
- [ ] event-bus-client.ts validates port range (1-65535)
- [ ] event-bus-client.ts sanitizes repoName before path construction
- [ ] `bun run validate` passes
- [ ] `bun test plugins/git/` passes

---

## Open Decisions

### PreCompact cortex extraction overlap (DEFERRED to V3)

The `session-summary.ts` PreCompact hook extracts decisions/errors/learnings via regex. This overlaps with cortex-engineering's domain. The master brainstorm flagged this as unresolved.

**Decision:** Defer to V3. Port as-is in V2. The hook works correctly and the overlap is functional, not architectural. Resolving it requires a cross-plugin coordination design that is out of scope for compliance work.

**Tracking:** `docs/brainstorms/2026-03-02-git-plugin-v2-marketplace-port.md`, Open Question #3.

---

## What's NOT in This Phase

| Deferred to Phase 3 | Reason |
|---------------------|--------|
| New blocked patterns (stash drop, find -delete, etc.) | Safety fixes are a separate concern |
| Incident documentation on existing patterns | Goes with safety fixes |
| Flag parsing improvements | Goes with safety fixes |

| Deferred to Phase 4 | Reason |
|---------------------|--------|
| New commands (commit-push-pr, clean-gone) | New features, not compliance |
| Routing table updates for new commands | Depends on Phase 4 |

| Deferred to Phase 5 | Reason |
|---------------------|--------|
| Dual-audience commit notes | Content update, not structural |
| Anti-slop guardrails | Content update |
| Safety-net companion recommendation | Content update |

| Deferred to future work | Reason |
|------------------------|--------|
| `XDG_CACHE_HOME` support in event-bus-client.ts | Minor improvement, can be added later |
| PreCompact cortex extraction ownership | Cross-plugin design question, deferred to V3 |

---

## Security Findings (from security-sentinel review)

Findings 1-3 are now addressed in Step 6. Finding 4 is accepted risk.

| Finding | Severity | Status |
|---------|----------|--------|
| `repoName` unsanitized in port file path -- potential path traversal | MEDIUM | **Fixed in Step 6** -- `sanitizeRepoName()` added |
| `process.env.HOME` can be undefined -- produces `"undefined/.cache/..."` | LOW | **Fixed in Step 6** -- replaced with `homedir()` |
| Port integer range unchecked (accepts 0, >65535) | LOW | **Fixed in Step 6** -- range validation added |
| `session-summary.ts` reads arbitrary `transcript_path` without validation | INFORMATIONAL | Accepted risk -- path comes from trusted Claude Code parent process |

---

## Architectural Notes (from architecture-strategist review)

**Version semantics:** The plugin's internal version (`2.0.0`) and the marketplace registry version (`0.2.0`) track different things. Plugin.json tracks the plugin's own history; marketplace.json tracks the registry's history. This is architecturally sound but could confuse contributors -- consider a one-line comment in the README.

**Self-destruct timer duplication:** The 4-line timer block is duplicated 5 times. This is the correct tradeoff -- a shared `withSelfDestruct()` helper would create a new import dependency between hook entry points. For 5 files x 4 lines, duplication wins over abstraction. The plugin is distributed as a unit; hooks should remain self-contained entry points.

**Pattern divergence is intentional:** The git-safety.ts self-destruct pattern deliberately diverges from cortex bootstrap.ts on the exit code. Document this in the JSDoc so future maintainers understand why git-safety.ts departs from the cortex template. The two hooks serve fundamentally different purposes (context loader vs gatekeeper).
