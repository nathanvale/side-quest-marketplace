---
created: 2026-03-02
title: "Git Plugin V2 - Marketplace Port and Uplift"
type: plan
tags: [git, plugin, marketplace, hooks, safety, commits, worktrees, conventional-commits]
project: git-plugin
status: draft
origin:
  - docs/brainstorms/2026-03-02-git-plugin-v2-marketplace-port.md
  - docs/brainstorms/2026-03-02-git-plugin-v2-feature-evaluation.md
  - docs/brainstorms/2026-03-02-git-plugin-v2-advanced-safety.md
  - docs/brainstorms/2026-03-02-git-plugin-v2-git-intelligence-migration.md
  - docs/brainstorms/2026-03-02-git-plugin-v2-worktree-strategy.md
research:
  - docs/research/2026-02-11-git-plugin-landscape.md
  - docs/research/2026-03-02-git-plugin-landscape-update.md
  - docs/research/2026-03-02-safety-hook-architecture.md
---

> Origin: 5 brainstorm documents covering marketplace port, feature evaluation, advanced safety, git intelligence migration, and worktree strategy
> Research: Feb 11 landscape analysis + March 2 delta update + safety hook architecture deep-dive
> V1 source: `~/code/side-quest-plugins/plugins/git/` (production ~3 weeks, v1.0.0)

# feat: Git Plugin V2 - Marketplace Port and Uplift

## Overview

Port the production V1 git plugin from `~/code/side-quest-plugins/plugins/git/` into the `side-quest-marketplace` at `plugins/git/`, then uplift it to V2 matching cortex-engineering conventions. The work is split into 5 sequential phases -- each phase produces a working, validating plugin that builds on the previous.

## Problem Statement

The V1 git plugin runs well in production but lives outside the marketplace. It doesn't follow marketplace conventions (no self-destruct timers, flat reference files instead of progressive disclosure, descriptions lack WHAT+WHEN+WHEN-NOT pattern). Research identified concrete safety gaps and two new commands worth adopting. This plan brings it all together.

## Decisions Carried from Brainstorms

These decisions were already made during brainstorming and are NOT re-evaluated here:

| Decision | Source |
|----------|--------|
| Keep 1 skill (workflow) with references/ restructure, not multiple skills | marketplace-port brainstorm, Section "Skill Architecture" |
| Keep shared modules (event-bus-client, git-status-parser) -- DRY wins over self-contained hooks | marketplace-port brainstorm, Section "Shared vs Self-Contained" |
| Keep `bunx @side-quest/git` for worktree management | marketplace-port brainstorm, Section "Worktree CLI Dependency" |
| Port `/worktree` command as-is, no worktree strategy changes | feature-evaluation, Section 3 |
| No MCP port, no git-intelligence migration in V2 | feature-evaluation, Section 6 |
| Shell tokenization architecture deferred -- recommend safety-net as companion (Option B from advanced-safety brainstorm) | advanced-safety brainstorm |
| Keep Co-Authored-By as default, note AI-assistant trailer as optional | feature-evaluation, Section 1f |
| Git AI v3.0.0 integration deferred to V2.1 | feature-evaluation, Section 1d |
| Port PreCompact hook (session-summary.ts) as-is -- evaluate cortex overlap later | marketplace-port brainstorm, Open Question 3 |

## Open Question

**Should the PreCompact cortex extraction hook (`session-summary.ts`) be its own plugin?** It extracts decisions/errors/learnings via regex, overlapping with cortex-engineering's domain. Carried forward from brainstorming. Resolve during Phase 2 review or defer to V2.1.

---

## Phase 1: Port and Conform

**Goal:** Get the V1 plugin into the marketplace directory, conforming to marketplace lint/format/typecheck rules. Functionally identical to V1.

**Important:** This is NOT a "zero changes" copy. The marketplace uses Biome (tabs, single quotes, 80-char width) and strict TypeScript. V1 hooks will be reformatted by `bun run check` (Biome `--write` mode). This is expected and correct -- the files must conform to the marketplace's toolchain from day one.

### 1.1 Create directory structure

```
plugins/git/
  .claude-plugin/
    plugin.json
  commands/
    changelog.md
    checkpoint.md
    commit.md
    compare.md
    create-pr.md
    history.md
    review-pr.md
    session-log.md
    squash.md
    worktree.md
  hooks/
    auto-commit-on-stop.ts
    command-logger.ts
    event-bus-client.ts
    event-bus-client.test.ts
    git-context-loader.ts
    git-safety.ts
    git-safety.test.ts
    git-status-parser.ts
    git-status-parser.test.ts
    hooks.json
    session-summary.ts
  skills/
    workflow/
      SKILL.md
      CONVENTIONS.md
      EXAMPLES.md
      WORKFLOWS.md
      WORKTREE.md
  README.md
```

**Excluded from port:** `plans/`, `research/` directories from V1 -- these stay at the marketplace `docs/` level, not inside the plugin.

### 1.2 Copy all files

Copy every file from `~/code/side-quest-plugins/plugins/git/` into `plugins/git/` (excluding `plans/` and `research/`).

### 1.3 Register in marketplace

Add entry to `.claude-plugin/marketplace.json`:

```json
{
  "name": "git",
  "source": "./plugins/git",
  "description": "Git workflow automation with conventional commits, safety hooks, worktree management, and PR creation",
  "category": "development",
  "tags": ["git", "commits", "conventional-commits", "safety", "worktree", "pr"]
}
```

### 1.4 Update marketplace version

Bump `marketplace.json` version from `0.1.0` to `0.2.0` (minor bump for plugin addition).

### 1.5 Run Biome format/lint

Run `bun run check` (Biome `--write` mode). This will reformat all `.ts` files to marketplace conventions (tabs, single quotes, 80-char lines). Review the changes to confirm they're format-only, no semantic differences.

### 1.6 Fix typecheck issues

Run `bun run typecheck`. The marketplace tsconfig includes `plugins/**/*.ts` with strict mode + `bun-types`. Fix any type errors introduced by the stricter config. Common issues:
- Missing return types on exported functions
- Implicit `any` on catch clauses
- Unused imports

### 1.7 Create README.md

Write a README for the git plugin following the marketplace pattern. Brief description, feature list, commands table, hooks table, installation note.

### 1.8 Validate + test

Run `bun run validate` (lint + typecheck + marketplace structure) AND `bun test plugins/git/` (unit tests). Both must pass.

**Note:** `bun test` is NOT included in `bun run validate` -- it must be run separately.

---

## Phase 2: Marketplace Compliance

**Goal:** Align with cortex-engineering conventions. No new features -- just structural and convention compliance.

### 2.1 Add self-destruct timers to hook entry points

Add as the **first executable line** in the 5 hook entry-point files (NOT shared modules or test files):

```typescript
// Self-destruct timer MUST be the first executable line.
// .unref() lets the process exit naturally when work completes.
const selfDestruct = setTimeout(() => {
	process.stderr.write('<hook-name>: timed out\n');
	process.exit(1);
}, TIMEOUT_MS);
selfDestruct.unref();
```

| Hook | Entry Point File | Timeout | Why |
|------|-----------------|---------|-----|
| SessionStart | git-context-loader.ts | 15_000 | Runs git commands, needs headroom |
| PreToolUse | git-safety.ts | 5_000 | Must be fast -- blocks tool execution |
| PostToolUse | command-logger.ts | 5_000 | File I/O + event bus |
| PreCompact | session-summary.ts | 15_000 | Reads transcript + git ops |
| Stop | auto-commit-on-stop.ts | 10_000 | Runs git add + git commit |

**Do NOT add timers to:** `event-bus-client.ts` (shared module, imported by others), `git-status-parser.ts` (shared module), `*.test.ts` files.

### 2.2 Restructure skill references

Move flat companion files into `references/` subdirectory:

```
skills/workflow/
  SKILL.md
  references/
    conventions.md    (was CONVENTIONS.md)
    workflows.md      (was WORKFLOWS.md)
    worktree.md       (was WORKTREE.md)
    examples.md       (was EXAMPLES.md)
```

Lowercase filenames to match cortex-engineering's reference naming convention.

### 2.3 Polish SKILL.md description

Update the SKILL.md frontmatter `description` to follow the WHAT+WHEN+WHEN-NOT pattern:

```yaml
description: Git workflow expert -- conventional commits, history exploration, worktree management, PR creation, squash, and safety. Use for any git-related task including committing, branching, history, and repository analysis. Do not use for non-git file operations or general coding tasks.
```

### 2.4 Update plugin.json description

Tighten to marketplace conventions (one sentence, present tense, no trailing period):

```json
{
  "description": "Git workflow automation with conventional commits, 5 lifecycle hooks, safety guards, worktree management, and PR creation"
}
```

Remove `"email"` from author if present (cortex-engineering doesn't include it). Update `"repository"` to the marketplace repo URL. Bump version to `2.0.0`.

### 2.5 Update event bus discovery path

Update `event-bus-client.ts` to try the global observability server path first, with fallback to per-repo path:

```typescript
// Primary: global observability server
const globalPath = path.join(HOME, '.cache', 'side-quest-observability', 'events.port');
// Fallback: per-repo path (V1 convention)
const repoPath = path.join(HOME, '.cache', 'side-quest-git', repoName, 'events.port');
```

### 2.6 Update SKILL.md reference paths

After moving files to `references/`, update any cross-references in SKILL.md that point to `CONVENTIONS.md`, `WORKFLOWS.md`, `WORKTREE.md`, `EXAMPLES.md` -- these now point to `references/conventions.md`, etc.

### 2.7 Validate + test

Run `bun run validate` AND `bun test plugins/git/`. Both must pass.

---

## Phase 3: Safety Fixes

**Goal:** Close the low-complexity safety gaps identified in the safety-net analysis. All changes in `git-safety.ts` + tests.

### 3.1 Add blocked patterns

Add to `BLOCKED_PATTERNS` in `git-safety.ts`:

| Pattern | Regex | Rationale |
|---------|-------|-----------|
| `git stash drop` | `/git\s+stash\s+drop/` | Permanently deletes a stash entry |
| `git stash clear` | `/git\s+stash\s+clear/` | Destroys all stashes |
| `git reset --merge` | `/git\s+reset\s+--merge/` | Can lose uncommitted changes |
| `find ... -delete` | `/find\s+.*-delete/` | Recursive file deletion |
| `find ... -exec rm` | `/find\s+.*-exec\s+rm/` | Recursive file deletion via exec |

### 3.2 Add `checkout -- <path>` detection

This needs a CUSTOM_CHECKER (not a simple regex) because we must distinguish:
- **Block:** `git checkout HEAD -- file.txt` (overwrites working tree file, no backup)
- **Allow:** `git checkout feature-branch` (normal branch switch)
- **Already blocked:** `git checkout .` / `git checkout -- .` (existing pattern)

The distinguishing feature is the `--` separator followed by a path. Implementation:

```typescript
// Custom checker: git checkout <ref> -- <path>
// Matches: git checkout HEAD -- file.txt, git checkout abc123 -- src/
// Does NOT match: git checkout feature-branch, git checkout -b new-branch
(cmd: string) => {
  const match = cmd.match(/git\s+checkout\s+\S+\s+--\s+\S/);
  if (match) return 'Use `git stash` or `git diff` before overwriting files with checkout';
  return null;
}
```

### 3.3 Improve rm flag parsing

The existing `CUSTOM_CHECKERS` entry for `rm -rf .worktrees/` uses a literal `-rf` match. Refactor to a helper function that detects recursive + force flags in any combination:

```typescript
function hasRecursiveForceFlags(cmd: string): boolean {
  // Match: -rf, -fr, -r -f, -f -r, --recursive --force, --recursive -f, etc.
  const hasRecursive = /\s-[a-z]*r[a-z]*\b/.test(cmd) || /--recursive\b/.test(cmd);
  const hasForce = /\s-[a-z]*f[a-z]*\b/.test(cmd) || /--force\b/.test(cmd);
  return hasRecursive && hasForce;
}
```

Update the `.worktrees/` rm checker to use this helper. Also works for split flags (`rm -r -f`) and reversed order (`rm -fr`).

### 3.4 Add incident documentation

Add JSDoc comments to each `BLOCKED_PATTERNS` entry documenting the incident or rationale. Format:

```typescript
/**
 * @incident Claude used `git reset --hard` when it meant `--soft`,
 * losing all uncommitted work in the process.
 */
{ pattern: /git\s+reset\s+--hard/, reason: '...' },
```

For patterns inherited from V1 where the specific incident isn't known, use:
```typescript
/** @rationale Industry standard -- blocked by dcg, safety-net, Trail of Bits, and Matt Pocock */
```

### 3.5 Add tests for new patterns

Add test cases to `git-safety.test.ts`:

**Stash operations:**
- Block: `git stash drop`, `git stash drop stash@{0}`, `git stash clear`
- Allow: `git stash`, `git stash list`, `git stash show`, `git stash pop`, `git stash apply`

**Reset --merge:**
- Block: `git reset --merge`, `git reset --merge HEAD~1`
- Allow: `git reset --soft`, `git reset --mixed`, `git reset` (default mixed)

**Checkout -- path:**
- Block: `git checkout HEAD -- file.txt`, `git checkout abc123 -- src/`, `git checkout main -- package.json`
- Allow: `git checkout feature-branch`, `git checkout -b new-branch`, `git checkout .` (existing pattern handles this)

**Find deletion:**
- Block: `find . -name "*.log" -delete`, `find /tmp -exec rm {} \;`, `find . -exec rm -f {} +`
- Allow: `find . -name "*.ts"`, `find . -type f -print`

**rm flag parsing:**
- Block: `rm -rf .worktrees/foo`, `rm -fr .worktrees/foo`, `rm -r -f .worktrees/foo`, `rm --recursive --force .worktrees/foo`, `rm --recursive -f .worktrees/foo`
- Allow: `rm file.txt`, `rm -r dir/` (no force), `rm -f file.txt` (no recursive)

### 3.6 Validate + test

Run `bun run validate` AND `bun test plugins/git/`. Both must pass.

---

## Phase 4: New Commands

**Goal:** Add two new commands from the feature evaluation brainstorm.

### 4.1 Add `/commit-push-pr` command

New file: `commands/commit-push-pr.md`

Thin orchestration command that chains existing workflows:
1. Detect and squash WIP commits if any exist (`chore(wip):` in log)
2. Run the full `/commit` workflow
3. If commit succeeds, run the `/create-pr` workflow

```yaml
---
description: Commit, push, and create a pull request in one workflow
model: sonnet
allowed-tools:
  - Bash(git *:*)
  - Bash(gh *:*)
  - Read
  - Glob
  - Grep
argument-hint: [description]
---

Use the **workflow** skill to create a conventional commit, push, and create a pull request.

**Workflow:**
1. Check for WIP commits (chore(wip): pattern) -- if found, squash them first using the squash workflow
2. Run the full commit workflow (branch check, staging, conventional commit)
3. If commit succeeds, push to remote and create a PR using the create-pr workflow

$ARGUMENTS
```

### 4.2 Add `/clean-gone` command

New file: `commands/clean-gone.md`

Cleans up local branches whose remote tracking branch has been deleted (after PR merge).

```yaml
---
description: Delete local branches whose remote tracking branch is gone
model: haiku
allowed-tools:
  - Bash(git fetch:*)
  - Bash(git branch:*)
  - Bash(git worktree:*)
  - Bash(git rev-parse:*)
argument-hint: [--dry-run]
---

Use the **workflow** skill to clean up branches with deleted remote tracking branches.

**Workflow:**
1. Run `git fetch --prune` to update remote tracking info
2. Run `git branch -vv` to find branches marked `[gone]`
3. NEVER delete the current branch or main/master
4. Show the list of branches to be deleted and ask for confirmation
5. For each gone branch: check if a worktree exists (`git worktree list`), remove worktree first if so, then delete the branch with `git branch -d` (safe delete -- fails if unmerged)
6. Report what was cleaned (or what would be cleaned if --dry-run)

**Safety:**
- Use `git branch -d` (lowercase d), NOT `git branch -D` -- this refuses to delete unmerged branches
- Skip the current branch (check with `git rev-parse --abbrev-ref HEAD`)
- Skip main/master even if marked [gone]
- Always show the list before deleting and confirm with the user

$ARGUMENTS
```

**Note:** The safety hook blocks `git branch -D` (force delete). The `/clean-gone` command uses `git branch -d` (safe delete) which is allowed. If a branch is unmerged, `-d` will refuse and the command should report the failure rather than escalating to `-D`.

### 4.3 Register new commands in plugin.json

Add both commands to the `"commands"` array in `plugin.json`.

### 4.4 Update routing table in SKILL.md

Add entries to the routing table in SKILL.md:

```markdown
| Commit + PR in one step | /git:commit-push-pr (squash WIP, commit, push, create PR) |
| Clean merged branches | /git:clean-gone (prune gone remote branches + worktrees) |
```

### 4.5 Update the SessionStart routing table

Update `git-context-loader.ts` to include the new commands in the "Git Command Routing" table output.

### 4.6 Add workflow for `/commit-push-pr` to references/workflows.md

Add a "Commit-Push-PR" section to the workflows reference documenting the chained workflow: detect WIP, squash if needed, commit, push, create PR.

### 4.7 Validate + test

Run `bun run validate` AND `bun test plugins/git/`.

---

## Phase 5: Reference Updates

**Goal:** Apply research-backed content improvements to reference docs. No code changes.

### 5.1 Dual-audience commit note

Add to `references/conventions.md`:

```markdown
## Dual-Audience Writing

Commit messages serve both humans reviewing PRs and future AI agents reading history.
Vague commits force agents to guess intent from raw diffs. Include:
- **What** changed (the subject line)
- **Why** it changed (the body)
- **What it affects** (mention modules, services, or APIs touched)
```

### 5.2 Anti-slop guardrails

Add to `references/conventions.md`:

```markdown
## Anti-Slop Guardrails

Do NOT:
- Echo the debugging conversation into the commit message (describe the outcome, not the journey)
- Write over-verbose subjects (keep under 72 chars)
- Narrate implementation steps ("First I did X, then Y, then Z")
- Omit scope on non-trivial changes

DO:
- Focus on what changed and why
- Use specific, actionable language
- Keep the subject line scannable at a glance
```

### 5.3 AI-assistant trailer note

Add to `references/conventions.md`:

```markdown
## AI Attribution

**Default:** `Co-Authored-By: Claude <noreply@anthropic.com>` (GitHub shows avatar in commit list)

**Optional addition:** `AI-assistant: Claude Code (model: claude-sonnet-4-5)` trailer for teams tracking multi-model workflows. Not mutually exclusive with Co-Authored-By.
```

### 5.4 Narrative commit ordering

Add to `references/conventions.md`:

```markdown
## Narrative Ordering

When splitting large changes into multiple commits, order them to tell a story:
1. Data models / schema changes
2. Business logic
3. UI / presentation
4. Tests
5. Documentation

This enhances review clarity -- each commit builds on the previous in a logical sequence.
```

### 5.5 Safety-net companion recommendation

Add a note to `references/workflows.md` (safety section):

```markdown
## Companion: claude-code-safety-net

Our safety hook catches git-specific destructive commands. For deeper Bash analysis
(shell wrapper unwrapping, interpreter scanning, recursive command detection), consider
installing `claude-code-safety-net` as a companion PreToolUse hook. Both hooks run
simultaneously without conflict.

GitHub: kenryu42/claude-code-safety-net (1,099+ stars, MIT)
```

### 5.6 Validate

Run `bun run validate`.

---

## File Manifest

### Phase 1 -- Ported from V1

All files copied from `~/code/side-quest-plugins/plugins/git/` then reformatted by Biome:

| File | Notes |
|------|-------|
| `plugins/git/.claude-plugin/plugin.json` | Plugin manifest |
| `plugins/git/README.md` | New -- written for marketplace |
| `plugins/git/skills/workflow/SKILL.md` | Skill definition |
| `plugins/git/skills/workflow/CONVENTIONS.md` | Moved to `references/` in Phase 2 |
| `plugins/git/skills/workflow/WORKFLOWS.md` | Moved to `references/` in Phase 2 |
| `plugins/git/skills/workflow/WORKTREE.md` | Moved to `references/` in Phase 2 |
| `plugins/git/skills/workflow/EXAMPLES.md` | Moved to `references/` in Phase 2 |
| `plugins/git/commands/*.md` (10 files) | All 10 V1 commands |
| `plugins/git/hooks/*.ts` (5 entry points) | git-context-loader, git-safety, command-logger, session-summary, auto-commit-on-stop |
| `plugins/git/hooks/*.ts` (2 shared modules) | event-bus-client, git-status-parser |
| `plugins/git/hooks/*.test.ts` (3 test files) | git-safety, git-status-parser, event-bus-client |
| `plugins/git/hooks/hooks.json` | Hook configuration |

### Phase 2 -- Modified for compliance

| File | Change |
|------|--------|
| `plugins/git/hooks/git-safety.ts` | Add self-destruct timer |
| `plugins/git/hooks/git-context-loader.ts` | Add self-destruct timer |
| `plugins/git/hooks/command-logger.ts` | Add self-destruct timer |
| `plugins/git/hooks/session-summary.ts` | Add self-destruct timer |
| `plugins/git/hooks/auto-commit-on-stop.ts` | Add self-destruct timer |
| `plugins/git/hooks/event-bus-client.ts` | Global observability path with fallback |
| `plugins/git/skills/workflow/SKILL.md` | Polish description (WHAT+WHEN+WHEN-NOT), update reference paths |
| `plugins/git/.claude-plugin/plugin.json` | Update description, author, repository, version to 2.0.0 |
| `.claude-plugin/marketplace.json` | Add git plugin entry, bump to 0.2.0 |

### Phase 3 -- Safety additions

| File | Change |
|------|--------|
| `plugins/git/hooks/git-safety.ts` | New blocked patterns, checkout--path checker, rm flag helper, incident docs |
| `plugins/git/hooks/git-safety.test.ts` | New test cases for all additions |

### Phase 4 -- New commands

| File | Change |
|------|--------|
| `plugins/git/commands/commit-push-pr.md` | New orchestration command |
| `plugins/git/commands/clean-gone.md` | New branch cleanup command |
| `plugins/git/.claude-plugin/plugin.json` | Register 2 new commands |
| `plugins/git/skills/workflow/SKILL.md` | Add routing table entries |
| `plugins/git/hooks/git-context-loader.ts` | Update SessionStart routing table |
| `plugins/git/skills/workflow/references/workflows.md` | Add commit-push-pr workflow |

### Phase 5 -- Reference content updates

| File | Change |
|------|--------|
| `plugins/git/skills/workflow/references/conventions.md` | Dual-audience, anti-slop, AI-assistant trailer, narrative ordering |
| `plugins/git/skills/workflow/references/workflows.md` | Safety-net companion recommendation |

---

## Validation Checklist

After each phase, run both:

```bash
bun run validate              # Lint + typecheck + marketplace structure
bun test plugins/git/         # Unit tests (NOT included in validate)
```

Final PR checklist:
- [ ] All 5 phases complete
- [ ] `bun run validate` passes (zero errors)
- [ ] `bun test plugins/git/` passes (all 3 test files: safety, parser, event-bus)
- [ ] New safety tests pass (Phase 3 additions)
- [ ] 12 commands registered in plugin.json (10 ported + 2 new)
- [ ] 5 hook entry points have self-destruct timers (shared modules do NOT)
- [ ] References in `references/` subdirectory (lowercase, not flat UPPERCASE)
- [ ] SKILL.md reference paths updated to match new `references/` location
- [ ] marketplace.json version bumped to 0.2.0
- [ ] plugin.json version set to 2.0.0
- [ ] No em dashes anywhere (use `--` instead)
- [ ] No `plans/` or `research/` directories inside the plugin (those stay at `docs/` level)

---

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| V1 hooks fail typecheck under strict tsconfig | Blocks Phase 1 | Fix type errors immediately -- likely minor (implicit any, missing returns). V1 already works, so logic is sound. |
| Biome reformatting changes test snapshots or string comparisons | Breaks tests | Run tests after Biome format. If string-matching tests break due to whitespace changes, update expected values. |
| Self-destruct timer fires during legitimate long-running hook | Kills hook mid-operation, loses output | Timeouts are generous (5-15s). git-context-loader at 15s is well above typical <1s runtime. Monitor in production. |
| `checkout -- <path>` regex false positives | Blocks legitimate git operations | Custom checker only matches `git checkout <ref> -- <path>` pattern (requires `--` separator + path after it). `git checkout branch-name` has no `--` so passes through. Test thoroughly. |
| Event bus test depends on ephemeral server port | Flaky in CI or worktree | Existing test uses `Bun.serve({ port: 0 })` which is already robust. No change needed. |
| `/clean-gone` deletes branches user wants to keep | Lost branch references | Uses `git branch -d` (safe delete, refuses unmerged). Shows list and confirms before deletion. Never deletes current branch or main/master. |

---

## What's NOT in This Plan

These are explicitly deferred per brainstorm decisions:

| Item | Deferred To | Reason |
|------|-------------|--------|
| Shell tokenization / recursive unwrapping | V2.1 | Recommend safety-net as companion instead |
| Git AI v3.0.0 integration | V2.1 | Needs more traction |
| `.worktreeinclude` convention | V2.1 | Part of worktree strategy brainstorm |
| Session identity keying | V2.1 | Part of worktree strategy brainstorm |
| Git Intelligence MCP-to-skill migration | V2.1 | Needs separate brainstorm resolution |
| Worktree strategy changes | V2.1 | Nathan hasn't settled on direction |
| AI-POLICY.txt enforcement | V3 | No implementations yet |
| Prompt injection defense | V3 | Different concern than git safety |
| Multi-agent review stacks | V3 | Requires orchestration beyond plugin |
| PreCompact hook extraction to own plugin | V2.1 | Open question -- evaluate after port |
