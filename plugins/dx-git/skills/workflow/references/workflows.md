# Git Workflows

Step-by-step procedures for common git operations.

## Commit (Conventional Commits)

0. **Check branch**: `git branch --show-current` -- if on `main` or `master`, create a feature branch first:
   - `git checkout -b <type>/<description>` (e.g., `feat/add-auth`, `fix/null-response`)
   - Then proceed with the commit workflow below
1. **Check status**: `git status --porcelain -b`
2. **Review changes**: `git diff --staged` (if staged) or `git diff` (if unstaged)
3. **Stage if needed**: `git add <specific-files>` — never blind `git add .` or `git add -A`
4. **Review recent commits** for style consistency: `git log --oneline -5`
5. **Compose message** following [conventions.md](conventions.md)
6. **Commit** using HEREDOC format:
   ```bash
   git commit -m "$(cat <<'EOF'
   <type>(<scope>): <subject>

   [optional body]

   Generated with [Claude Code](https://claude.ai/code)

   Co-Authored-By: Claude <noreply@anthropic.com>
   EOF
   )"
   ```
7. **Handle hook failures**: If pre-commit modifies files, stage and create a NEW commit (never amend unless explicitly asked)
8. **Split large changes**: When a commit spans multiple concerns, split into atomic commits ordered so each builds on the previous -- reviewers should be able to follow the progression without jumping between commits

## Squash

Combine multiple WIP commits into one clean conventional commit.

1. **Verify on feature branch**: `git branch --show-current` — abort if `main`
2. **Find merge base**: `git merge-base main HEAD`
3. **Review commits**: `git log --oneline $(git merge-base main HEAD)..HEAD`
4. **Review total diff**: `git diff $(git merge-base main HEAD)..HEAD --stat`
5. **Soft reset**: `git reset --soft $(git merge-base main HEAD)`
6. **Create single conventional commit** — follow the Commit workflow above
7. **Verify**: `git log --oneline -3` to confirm clean history

**Safety**: Never squash on `main`. Always verify branch first.

## Checkpoint

Quick WIP save — no ceremony.

1. **Stage tracked changes**: `git add -u`
2. **Commit with no-verify**: `git commit --no-verify -m "chore(wip): checkpoint"`
   - Or with description: `git commit --no-verify -m "chore(wip): checkpoint - <description>"`

**Note**: `--no-verify` is acceptable for WIP checkpoints only. Never for final commits.

**Branch restriction**: Checkpoints are blocked on `main`/`master`. Create a feature branch first.

## PR (Pull Request)

1. **Ensure all changes committed**: `git status --porcelain -b`
2. **Check current branch**: `git branch --show-current`
3. **Review all commits**: `git log --oneline main..HEAD`
4. **Squash WIP commits**: If any commits match `WIP:` or `wip:`, run the Squash workflow first — PRs should have clean conventional commits, not WIP history
5. **Review total diff**: `git diff main...HEAD --stat`
6. **Push**: `git push -u origin $(git branch --show-current)`
7. **Create PR**:
   ```bash
   gh pr create --title "<type>(<scope>): <subject>" --body "$(cat <<'EOF'
   ## Summary

   <1-3 bullet points>

   ## Test Plan

   - [ ] <Testing checklist>
   EOF
   )"
   ```
8. **Return the PR URL** to the user

## Session Log

Show what happened during this session.

1. **Recent commits**: `git log --oneline --since="1 hour ago"`
2. **Current status**: `git status --porcelain -b`
3. **Diff summary**: `git diff --stat HEAD~5..HEAD` (adjust range as needed)
4. **Present** as a clear summary with commits, changes, and uncommitted work

## Review PR

Review a GitHub pull request with inline comments.

1. **Parse PR identifier**: Extract owner/repo/number from argument (number or URL)
2. **Fetch PR metadata**: `gh pr view <PR> --json title,body,author,state,baseRefName,headRefName,url,additions,deletions`
3. **Skip if not reviewable**: Abort if state is closed, merged, or draft — inform user
4. **Fetch annotated diff**: `gh pr diff <PR>` — pipe through awk to add line number annotations for accurate inline comment placement
5. **Fetch existing comments**: `gh api repos/{owner}/{repo}/pulls/{number}/comments` and `gh api repos/{owner}/{repo}/issues/{number}/comments` — avoid duplicating feedback
6. **Review the diff** — focus on:
   - Bugs and logic errors
   - Missing error handling
   - API contract changes
   - Test coverage gaps
   - Naming inconsistencies
   - Security concerns
7. **Present findings** to user with `file:line` references — ask for approval before posting. When `$ARGUMENTS` contains `--submit`, skip the approval gate and post immediately.
8. **On approval** (or `--submit`), create batched pending review: `gh api repos/{owner}/{repo}/pulls/{number}/reviews -X POST` with all comments in a single review
9. **Submit review** with appropriate event: `APPROVE`, `REQUEST_CHANGES`, or `COMMENT`

**Key rules:**
- Draft -> Show -> Approve -> Post (default flow; `--submit` bypasses the approval gate)
- Batch all comments into one review (no scattered notifications)
- Include `file:line` references for every finding

## Changelog

Generate a changelog from conventional commits.

1. **Find last tag**: `git describe --tags --abbrev=0 2>/dev/null` (use all commits if no tags exist)
2. **Get commits since tag**: `git log <tag>..HEAD --oneline --no-merges`
3. **Parse conventional commit types** from subjects (feat, fix, refactor, etc.)
4. **Group into Keep a Changelog sections**:
   - `feat` → **Added**
   - `fix` → **Fixed**
   - `refactor`, `perf` → **Changed**
   - `revert` → **Removed**
   - `docs`, `style`, `test`, `build`, `ci`, `chore` → **Other** (or omit if minor)
5. **Determine version**: If `[version]` argument provided, use it; otherwise suggest next version based on commit types:
   - Any `BREAKING CHANGE` → major bump
   - Any `feat` → minor bump
   - Only `fix`/other → patch bump
6. **Format as Keep a Changelog**:
   ```markdown
   ## [version] - YYYY-MM-DD

   ### Added
   - Description (commit-hash)

   ### Fixed
   - Description (commit-hash)
   ```
7. **Present to user** for approval. When `$ARGUMENTS` contains `--write`, skip the approval step and write directly.
8. **On approval** (or `--write`), prepend to CHANGELOG.md (create if missing)
9. **Optionally stage** the file: `git add CHANGELOG.md`

## Compare

Compare current branch against another branch with AI summary.

1. **Determine branches**: Current branch vs `[branch]` argument (default: `main`)
2. **Find merge-base**: `git merge-base <base> HEAD`
3. **Show commit summary**: `git log --oneline <base>..HEAD`
4. **Show file impact**: `git diff <base>...HEAD --stat`
5. **Show detailed diff** for most-changed files: `git diff <base>...HEAD` (filter to top files by change magnitude)
6. **Present AI summary**:
   - What changed (high-level intent across all commits)
   - Files affected with change magnitude
   - Any potential conflicts or risks
   - Ready to merge? (clean diff, tests referenced, etc.)

## Commit-Push-PR

Orchestrates squash + commit + push + PR in one flow. Each step uses the same procedure as the corresponding standalone command.

### Parse arguments
- `--draft`: create PR as draft
- `--skip-validate`: skip the validation gate
- Remaining text: use as commit description hint

### Phase 0: Detect default branch

Determine the base branch once, use throughout. 4-tier fallback chain ordered by reliability:

```bash
# Tier 1: gh CLI (authoritative, requires auth + network)
DEFAULT_BRANCH=$(gh repo view --json defaultBranchRef --jq '.defaultBranchRef.name' 2>/dev/null) || \
  # Tier 2: git symbolic-ref (fast, local, fails if origin/HEAD not set)
  DEFAULT_BRANCH=$(git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null)
[ -n "$DEFAULT_BRANCH" ] && DEFAULT_BRANCH="${DEFAULT_BRANCH#refs/remotes/origin/}"
# Tier 3: git config (user-configured default)
[ -n "$DEFAULT_BRANCH" ] || DEFAULT_BRANCH=$(git config --get init.defaultBranch 2>/dev/null)
# Tier 4: hardcoded fallback
[ -n "$DEFAULT_BRANCH" ] || DEFAULT_BRANCH="main"
```

Note: Git 2.48+ auto-updates `refs/remotes/origin/HEAD` on fetch, making Tier 2 more reliable on modern git.

### Phase 1: Pre-flight (fail fast, before any mutations)

Run checks in parallel groups where possible (network latency is the bottleneck):

**Group A (local, ~50ms total) -- run in parallel:**
1. **Branch check**: `git symbolic-ref --short HEAD` -- must be on a feature branch (not main/master). If HEAD is detached, abort.
2. **Working tree check**: `git status --porcelain -b` -- verify there are changes to commit OR existing unpushed commits.
3. **Remote check**: `git remote get-url origin` -- verify remote exists.

**Group B (network, ~500-2000ms) -- run in parallel after Group A passes:**
4. **Auth check**: `gh auth status` -- must be authenticated. If not, report: "Run `gh auth login` to authenticate."
5. **Fetch base**: `git fetch origin $DEFAULT_BRANCH` -- update local view of default branch for divergence check. If fetch fails (network), warn but continue.

**Sequential after Group B:**
6. **Divergence check**: `git rev-list --left-right --count origin/$DEFAULT_BRANCH...HEAD` -- report commits ahead/behind.
7. **Idempotent no-op check**: If working tree is clean AND ahead=0, then check for existing PR:
   - `gh pr list --head "$(git branch --show-current)" --state open --json url --jq '.[0].url'`
   - If PR exists: report "Nothing to commit or push. Existing PR: <url>" and exit.
   - If no PR: report "Nothing to commit or push. No PR found for this branch." and exit.

### Phase 2: Squash WIP (conditional)

Classify commits between merge-base and HEAD:

```bash
git log --oneline $(git merge-base origin/$DEFAULT_BRANCH HEAD)..HEAD
```

| Commit pattern | Classification |
|----------------|---------------|
| `chore(wip):` or `wip:` (case-insensitive) | WIP |
| `fixup! <target>` or `squash! <target>` | WIP (treated as squashable) |
| Everything else | GOOD |

**Decision tree:**
- **All WIP, zero GOOD**: `git reset --soft $(git merge-base origin/$DEFAULT_BRANCH HEAD)`, then proceed to commit (generates fresh message from diff)
- **All GOOD, zero WIP**: skip squash entirely
- **Mixed WIP + GOOD**: present the commit list with WIP marked, ask user:
  1. Squash ALL into one commit (simpler, loses atomic boundaries)
  2. Skip squash, push as-is (keep all commits)
  3. Abort

  If no interactive response is available (headless/sub-agent), default to option 2 (skip squash) -- least destructive, preserves all commits.

> Note: `fixup!`/`squash!` commits are treated as WIP rather than using `git rebase --autosquash`. Adding `Bash(git rebase:*)` to allowed-tools would broaden permissions beyond the principle of least privilege. Autosquash support deferred to future enhancement.

### Phase 3: Commit (if uncommitted changes exist)

Run the full Commit workflow above (branch check, staging, conventional commit).

**Commit message generation priority:**
1. User's `[description]` argument -> use as subject, infer type/scope from diff
2. No description -> generate entirely from diff (`git diff --stat` + `git diff`)
3. WIP messages are discarded unless they contain meaningful descriptions

**Confirmation gate:** If `[description]` argument was provided, skip the confirmation gate and commit directly (user already expressed intent). If no description, confirm the generated message with the user before committing. Use plain text prompts (not AskUserQuestion) for agent compatibility.

### Phase 4: Validate (unless --skip-validate)

Run validate:

```bash
bun run validate
```

If command output indicates no validate script exists (for example, script not found), report "No validate script found -- skipping validation gate." and proceed to push.

**Why after commit, before push:** the commit preserves work as a local rollback point. The push is the quality gate for "code leaving your machine."

If validation fails:
1. Fix issues and retry (abort the push, let user fix)
2. Push anyway (user accepts broken state)
3. Abort entirely

If no interactive response is available (headless/sub-agent), default to option 3 (abort) -- headless agents should never silently push broken code.

### Phase 5: Push

```bash
git push -u origin HEAD
```

Use `HEAD` not `$(git branch --show-current)` -- simpler, no subshell.

**Failure handling:**
- Non-fast-forward: "Remote has N commits you don't have. Resolve manually: 1) `git pull --rebase` 2) `git pull` (merge) 3) Abort." These are instructions for the user -- the command cannot perform rebase/merge (not in allowed-tools). If no interactive response is available (headless/sub-agent), default to abort.
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

## Clean-Gone

Delete local branches whose remote tracking branch has been deleted (after PR merge).

Default mode shows what would be deleted. Pass `--confirm` to execute (shows preview then immediately deletes). Without `--confirm`, shows preview and stops.

### Step 1: Gather state (all commands upfront, before any mutations)

Run in 3 sequential rounds (dependency chain, not flat parallel):

```bash
# Round 1 (parallel): network fetch + current branch detection
git fetch --prune origin 2>/dev/null || echo "Warning: fetch failed, using cached state"
git symbolic-ref --short HEAD 2>/dev/null  # can run concurrently with fetch

# Round 2 (sequential, depends on fetch): clean orphaned worktree metadata
git worktree prune  # MUST run after fetch (needs updated tracking refs)

# Round 3 (parallel, depends on prune): enumerate state
git worktree list --porcelain  # must run after prune (avoids stale entries)
git for-each-ref --format='%(refname:short)%00%(objectname:short)%00%(creatordate:relative)%00%(upstream:track)%00%(subject)%00' -- refs/heads/  # NUL-delimited to avoid delimiter collisions in subjects
```

**Format string notes:**
- Use NUL (`%00`) as field delimiter -- safe even when commit subjects contain `|` or other punctuation
- `%(upstream:track)` produces `[gone]` for deleted upstreams, empty string for branches with no upstream (distinct cases)
- `%(upstream:trackshort)` does NOT detect `[gone]` -- must use `%(upstream:track)`
- `%(creatordate:relative)` gives "3 days ago" style dates for the preview report

### Step 2: Determine protected branches

Priority order:
1. Git config: `git config --get-all cleanup.protectedBranch` (user-configured per-repo or global)
2. Auto-detect default branch: `git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null` then trim prefix `refs/remotes/origin/` (falls back to `git config --get init.defaultBranch`, then "main")
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

If zero branches are deletable, report "Nothing to clean up -- no branches with gone remotes found." and exit.

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

   Detect default branch (same as Step 2's auto-detect), then run tree-comparison squash merge detection:
   ```bash
   MERGE_BASE=$(git merge-base $DEFAULT_BRANCH <branch>)
   DANGLING=$(git commit-tree <branch>^{tree} -p $MERGE_BASE -m _)
   git merge-base --is-ancestor $DANGLING $DEFAULT_BRANCH && echo "squash-merged"
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
