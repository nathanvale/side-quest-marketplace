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
