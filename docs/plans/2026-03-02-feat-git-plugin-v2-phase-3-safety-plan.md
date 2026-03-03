---
created: 2026-03-02
title: "Git Plugin V2 - Phase 3: Safety Fixes"
type: plan
tags: [git, plugin, safety, hooks, PreToolUse, blocked-patterns]
project: git-plugin
status: draft
parent: docs/plans/2026-03-02-feat-git-plugin-v2-marketplace-port-plan.md
prerequisite: docs/plans/2026-03-02-feat-git-plugin-v2-phase-2-compliance-plan.md
research:
  - docs/brainstorms/2026-03-02-git-plugin-v2-feature-evaluation.md (Section 2b)
  - docs/brainstorms/2026-03-02-git-plugin-v2-advanced-safety.md
  - docs/research/2026-03-02-safety-hook-architecture.md
---

> Phase 3 of 5 from the master plan
> Prerequisite: Phase 2 (compliance) must be complete
> Scope: `plugins/git/hooks/git-safety.ts` + `plugins/git/hooks/git-safety.test.ts` only

# Phase 3: Safety Fixes

## Enhancement Summary

**Deepened on:** 2026-03-02  
**Sections enhanced:** 10  
**Research agents used:** best-practices-researcher, framework-docs-researcher, security-sentinel, performance-oracle, architecture-strategist, kieran-typescript-reviewer, code-simplicity-reviewer

### Key Improvements
1. Added official Git/findutils semantics so each blocked command has doc-backed rationale.
2. Added regex-hardening and false-positive controls (token boundaries, case behavior, command chaining assumptions).
3. Added operational validation guidance (negative tests, precedence checks, and regression-proofing for checker order).

### New Considerations Discovered
- `git checkout [<tree-ish>] -- <pathspec>` and `git checkout -- <pathspec>` both overwrite working-tree content and are explicitly documented as restore operations.
- `git merge --abort` is the canonical merge-abort flow; `reset --merge` is valid but riskier as a generic recommendation in conflict states.
- `git stash drop/clear` can sometimes be partially recovered via unreachable commits, but recovery is unreliable and should still be treated as destructive.
- `find -delete` has traversal-order constraints and is destructive by design; warning text should always steer toward `-print` preview first.

## Goal

Close the low-complexity safety gaps identified by analyzing `claude-code-safety-net` (kenryu42, 1,099+ stars). All changes are in two files: `git-safety.ts` (patterns + logic) and `git-safety.test.ts` (test coverage). No new files, no structural changes.

### Research Insights

**Best Practices:**
- Keep this phase constrained to the two existing files to minimize architectural risk and review load.
- Treat this phase as policy hardening (rules + tests), not parser architecture work.
- Preserve backward compatibility in message text where existing tests assert `.toContain(...)`.

**Performance Considerations:**
- Pattern matching remains O(number of patterns/checkers) per command and is cheap at this scale.
- Ordering matters: fast/obvious regex checks should run before more complex custom checkers.

**Implementation Details:**
```typescript
// Keep command safety evaluation deterministic and test-friendly:
// 1) Evaluate BLOCKED_PATTERNS in declaration order
// 2) Evaluate CUSTOM_CHECKERS in declaration order
// 3) Return first block reason to avoid noisy/competing messages
```

**Edge Cases:**
- Mixed shell separators (`&&`, `;`, `|`) can hide destructive tails; regexes should consider boundary contexts where already used.
- Case-sensitivity assumptions: if normalization is not present, document and test lowercase-only behavior explicitly.

**References:**
- https://git-scm.com/docs/git-checkout
- https://git-scm.com/docs/git-reset
- https://github.com/kenryu42/claude-code-safety-net

## Gap Summary

From the feature evaluation brainstorm (Section 2b), these are the gaps our hook doesn't catch that safety-net does:

| Gap | Risk | Status After This Phase |
|-----|------|----------------------|
| `git stash drop/clear` | Medium | Fixed -- new BLOCKED_PATTERNS |
| `git reset --merge` | Medium | Fixed -- new BLOCKED_PATTERNS |
| `git checkout <ref> -- <path>` | Medium | Fixed -- new CUSTOM_CHECKER |
| `find ... -delete` / `-exec rm` | Medium | Fixed -- new BLOCKED_PATTERNS |
| `rm -r -f` flag reordering | Low | Fixed -- improved flag helper |
| `git commit -n` bypasses `--no-verify` check | Medium | Fixed -- detect `-n` short form |
| Unicode whitespace normalization in commands | Critical | Deferred -- Phase 3 safety hardening |
| Per-commit WIP validation (verify each squashed commit is WIP) | Critical | Deferred -- Phase 3 safety hardening |
| `sanitizeRepoName` path traversal hardening (`..` sequences) | Medium | Deferred -- Phase 3 safety hardening |
| Sanitize repoName in session-summary.ts (uses raw split) | Medium | Deferred -- Phase 3 safety hardening |
| Runtime input validation on hook stdin JSON parsing | Low | Deferred -- Phase 3 safety hardening |
| Shell wrapper bypass (`bash -c`) | HIGH | Deferred -- recommend safety-net as companion |
| Interpreter bypass (`python -c`) | Medium | Deferred |
| `xargs` piped destruction | Medium | Deferred |
| `sudo` wrapper stripping | Low | Deferred |

The HIGH/medium deferred items require shell tokenization architecture (Option B from the advanced-safety brainstorm: recommend safety-net as companion, don't build our own).

### Research Insights

**Best Practices:**
- Keep explicit separation between command-pattern defense (this phase) and shell-tokenization defense (deferred architecture).
- Maintain a visible deferred-risk table so consumers know what this hook does not protect.

**Performance Considerations:**
- Avoid attempting partial shell parsing in this phase; hybrid parsing approaches increase complexity and false positives quickly.

**Implementation Details:**
```text
Phase 3 boundary:
- In scope: direct command string patterns + focused custom checkers
- Out of scope: nested shell/interpreter parsing, xargs pipeline graph analysis
```

**Edge Cases:**
- Wrapper bypasses (`bash -c`, `python -c`) can encapsulate blocked commands and evade naive regexes.
- Prefixed commands (`sudo`, env vars, `command`, `nohup`) can shift token positions and bypass brittle patterns.

**References:**
- https://github.com/kenryu42/claude-code-safety-net
- https://git-scm.com/docs/git

---

## Step 1: Add incident/rationale documentation to existing patterns

Add JSDoc comments above each existing `BLOCKED_PATTERNS` entry. Use `@incident` for patterns motivated by observed Claude behavior, `@rationale` for industry-standard blocks.

### Research Insights

**Best Practices:**
- Use consistent taxonomy: `@incident` for empirically observed failures, `@rationale` for normative policy.
- Keep each comment scoped to one risk narrative and one operator action.
- Ensure reasons are imperative and actionable (what to do instead, not just what not to do).

**Performance Considerations:**
- Better rationale comments reduce back-and-forth during incident response and policy reviews (human performance gain).

**Implementation Details:**
```typescript
/**
 * @rationale <why blocked>
 * @incident <optional observed failure mode>
 * Keep reason message short, specific, and with a safe next step.
 */
```

**Edge Cases:**
- Avoid historical claims that may drift; favor stable language tied to command behavior.
- Ensure comments stay aligned with regex intent after future pattern edits.

**References:**
- https://git-scm.com/docs/git-reset
- https://git-scm.com/docs/git-clean

```typescript
const BLOCKED_PATTERNS: Array<{ pattern: RegExp; reason: string }> = [
	/**
	 * @rationale Industry standard -- blocked by dcg, safety-net,
	 * Trail of Bits, and Matt Pocock. Force push rewrites shared
	 * history and can destroy teammates' work.
	 */
	{
		pattern: /git\s+push\s+.*(?:--force|-f)(?:\s|$)/,
		reason:
			'Force push can destroy remote history. Use --force-with-lease if you must.',
	},
	/**
	 * @incident Claude used `git reset --hard` when it meant `--soft`,
	 * losing all uncommitted work. Hard reset is the most commonly
	 * blocked command across every safety tool in the ecosystem.
	 */
	{
		pattern: /git\s+reset\s+--hard/,
		reason: 'Hard reset destroys uncommitted changes permanently.',
	},
	/**
	 * @rationale Industry standard. Origin story: claude-code-safety-net
	 * was created Christmas Day 2025 after someone lost their entire
	 * home directory to `rm -rf ~/` during a Claude Code session.
	 */
	{
		pattern: /git\s+clean\s+.*-f/,
		reason: 'git clean -f permanently deletes untracked files.',
	},
	/**
	 * @rationale Blocked by Matt Pocock, Trail of Bits, and our own
	 * CLAUDE.md safety rules. Discards all unstaged changes with no
	 * undo path.
	 */
	{
		pattern: /git\s+checkout\s+\.\s*(?:$|[;&|])/,
		reason: 'git checkout . discards all unstaged changes permanently.',
	},
	/**
	 * @rationale Same as checkout . -- modern equivalent, same risk.
	 */
	{
		pattern: /git\s+restore\s+\.\s*(?:$|[;&|])/,
		reason: 'git restore . discards all unstaged changes permanently.',
	},
	/**
	 * @rationale Blocked by Matt Pocock. -D force-deletes even
	 * unmerged branches. Safe delete (-d) is allowed.
	 */
	{
		pattern: /git\s+branch\s+.*-D\s/,
		reason: 'git branch -D force-deletes a branch even if not merged.',
	},
	/**
	 * @rationale Force-removing worktrees bypasses the status check
	 * that warns about uncommitted changes.
	 */
	{
		pattern:
			/(?:^|[;&|]\s*)git\s+(?:-C\s+\S+\s+)?worktree\s+remove\s+.*(?:--force|-f)\b/,
		reason:
			'Force-removing a worktree can destroy uncommitted work. Use `bunx @side-quest/git worktree delete` which checks status first.',
	},
```

---

## Step 2: Add new BLOCKED_PATTERNS entries

Add 5 new entries to `BLOCKED_PATTERNS`, after the existing 7:

### Research Insights

**Best Practices:**
- Use word boundaries where possible to avoid accidental matches inside larger tokens.
- Keep stash/reset/find patterns explicit and narrow to destructive forms only.
- Pair every new pattern with both positive (blocked) and negative (allowed) test cases.

**Performance Considerations:**
- Simple literal-forward regexes (`git\s+stash\s+drop`) are cheap and deterministic.
- Avoid heavy backtracking constructs in frequently evaluated patterns.

**Implementation Details:**
```typescript
// Recommended tightening where practical:
/\bgit\s+stash\s+drop\b/
/\bgit\s+stash\s+clear\b/
/\bgit\s+reset\s+--merge\b/
/\bfind\b[\s\S]*\s-delete\b/
/\bfind\b[\s\S]*\s-exec\s+rm\b/
```

**Edge Cases:**
- `find` expressions can reorder predicates and include grouped expressions; tests should include varied ordering.
- `git reset --merge` may appear with refs or without refs; both should remain blocked.

**References:**
- https://git-scm.com/docs/git-stash
- https://git-scm.com/docs/git-reset
- https://www.gnu.org/software/findutils/manual/html_mono/find.html

```typescript
	// --- V2 additions (from safety-net gap analysis) ---

	/**
	 * @rationale Identified by claude-code-safety-net analysis.
	 * Permanently deletes a specific stash entry with no recovery.
	 */
	{
		pattern: /git\s+stash\s+drop/,
		reason:
			'git stash drop permanently deletes a stash entry. Use `git stash list` to review stashes first.',
	},
	/**
	 * @rationale Identified by claude-code-safety-net analysis.
	 * Destroys ALL stash entries in one command.
	 */
	{
		pattern: /git\s+stash\s+clear/,
		reason:
			'git stash clear destroys all stash entries permanently. Use `git stash list` to review first.',
	},
	/**
	 * @rationale Identified by claude-code-safety-net analysis.
	 * Can discard uncommitted changes during conflict resolution.
	 */
	{
		pattern: /git\s+reset\s+--merge/,
		reason:
			'git reset --merge can lose uncommitted changes. Use `git merge --abort` to cleanly abort a merge.',
	},
	/**
	 * @rationale Identified by claude-code-safety-net analysis.
	 * find -delete bypasses trash and removes files recursively.
	 */
	{
		pattern: /find\s+.*-delete/,
		reason:
			'find -delete permanently removes files. Use `find ... -print` first to review, then delete manually.',
	},
	/**
	 * @rationale Identified by claude-code-safety-net analysis.
	 * find -exec rm bypasses trash and removes files recursively.
	 */
	{
		pattern: /find\s+.*-exec\s+rm/,
		reason:
			'find -exec rm permanently removes files. Use `find ... -print` first to review, then delete manually.',
	},
```

---

## Step 3: Detect `-n` short form of `--no-verify`

The `isCommitCommand()` function checks for `--no-verify` using `command.includes('--no-verify')` but misses the `-n` short form. `git commit -n` is equivalent to `git commit --no-verify` per the git docs.

**Identified by:** CodeRabbit review of Phase 2 commit (2026-03-02).

**Before:**
```typescript
const hasNoVerify = command.includes('--no-verify')
```

**After:**
```typescript
const hasNoVerify = command.includes('--no-verify') || /\s-n(?:\s|$)/.test(command)
```

The regex uses `\s` before `-n` to avoid matching `-n` inside longer flags (e.g. `-no-edit`), and `(?:\s|$)` after to anchor the end.

**Tests to add (in Step 5):**
```typescript
describe('git commit -n short flag', () => {
	test.each([
		['git commit -n -m "skip hooks"'],
		['git commit -n -m "chore(wip): checkpoint"'],
	])('detects -n as no-verify: %s', (command) => {
		const result = isCommitCommand(command)
		expect(result.hasNoVerify).toBe(true)
	})

	test.each([
		['git commit -m "normal commit"'],
		['git commit --amend'],
	])('no false positive: %s', (command) => {
		const result = isCommitCommand(command)
		expect(result.hasNoVerify).toBe(false)
	})
})
```

---

## Step 4: Add `checkout -- <path>` custom checker

Add a new entry to `CUSTOM_CHECKERS` array. This needs a custom checker (not a simple BLOCKED_PATTERNS regex) because we must distinguish:

- **Block:** `git checkout HEAD -- file.txt` (overwrites working tree file from ref, no backup)
- **Allow:** `git checkout feature-branch` (normal branch switch, no `--` separator)
- **Already blocked:** `git checkout .` (existing BLOCKED_PATTERNS handles this)

The key discriminator is the `--` separator followed by a non-dot path argument.

### Research Insights

**Best Practices:**
- Prefer a custom checker over one broad regex for checkout semantics because branch-switch and file-restore forms are intentionally overloaded.
- Anchor safety logic to the documented separator behavior: `--` indicates pathspec disambiguation.
- Keep the rule message educational: describe overwrite behavior and safer preview commands.

**Performance Considerations:**
- A single targeted checker is lower-maintenance than multiple overlapping checkout regexes.

**Implementation Details:**
```typescript
// Doc-aligned behavior:
// git checkout [<tree-ish>] -- <pathspec>...
// git checkout -- <pathspec>...
// Both are restore operations that can overwrite working-tree files.
```

**Edge Cases:**
- `git checkout -- file.txt` (index restore) should remain blocked with the same rationale.
- Quoted paths and spaced file names should be included in tests (`"my file.txt"`).
- `git checkout -- .` overlaps with existing policy; first-match behavior should remain deterministic.

**References:**
- https://git-scm.com/docs/git-checkout
- https://git-scm.com/docs/git-restore

```typescript
	/**
	 * Block `git checkout <ref> -- <path>` which overwrites working tree
	 * files from a specific ref without creating a backup.
	 *
	 * Matches: git checkout HEAD -- file.txt, git checkout abc123 -- src/
	 * Does NOT match: git checkout feature-branch, git checkout -b new-branch,
	 *   git checkout . (handled by BLOCKED_PATTERNS)
	 *
	 * @rationale Identified by claude-code-safety-net analysis. V1 only caught
	 * `git checkout .` but not targeted file overwrites.
	 */
	(command) => {
		// Look for: git checkout <something> -- <path>
		// The -- separator is the key indicator this is a file checkout, not a branch switch
		if (/git\s+checkout\s+\S+\s+--\s+\S/.test(command)) {
			return 'git checkout <ref> -- <path> overwrites files without backup. Use `git stash` to save changes first, or `git diff <ref> -- <path>` to review.'
		}
		return null
	},
```

**Edge cases considered:**
- `git checkout -- file.txt` (no ref, just `--` and path) -- also blocked, which is correct. This overwrites the working tree file from the index.
- `git checkout HEAD -- .` -- blocked by both this checker AND the existing `checkout .` pattern. Double-blocking is harmless.
- `git checkout -b new-branch` -- NOT blocked. The `-b` flag means no `--` separator + path follows.
- `git checkout main` -- NOT blocked. No `--` separator.

---

## Step 5: Improve rm flag parsing with helper function

The existing `CUSTOM_CHECKERS` entry for `rm -rf .worktrees/` already handles split flags well, but it only checks `.worktrees/` paths. Extract the flag detection into a reusable helper so future checkers can use it.

Add the helper function before `CUSTOM_CHECKERS`:

### Research Insights

**Best Practices:**
- Encapsulate flag parsing in a named helper to improve readability and future reuse.
- Keep helper pure and side-effect free to maximize unit-testability.
- Treat short and long flags equivalently (`-rf`, `-r -f`, `--recursive --force`).

**Performance Considerations:**
- Single-pass extraction of short flags plus two regex checks for long flags is effectively constant-time for typical command lengths.

**Implementation Details:**
```typescript
// Ensure helper remains command-agnostic for reuse:
// hasRecursiveForceRm(command: string): boolean
// Future checkers can call this without duplicating regex complexity.
```

**Edge Cases:**
- Mixed flag groups like `-rvf` should still be treated correctly.
- Non-rm commands containing `-rf` text should not pass caller guards (`/\brm\b/` check first).

**References:**
- https://git-scm.com/docs/git-worktree
- https://www.gnu.org/software/findutils/manual/html_mono/find.html

```typescript
/**
 * Detects whether an `rm` command has both recursive and force flags,
 * regardless of flag ordering or grouping.
 *
 * Matches: -rf, -fr, -r -f, -f -r, --recursive --force,
 *   --recursive -f, -r --force, etc.
 */
function hasRecursiveForceRm(command: string): boolean {
	// Collect all short flags from all flag groups (e.g., "-rf", "-r", "-f")
	const shortFlags = [...command.matchAll(/-([a-zA-Z]+)/g)]
		.map((m) => m[1])
		.join('')
	const hasRecursive =
		shortFlags.includes('r') || /--recursive\b/.test(command)
	const hasForce = shortFlags.includes('f') || /--force\b/.test(command)
	return hasRecursive && hasForce
}
```

Then simplify the existing `.worktrees/` checker to use it:

```typescript
	/**
	 * Block `rm` with recursive+force flags targeting .worktrees paths.
	 *
	 * @rationale Worktree directories must be cleaned via `git worktree remove`
	 * or `bunx @side-quest/git worktree clean` to properly update git's
	 * worktree registry.
	 */
	(command) => {
		// Only check rm commands targeting .worktrees paths
		if (!/\brm\b/.test(command)) return null
		if (!/\.worktrees(?:[/\\]|\s|$)/.test(command)) return null
		if (!hasRecursiveForceRm(command)) return null
		return 'Deleting .worktrees/ directly bypasses git worktree cleanup. Use `bunx @side-quest/git worktree clean` instead.'
	},
```

**Why refactor:** The existing checker's regex is complex and hard to read. The helper function is self-documenting, testable, and reusable. The behavior is identical -- all existing tests must still pass.

---

## Step 6: Add tests

Add new test `describe` blocks to `git-safety.test.ts`. The file currently has one top-level `describe('git-safety worktree patterns')` with two nested describes. Add new top-level describes for each new pattern category.

### Research Insights

**Best Practices:**
- For each blocked command family, include symmetric allow-list assertions to prevent policy creep.
- Keep tests table-driven (`test.each`) to reduce duplication and improve readability.
- Add precedence tests for overlapping rules to guarantee stable reason output.

**Performance Considerations:**
- Test runtime increase should remain small; table-driven suites optimize setup overhead.

**Implementation Details:**
```typescript
// Add one precedence example:
test('checkout dot remains blocked by existing checkout-dot policy', () => {
  const result = checkCommand('git checkout HEAD -- .')
  expect(result.blocked).toBe(true)
  // assert stable reason contract if policy order matters
})
```

**Edge Cases:**
- Include quoted paths, escaped separators, and commands with leading whitespace.
- Ensure safe forms like `find ... -print` and non-destructive stash commands remain allowed.

**References:**
- https://git-scm.com/docs/git-stash
- https://git-scm.com/docs/git-checkout
- https://www.gnu.org/software/findutils/manual/html_mono/find.html

### 5a. Stash operations

```typescript
describe('git stash destructive operations', () => {
	describe('git stash drop', () => {
		test.each([
			['git stash drop'],
			['git stash drop stash@{0}'],
			['git stash drop stash@{2}'],
		])('blocks: %s', (command) => {
			const result = checkCommand(command)
			expect(result.blocked).toBe(true)
			expect(result.reason).toContain('stash drop')
		})
	})

	describe('git stash clear', () => {
		test.each([
			['git stash clear'],
		])('blocks: %s', (command) => {
			const result = checkCommand(command)
			expect(result.blocked).toBe(true)
			expect(result.reason).toContain('stash clear')
		})
	})

	describe('safe stash operations', () => {
		test.each([
			['git stash'],
			['git stash list'],
			['git stash show'],
			['git stash show stash@{0}'],
			['git stash pop'],
			['git stash apply'],
			['git stash apply stash@{1}'],
			['git stash push -m "work in progress"'],
		])('allows: %s', (command) => {
			const result = checkCommand(command)
			expect(result.blocked).toBe(false)
		})
	})
})
```

### 5b. Reset --merge

```typescript
describe('git reset --merge', () => {
	test.each([
		['git reset --merge'],
		['git reset --merge HEAD~1'],
		['git reset --merge abc123'],
	])('blocks: %s', (command) => {
		const result = checkCommand(command)
		expect(result.blocked).toBe(true)
		expect(result.reason).toContain('reset --merge')
	})

	test.each([
		['git reset --soft HEAD~1'],
		['git reset --mixed HEAD~1'],
		['git reset HEAD~1'],
		['git reset'],
	])('allows: %s', (command) => {
		const result = checkCommand(command)
		expect(result.blocked).toBe(false)
	})
})
```

### 5c. Checkout -- path

```typescript
describe('git checkout <ref> -- <path>', () => {
	test.each([
		['git checkout HEAD -- file.txt'],
		['git checkout abc123 -- src/'],
		['git checkout main -- package.json'],
		['git checkout HEAD -- src/index.ts'],
		['git checkout -- file.txt'],
	])('blocks: %s', (command) => {
		const result = checkCommand(command)
		expect(result.blocked).toBe(true)
		expect(result.reason).toContain('checkout')
	})

	test.each([
		['git checkout feature-branch'],
		['git checkout -b new-branch'],
		['git checkout -b feat/auth main'],
	])('allows: %s', (command) => {
		const result = checkCommand(command)
		expect(result.blocked).toBe(false)
	})
})
```

**Note:** `git checkout .` is already handled by the existing `BLOCKED_PATTERNS` entry. We don't need to test it here -- it's covered by the existing pattern.

### 5d. Find deletion

```typescript
describe('find destructive operations', () => {
	describe('find -delete', () => {
		test.each([
			['find . -name "*.log" -delete'],
			['find /tmp -type f -delete'],
			['find . -empty -delete'],
		])('blocks: %s', (command) => {
			const result = checkCommand(command)
			expect(result.blocked).toBe(true)
			expect(result.reason).toContain('find')
		})
	})

	describe('find -exec rm', () => {
		test.each([
			['find /tmp -exec rm {} \\;'],
			['find . -exec rm -f {} +'],
			['find . -name "*.tmp" -exec rm -rf {} \\;'],
		])('blocks: %s', (command) => {
			const result = checkCommand(command)
			expect(result.blocked).toBe(true)
			expect(result.reason).toContain('find')
		})
	})

	describe('safe find operations', () => {
		test.each([
			['find . -name "*.ts"'],
			['find . -type f -print'],
			['find . -name "*.log" -print0'],
			['find . -maxdepth 1 -type d'],
		])('allows: %s', (command) => {
			const result = checkCommand(command)
			expect(result.blocked).toBe(false)
		})
	})
})
```

### 5e. rm flag parsing (expanded)

The existing test block for `rm -rf .worktrees/` already covers combined, split, and `--` separator cases. Add test cases for long flags to confirm the `hasRecursiveForceRm` helper handles them:

```typescript
// Add to the existing 'rm -rf .worktrees/' describe block:
test.each([
	['rm --recursive --force .worktrees/foo'],
	['rm --recursive -f .worktrees/'],
	['rm -r --force .worktrees/bar'],
])('blocks (long flags): %s', (command) => {
	const result = checkCommand(command)
	expect(result.blocked).toBe(true)
	expect(result.reason).toContain('Deleting .worktrees/ directly bypasses')
})
```

---

## Step 7: Validate + test

```bash
bun run validate && bun test plugins/git/
```

Both must pass. Pay special attention to:
- All existing tests still pass (no regressions from the flag helper refactor)
- All new tests pass
- No Biome lint issues in the new code

### Research Insights

**Best Practices:**
- Run formatter/lint/type/test in the same CI order used by the repo to avoid local/CI drift.
- Fail fast on lint/type before full test runs when possible.

**Performance Considerations:**
- If suite growth continues, shard by plugin scope to keep feedback under a few minutes.

**Implementation Details:**
```bash
# Preferred local verification sequence
bun run validate
bun test plugins/git/
```

**Edge Cases:**
- Snapshot/string assertion brittleness: ensure reason assertions use stable fragments where appropriate.
- Validate on clean working tree segment for deterministic reporting.

**References:**
- https://bun.sh/docs/cli/test
- https://bun.sh/docs/cli/run

---

## Success Criteria

- [x] 5 new entries in `BLOCKED_PATTERNS` (stash drop, stash clear, reset --merge, find -delete, find -exec rm)
- [x] `isCommitCommand()` detects `-n` short form of `--no-verify`
- [x] 1 new entry in `CUSTOM_CHECKERS` (checkout -- path)
- [x] `hasRecursiveForceRm` helper function extracted
- [x] Existing `.worktrees/` rm checker refactored to use helper (behavior unchanged)
- [x] All 7 existing `BLOCKED_PATTERNS` have `@incident` or `@rationale` JSDoc
- [x] All 5 new `BLOCKED_PATTERNS` have `@rationale` JSDoc
- [x] All existing tests pass (no regressions)
- [x] New test blocks: stash, reset --merge, checkout -- path, find, rm long flags
- [x] `bun run validate` passes
- [x] `bun test plugins/git/` passes

Validation note (2026-03-02):
- `bun test plugins/git/hooks/git-safety.test.ts` passes (`70 pass`, `0 fail`).
- `bun test plugins/git/` passes (`87 pass`, `0 fail`).
- `bun run validate` passes (`check` + `typecheck` + `validate:marketplace` all green in this worktree).

### Research Insights

**Best Practices:**
- Add one explicit criterion for no broadening of block scope beyond listed gaps (false-positive guardrail).
- Add one explicit criterion for deterministic reason precedence where overlaps exist.

**Performance Considerations:**
- Include a lightweight metric: total test count delta and runtime delta for this phase.

**Implementation Details:**
```markdown
- [x] No new false positives in known-safe command corpus
- [ ] Checker precedence remains deterministic for overlapping patterns
```

**Edge Cases:**
- Command variants with extra whitespace or quoting should satisfy same criteria.

**References:**
- https://git-scm.com/docs/git

---

## What's NOT in This Phase

These are explicitly deferred per the advanced-safety brainstorm (Option B: recommend safety-net as companion):

| Gap | Risk | Why Deferred |
|-----|------|-------------|
| Unicode whitespace normalization in commands | Critical | Invisible chars can bypass regex patterns; needs systematic normalization pass |
| Per-commit WIP validation before squash | Critical | Squash currently trusts commit prefix; needs per-commit content verification |
| `sanitizeRepoName` path traversal (`..` sequences) | Medium | Current sanitizer strips special chars but `..` passes through; needs explicit rejection |
| Sanitize repoName in session-summary.ts | Medium | Uses raw `gitRoot.split('/').pop()` without `sanitizeRepoName`; needs alignment |
| Runtime input validation on hook stdin JSON | Low | Hooks trust stdin shape; needs schema validation or defensive parsing |
| Shell wrapper bypass (`bash -c "git reset --hard"`) | HIGH | Requires shell tokenization architecture |
| Interpreter bypass (`python -c 'os.system(...)'`) | Medium | Requires interpreter scanning |
| `xargs rm -rf` / `xargs bash -c` | Medium | Requires pipe analysis |
| `sudo git reset --hard` | Low | Requires wrapper stripping |
| CWD-aware path resolution | Low | Requires path normalization |

These will be addressed by recommending `claude-code-safety-net` as a companion plugin (Phase 5 adds the recommendation to `references/workflows.md`).

### Research Insights

**Best Practices:**
- Document companion-plugin positioning as defense-in-depth, not replacement.
- Keep deferred list tied to a specific future phase to prevent scope ambiguity.

**Performance Considerations:**
- Deferring parser architecture preserves delivery speed for this phase while reducing regression risk.

**Implementation Details:**
```text
Phase 5 handoff should include:
1) Recommended companion setup steps
2) Clear ownership boundary between native hook and companion scanner
3) Example bypass cases covered by companion tooling
```

**Edge Cases:**
- Users may assume complete shell safety after this phase; docs should state residual risk clearly.

**References:**
- https://github.com/kenryu42/claude-code-safety-net
- https://git-scm.com/docs/git-merge
