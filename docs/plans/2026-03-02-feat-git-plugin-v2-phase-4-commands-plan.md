---
created: 2026-03-02
title: "Git Plugin V2 - Phase 4: New Commands"
type: plan
tags: [git, plugin, commands, commit-push-pr, clean-gone]
project: git-plugin
status: draft
parent: docs/plans/2026-03-02-feat-git-plugin-v2-marketplace-port-plan.md
prerequisite: docs/plans/2026-03-02-feat-git-plugin-v2-phase-3-safety-plan.md
origin:
  - docs/brainstorms/2026-03-02-git-plugin-v2-feature-evaluation.md (Sections 1b, 1c)
deepened: 2026-03-02
deepened-round-2: 2026-03-02
---

> Phase 4 of 5 from the master plan
> Prerequisite: Phase 3 (safety fixes) must be complete
> Origin: Feature evaluation brainstorm -- Nathan approved both commands

## Enhancement Summary

**Deepened:** 2026-03-02 (2 rounds, 12 research/review agents total)

**Round 1 agents (9):** branch cleanup best practices, commit-push-PR chaining, Claude Code command design, security sentinel, code simplicity, architecture strategist, performance oracle, pattern recognition, agent-native parity

**Round 2 agents (3):** commit-push-PR orchestration deep dive, clean-gone edge cases deep dive, agent-native CLI design patterns

### Key Improvements (Round 1)

1. **Commands simplified to one-liners** -- all 9 review agents converged: workflow/safety content belongs in `references/workflows.md`, not in command bodies. Aligns with the established pattern across all 10 existing commands.
2. **`allowed-tools` tightened for defense-in-depth** -- `Bash(git reset:*)` narrowed to `Bash(git reset --soft:*)`, `Bash(git branch:*)` split into specific subcommands. Principle of least privilege at the command layer, safety hook as second layer.
3. **`git for-each-ref` replaces `git branch -vv | grep`** -- plumbing command with stable machine-parseable output. Immune to branch name injection, locale issues, and the `*` prefix parsing problem on current branch.
4. **Agent-native interaction pattern** -- `/clean-gone` redesigned: dry-run output by default, `--confirm` flag for execution. No blocking confirmation prompts. Compatible with headless/sub-agent callers.
5. **Performance: batch deletion and upfront data gathering** -- `git worktree list` called once (not per-branch), gone branches batch-deleted in a single `git branch -d` call.
6. **Model upgrade for `/clean-gone`** -- haiku -> sonnet. Destructive branch/worktree operations deserve a reliable model; cost difference on a 3-5 message interaction is negligible.

### Key Improvements (Round 2)

7. **WIP squash decision tree** -- handles mixed WIP + good commits, `fixup!`/`squash!` patterns, and the all-WIP vs all-good fast paths. When mixed, ask user rather than blindly squashing everything.
8. **7-step pre-flight checks** with optimal ordering (cheapest first): branch check -> working tree -> auth -> remote -> fetch base -> divergence -> conflict preview.
9. **Squash merge detection** for clean-gone -- when `git branch -d` fails on a `[gone]` branch, tree-comparison algorithm detects squash merges. Reports as advisory rather than auto-deleting with `-D`.
10. **Rich for-each-ref format** -- pipe-delimited output with sha, date, track status, and subject for informational reporting.
11. **Validate-before-push gate** -- `bun run validate` runs AFTER commit but BEFORE push. Commit preserves the work as a rollback point; push is the quality gate. `--skip-validate` escape hatch.
12. **Dual-audience output** -- commands report step-by-step results that both humans can read and agents can parse. Status per step (success/skipped/failed), halt-on-failure semantics.
13. **Idempotent re-run** -- every step handles "nothing to do" gracefully: nothing to commit -> skip, already pushed -> skip, PR exists -> return URL.
14. **Worktree prune before branch delete** -- experimentally verified that orphaned worktree metadata (directory manually deleted) blocks `git branch -d`. Must run `git worktree prune` first.

### Considerations Discovered

- Existing PR detection: `gh pr list --head <branch>` before `gh pr create` to handle re-runs
- `git push -u origin HEAD` preferred over `$(git branch --show-current)` subshell
- `%(upstream:trackshort)` does NOT detect `[gone]` -- must use `%(upstream:track)`
- Branches with no upstream produce empty string (not `[gone]`) -- distinct from gone
- `git branch -d` in batch mode processes independently -- if branch2 fails, branch1 and branch3 still delete
- `git fetch --prune` failure should fall back to cached local state, not abort
- `git symbolic-ref refs/remotes/origin/HEAD` fails if remote HEAD not fetched -- need fallback for default branch detection
- Parent plan inconsistency: `Bash(git *:*)` in master plan vs enumerated patterns here -- phase 4 supersedes

---

# Phase 4: New Commands

## Goal

Add two new commands identified in the feature evaluation brainstorm: `/commit-push-pr` (chains existing workflows into one command) and `/clean-gone` (cleans up branches after PR merge). Both are thin delegation wrappers following the established one-liner command pattern.

## Context

**Nathan's reactions from the brainstorm:**
- `/commit-push-pr`: "I'd love that -- I've been doing commit then push then create PR."
- `/clean-gone`: "I love that, because I've owned that with Styleship."

Both commands delegate to the `workflow` skill. The skill already knows all the underlying procedures -- we're just adding orchestration commands that say "do these steps in sequence."

---

## Step 1: Create `/commit-push-pr` command

New file: `plugins/git/commands/commit-push-pr.md`

This is a thin orchestration command that chains three existing workflows. It follows the same one-liner pattern as all other commands: YAML frontmatter + single sentence delegating to the skill.

```markdown
---
description: Commit, push, and create a pull request in one workflow
model: sonnet
allowed-tools: Bash(git status:*), Bash(git add:*), Bash(git diff:*), Bash(git log:*), Bash(git commit:*), Bash(git push:*), Bash(git reset --soft:*), Bash(git merge-base:*), Bash(git branch --show-current:*), Bash(git symbolic-ref:*), Bash(git rev-list:*), Bash(git fetch:*), Bash(git remote:*), Bash(gh pr:*), Bash(gh pr list:*), Bash(gh auth:*), Bash(bun run validate:*)
argument-hint: [description] [--draft] [--skip-validate]
---

Use the **workflow** skill to commit, push, and create a pull request in one workflow. $ARGUMENTS
```

**Design decisions:**
- **Model: sonnet** -- same as `/commit` and `/create-pr`. Orchestrates complex multi-step workflows needing good judgment.
- **One-liner body** -- matches all 10 existing commands. Workflow steps live in `references/workflows.md`, not the command body. The skill's routing table maps this intent to the Commit-Push-PR section.
- **`Bash(git reset --soft:*)`** -- NOT `Bash(git reset:*)`. The squash step only needs `--soft`. Tightening at the command layer means `git reset --hard` hits both the permission prompt AND the safety hook -- two defense layers.
- **`Bash(git branch --show-current:*)`** -- NOT `Bash(git branch:*)`. Only needs current branch name. Broad `git branch:*` would permit `git branch -D`.
- **`Bash(git symbolic-ref:*)`, `Bash(git rev-list:*)`, `Bash(git fetch:*)`, `Bash(git remote:*)`** -- for pre-flight checks (branch state, divergence detection, remote validation).
- **`Bash(gh auth:*)`** -- for pre-flight `gh auth status` check.
- **`Bash(gh pr list:*)`** -- for detecting existing PRs before `gh pr create`.
- **`Bash(bun run validate:*)`** -- for the validate-before-push gate.
- **`argument-hint: [description] [--draft] [--skip-validate]`** -- supports commit description, draft PR creation, and validation bypass.

---

## Step 2: Create `/clean-gone` command

New file: `plugins/git/commands/clean-gone.md`

```markdown
---
description: Delete local branches whose remote tracking branch is gone
model: sonnet
allowed-tools: Bash(git fetch:*), Bash(git for-each-ref:*), Bash(git branch -d:*), Bash(git worktree list:*), Bash(git worktree prune:*), Bash(git worktree remove:*), Bash(git rev-parse:*), Bash(git symbolic-ref:*), Bash(git merge-tree:*), Bash(git commit-tree:*), Bash(git config:*)
argument-hint: [--confirm]
---

Use the **workflow** skill to clean up local branches whose remote tracking branch has been deleted. $ARGUMENTS
```

**Design decisions:**
- **Model: sonnet** (changed from haiku) -- branch deletion and worktree removal are destructive. Edge cases (worktrees with uncommitted changes, squash-merge detection) require reliable reasoning. Cost difference on 3-5 messages is negligible.
- **One-liner body** -- all workflow logic, safety rules, and confirmation patterns live in `references/workflows.md`.
- **`Bash(git branch -d:*)`** -- NOT `Bash(git branch:*)`. Specifically permits safe delete only. `git branch -D` hits permission prompt AND safety hook.
- **`Bash(git for-each-ref:*)`** -- plumbing command for stable gone branch detection.
- **`Bash(git worktree prune:*)`** -- must clean stale worktree metadata before branch deletion (experimentally verified: orphaned worktrees block `git branch -d`).
- **`Bash(git merge-tree:*)`, `Bash(git commit-tree:*)`** -- for squash merge detection when `-d` fails on a `[gone]` branch.
- **`Bash(git config:*)`** -- for reading protected branch patterns from `cleanup.protectedBranch` config.
- **`argument-hint: [--confirm]`** -- dry-run is default. `--confirm` triggers execution. Agent-native: no blocking prompts.

---

## Step 3: Register new commands in plugin.json

Add both commands to the `"commands"` array in `plugins/git/.claude-plugin/plugin.json`:

```json
"commands": [
    "./commands/changelog.md",
    "./commands/checkpoint.md",
    "./commands/clean-gone.md",
    "./commands/commit.md",
    "./commands/commit-push-pr.md",
    "./commands/compare.md",
    "./commands/create-pr.md",
    "./commands/history.md",
    "./commands/review-pr.md",
    "./commands/session-log.md",
    "./commands/squash.md",
    "./commands/worktree.md"
]
```

Alphabetical order for consistency (existing commands are already alphabetical). Total: 12 commands (10 ported + 2 new).

---

## Step 4: Update SKILL.md routing table

Add two new rows to the routing table in `plugins/git/skills/workflow/SKILL.md`.

Add after "Create PR" row:

```markdown
| Commit + PR in one step | [workflows.md](references/workflows.md) S Commit-Push-PR | `git status`, `git add`, `git commit`, `git push`, `gh pr create` |
| Clean merged branches | [workflows.md](references/workflows.md) S Clean-Gone | `git fetch --prune`, `git for-each-ref`, `git branch -d` |
```

**Routing table is the single source of truth** (architecture review). The SessionStart hook (Step 5) injects a minimal command list pointing to the skill -- it should not duplicate routing logic.

---

## Step 5: Update SessionStart routing table

Update the command routing table in `plugins/git/hooks/git-context-loader.ts` (the `formatAdditionalContext` function, around line 126-138).

Add two new rows:

```typescript
routing +=
    '| Commit + create PR | /git:commit-push-pr (squash WIP, commit, push, create PR) |\n'
routing +=
    '| Clean merged branches | /git:clean-gone (delete branches with gone remotes) |\n'
```

Insert before the "Anything else git" catch-all row (which remains last).

---

## Step 6: Add Commit-Push-PR and Clean-Gone workflow sections

Add two new sections to `plugins/git/skills/workflow/references/workflows.md`.

**Structural convention (architecture review):** The existing workflows.md has atomic procedures (Commit, Squash, PR). Commit-Push-PR is an orchestration that chains atomics. Orchestration workflows reference atomic procedures by name, not re-describe them.

### 6a. Commit-Push-PR section

Add after the "PR (Pull Request)" section:

```markdown
## Commit-Push-PR

Orchestrates squash + commit + push + PR in one flow. Each step uses the same procedure as the corresponding standalone command.

### Parse arguments
- `--draft`: create PR as draft
- `--skip-validate`: skip the validation gate
- Remaining text: use as commit description hint

### Phase 1: Pre-flight (fail fast, before any mutations)

Run these checks in order (cheapest and most likely to fail first):

1. **Branch check**: `git symbolic-ref --short HEAD` -- must be on a feature branch (not main/master). If HEAD is detached, abort.
2. **Working tree check**: `git status --porcelain -b` -- verify there are changes to commit OR existing unpushed commits. If clean AND nothing to push, abort.
3. **Auth check**: `gh auth status` -- must be authenticated. If not, report: "Run `gh auth login` to authenticate."
4. **Remote check**: `git remote get-url origin` -- verify remote exists.
5. **Fetch base**: `git fetch origin main` -- update local view of main for divergence check. If fetch fails (network), warn but continue.
6. **Divergence check**: `git rev-list --left-right --count origin/main...HEAD` -- report commits ahead/behind. If 0 ahead and nothing to commit, abort.

### Phase 2: Squash WIP (conditional)

Classify commits between merge-base and HEAD:

```bash
git log --oneline $(git merge-base origin/main HEAD)..HEAD
```

| Commit pattern | Classification |
|----------------|---------------|
| `chore(wip):` or `wip:` (case-insensitive) | WIP |
| `fixup! <target>` or `squash! <target>` | FIXUP |
| Everything else | GOOD |

**Decision tree:**
- **All WIP, zero GOOD**: `git reset --soft $(git merge-base origin/main HEAD)`, then proceed to commit (generates fresh message from diff)
- **All GOOD, zero WIP**: skip squash entirely
- **Has FIXUP commits**: `git rebase --autosquash $(git merge-base origin/main HEAD)` (handles fixup! targeting)
- **Mixed WIP + GOOD**: present the commit list with WIP marked, ask user:
  1. Squash ALL into one commit (simpler, loses atomic boundaries)
  2. Skip squash, push as-is (keep all commits)
  3. Abort

### Phase 3: Commit (if uncommitted changes exist)

Run the full Commit workflow above (branch check, staging, conventional commit).

**Commit message generation priority:**
1. User's `[description]` argument -> use as subject, infer type/scope from diff
2. No description -> generate entirely from diff (`git diff --stat` + `git diff`)
3. WIP messages are discarded unless they contain meaningful descriptions

Confirm the generated message with the user before committing. This is the review step.

### Phase 4: Validate (unless --skip-validate)

```bash
bun run validate
```

**Why after commit, before push:** the commit preserves work as a local rollback point. The push is the quality gate for "code leaving your machine."

If validation fails:
1. Fix issues and retry (abort the push, let user fix)
2. Push anyway (user accepts broken state)
3. Abort entirely

### Phase 5: Push

```bash
git push -u origin HEAD
```

Use `HEAD` not `$(git branch --show-current)` -- simpler, no subshell.

**Failure handling:**
- Non-fast-forward: "Remote has N commits you don't have. 1) Rebase 2) Merge 3) Abort"
- Auth failure: "Run `gh auth login` to re-authenticate"
- Branch protection: report the rules, suggest different branch name
- Timeout (>60s): report and suggest retry

### Phase 6: Create or update PR

1. Check for existing PR: `gh pr list --head "$(git branch --show-current)" --state open --json url --jq '.[0].url'`
2. If PR exists: report "Pushed to existing PR: <url>" -- done
3. If no PR: run the PR workflow above (`gh pr create` with Summary + Test Plan)
   - If `--draft` flag: add `--draft` to `gh pr create`
   - Derive PR title from the conventional commit subject (more precise than branch name)
4. Return PR URL

### Step reporting

Report each step's outcome for agent callers and humans:
```
Pre-flight: PASS (feat/add-oauth, 3 ahead, 0 behind)
Squash: Skipped (no WIP commits)
Commit: Success - feat(auth): add OAuth2 login flow (abc1234)
Validate: PASS
Push: Success - origin/feat/add-oauth
PR: Created - https://github.com/user/repo/pull/42
```

### Idempotent re-run
- Nothing to commit -> skip commit step
- Already pushed -> skip push step (or push new commits if any)
- PR exists -> return existing URL, report "updated with new commits"
```

### 6b. Clean-Gone section

Add after the Commit-Push-PR section:

```markdown
## Clean-Gone

Delete local branches whose remote tracking branch has been deleted (after PR merge).

Default mode shows what would be deleted. Pass `--confirm` to execute.

### Step 1: Gather state (all commands upfront, before any mutations)

```bash
# Update remote tracking state (fall back to cached state if network fails)
git fetch --prune origin 2>/dev/null || echo "Warning: fetch failed, using cached state"

# Clean orphaned worktree metadata (MUST run before branch deletion)
git worktree prune

# Collect all state in parallel where possible
git worktree list --porcelain
git for-each-ref --format='%(refname:short)|%(objectname:short)|%(creatordate:relative)|%(upstream:track)|%(subject)' refs/heads/
git symbolic-ref --short HEAD 2>/dev/null
```

**Format string notes:**
- Use `|` (pipe) as delimiter -- branch names can contain `/` and `.` but never `|`
- `%(upstream:track)` produces `[gone]` for deleted upstreams, empty string for branches with no upstream (distinct cases)
- `%(upstream:trackshort)` does NOT detect `[gone]` -- must use `%(upstream:track)`
- `%(creatordate:relative)` gives "3 days ago" style dates for the preview report

### Step 2: Determine protected branches

Priority order:
1. Git config: `git config --get-all cleanup.protectedBranch` (user-configured per-repo or global)
2. Auto-detect default branch: `git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null | sed 's|refs/remotes/origin/||'` (falls back to `git config init.defaultBranch`, then "main")
3. Hardcoded fallback: main, master, develop, staging, production

### Step 3: Identify and categorize candidates

From the `for-each-ref` output, find branches where upstream:track is `[gone]`.

Build worktree-branch map from `git worktree list --porcelain`:
- Parse blocks separated by empty lines
- Extract `branch refs/heads/<name>` lines
- Entries with `detached` instead of `branch` do NOT block any branch deletion

**Categorize each gone branch:**
- **DELETE**: gone, not protected, not in a worktree, not current
- **SKIP (worktree)**: gone but checked out in a worktree -- report worktree path
- **SKIP (protected)**: gone but in the protected list
- **SKIP (current)**: the currently checked-out branch

### Step 4: Report preview

Show categorized results with metadata for human/agent decision-making:

```
=== Branch Cleanup Preview ===

Safe to delete (merged, remote gone):
  1. feat/add-oauth      3d ago  "feat(auth): add OAuth2 login"
  2. fix/typo-readme      1w ago  "fix(docs): correct typo in README"

Skipped (worktree active):
  feat/api-v2  ->  /Users/nathan/.claude/worktrees/feat-api-v2

Skipped (protected):
  main, develop

Summary: 2 deletable, 1 worktree, 2 protected
```

If `--confirm` was NOT passed, stop here. A human can say "yes, do it" (skill responds to natural language) or re-run with `--confirm`. An agent runs once to preview, then with `--confirm` to execute.

### Step 5: Execute (only with --confirm or explicit user approval)

1. **Worktree branches first:** For gone branches that have worktrees:
   - `git worktree remove <path>` (without `--force`)
   - If removal fails (dirty worktree): report "Worktree at <path> has uncommitted changes. Skipping branch <name>." Do NOT use `--force`.

2. **Batch delete eligible branches:**
   ```bash
   git branch -d branch1 branch2 branch3
   ```
   Batch is safe -- if branch2 fails, branch1 and branch3 still delete.

3. **Handle `-d` failures (squash merge detection):**
   For branches where `-d` fails with "not fully merged" but upstream is `[gone]`:

   Run tree-comparison squash merge detection:
   ```bash
   MERGE_BASE=$(git merge-base main <branch>)
   DANGLING=$(git commit-tree <branch>^{tree} -p $MERGE_BASE -m _)
   git merge-base --is-ancestor $DANGLING main && echo "squash-merged"
   ```

   If squash-merge detected, report as advisory:
   ```
   Branch 'feat/dashboard' appears squash-merged into main
     (tree match detected, git considers it unmerged)
     Last commit: 5d ago - "feat(ui): dashboard components"
     To delete manually: git branch -D feat/dashboard
   ```
   Do NOT auto-delete with `-D`. Let the user decide.

4. **Summary:**
   ```
   Deleted 3 branches. Skipped 1 (worktree). 1 appears squash-merged (manual review needed).
   ```

### Safety
- Use `git branch -d` (not `-D`). If unmerged, report -- do NOT escalate to force delete.
- Never use `git worktree remove --force`. Dirty worktrees -> report and skip.
- Never delete the current branch or protected branches, even if marked [gone].
- If `git fetch --prune` fails (network), warn but proceed with cached state.
```

---

## Step 7: Update README

Add the two new commands to the README's "Slash Commands" list and "Usage Examples" section.

**Slash Commands list:**
```markdown
- `/git:commit-push-pr [description] [--draft] [--skip-validate]` - Commit, push, and create PR in one workflow
- `/git:clean-gone [--confirm]` - Delete local branches with deleted remote tracking
```

**Usage Examples:**

```markdown
### Commit and Create PR
` ` `
/git:commit-push-pr
/git:commit-push-pr add OAuth2 login
/git:commit-push-pr --draft
` ` `
Squashes WIP commits if any, validates, creates a conventional commit, pushes, and creates a PR. Detects existing PRs and updates them.

### Clean Merged Branches
` ` `
/git:clean-gone
/git:clean-gone --confirm
` ` `
Fetches, prunes, and shows local branches whose remote tracking branch is gone. Run without `--confirm` to preview, with `--confirm` to delete. Detects squash-merged branches that git considers "unmerged."
```

---

## Step 8: Validate + test

```bash
bun run validate && bun test plugins/git/
```

Both must pass. No new tests needed -- the commands are pure markdown files that delegate to the skill.

---

## Success Criteria

- [x] `commands/commit-push-pr.md` exists with one-liner body, tightened allowed-tools, and `[description] [--draft] [--skip-validate]` hint
- [x] `commands/clean-gone.md` exists with one-liner body, sonnet model, specific allowed-tools, and `[--confirm]` hint
- [x] plugin.json lists 12 commands (alphabetical order)
- [x] SKILL.md routing table has 2 new rows (with `git for-each-ref` in clean-gone key commands)
- [x] SessionStart routing table (git-context-loader.ts) has 2 new rows
- [x] workflows.md has Commit-Push-PR section with: pre-flight checks, WIP decision tree, validate gate, existing PR detection, step reporting, idempotent re-run
- [x] workflows.md has Clean-Gone section with: `for-each-ref` pipe-delimited format, worktree prune, protected branch config, categorized preview, batch deletion, squash merge detection, `--confirm` pattern
- [x] README has both new commands with full argument hints and usage examples
- [x] `bun run validate` passes
- [x] `bun test plugins/dx-git/` passes

---

## What's NOT in This Phase

| Deferred to Phase 5 | Reason |
|---------------------|--------|
| Reference content updates (dual-audience, anti-slop, etc.) | Content improvements, separate concern |
| Safety-net companion recommendation | Content update |
| `--json` structured output flag | Nice-to-have, not MVP |
| `--remote` flag for clean-gone | Multi-remote is a power-user edge case |
| `git merge-tree` conflict preview in pre-flight | Requires git 2.38+; add when we can verify version |

---

## Appendix: Research Sources

### Branch Cleanup
- [Cleaning up gone branches - You've Been Haacked](https://haacked.com/archive/2025/04/17/git-gone/) -- `for-each-ref` approach
- [git-trim (foriequal0)](https://github.com/foriequal0/git-trim) -- Squash merge detection via commit-tree
- [git-delete-squashed](https://github.com/not-an-aardvark/git-delete-squashed) -- Tree comparison approach (SO 56026209)
- [Cleaning up branches after squash merges](https://saveman71.com/2025/cleaning-up-local-branches-after-squash-merges) -- Antoine Bolvy's analysis
- [Git for-each-ref Documentation](https://git-scm.com/docs/git-for-each-ref) -- Official plumbing command docs

### Commit-Push-PR Chaining
- [gh pr create - CLI Manual](https://cli.github.com/manual/gh_pr_create) -- Official GitHub CLI docs
- [gh pr create should detect existing PRs - Discussion #5792](https://github.com/cli/cli/discussions/5792) -- Existing PR handling
- [Use git push origin HEAD - Nick Janetakis](https://nickjanetakis.com/blog/use-git-push-origin-head-to-quickly-push-the-checked-out-branch) -- Push pattern
- [Git Autosquash - GitButler](https://blog.gitbutler.com/git-autosquash) -- fixup!/squash! handling
- [Dealing with non-fast-forward errors - GitHub Docs](https://docs.github.com/en/get-started/using-git/dealing-with-non-fast-forward-errors) -- Push failure recovery

### Command Design and Agent-Native Patterns
- [Anthropic plugin-dev frontmatter reference](https://github.com/anthropics/claude-code/blob/main/plugins/plugin-dev/skills/command-development/references/frontmatter-reference.md) -- Official spec
- Skill-authoring skill references (local: plugins/cortex-engineering/skills/skill-authoring/) -- Best practices, argument hints, common patterns
- [The Hidden Users: Designing CLI Tools for AI Agents](https://www.nibzard.com/ai-native) -- Agent-native CLI design
- [Writing CLI Tools That AI Agents Actually Want to Use](https://dev.to/uenyioha/writing-cli-tools-that-ai-agents-actually-want-to-use-39no) -- Idempotency, structured output
- [Command Line Interface Guidelines](https://clig.dev/) -- Flag conventions, confirmation patterns
- [Terraform plan/apply](https://developer.hashicorp.com/terraform/cli/commands/apply) -- Preview-then-execute pattern
- [kubectl dry-run](https://nunoadrego.com/posts/kubectl-dry-run/) -- Dry-run levels
- [Azure CLI --force vs --yes](https://github.com/Azure/azure-cli/issues/1911) -- Flag naming debate
