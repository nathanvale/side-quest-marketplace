# Git Workflows

Step-by-step procedures for common git operations.

## Commit (Conventional Commits)

1. **Check status**: `git status --porcelain -b`
2. **Review changes**: `git diff --staged` (if staged) or `git diff` (if unstaged)
3. **Stage if needed**: `git add <specific-files>` — never blind `git add .` or `git add -A`
4. **Review recent commits** for style consistency: `git log --oneline -5`
5. **Compose message** following [CONVENTIONS.md](CONVENTIONS.md) and [EXAMPLES.md](EXAMPLES.md)
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
2. **Commit with no-verify**: `git commit --no-verify -m "wip: checkpoint"`
   - Or with description: `git commit --no-verify -m "wip: checkpoint - <description>"`

**Note**: `--no-verify` is acceptable for WIP checkpoints only. Never for final commits.

## PR (Pull Request)

1. **Ensure all changes committed**: `git status --porcelain -b`
2. **Check current branch**: `git branch --show-current`
3. **Review all commits**: `git log --oneline main..HEAD`
4. **Review total diff**: `git diff main...HEAD --stat`
5. **Push**: `git push -u origin $(git branch --show-current)`
6. **Create PR**:
   ```bash
   gh pr create --title "<type>(<scope>): <subject>" --body "$(cat <<'EOF'
   ## Summary

   <1-3 bullet points>

   ## Test Plan

   - [ ] <Testing checklist>
   EOF
   )"
   ```
7. **Return the PR URL** to the user

## Session Log

Show what happened during this session.

1. **Recent commits**: `git log --oneline --since="1 hour ago"`
2. **Current status**: `git status --porcelain -b`
3. **Diff summary**: `git diff --stat HEAD~5..HEAD` (adjust range as needed)
4. **Present** as a clear summary with commits, changes, and uncommitted work
