---
description: Create pull requests using GitHub CLI with Conventional Commits format
model: claude-sonnet-4-5-20250929
allowed-tools: Bash(git push:*), Bash(gh pr:*), mcp__git_git-intelligence__get_recent_commits, mcp__git_git-intelligence__get_diff_summary
---

# Create Pull Request

Create well-formatted pull requests using GitHub CLI with Conventional Commits specification.

## Prerequisites

Check if `gh` is installed and authenticated:
```bash
gh auth status
```

If not installed:
```bash
brew install gh
gh auth login
```

## Workflow

### 1. Gather Context

Use MCP tools for efficient data gathering:

- **Status** - Use `get_status` MCP tool
- **Recent commits** - Use `get_recent_commits` MCP tool
- **Diff summary** - Use `get_diff_summary` MCP tool

For branch info and comparison, use Bash:
```bash
# Check current branch
git branch --show-current

# Check if we need to push
git log --oneline @{u}..HEAD 2>/dev/null || echo "No upstream"

# All commits on this branch vs main
git log --oneline main..HEAD
```

### 2. Analyze Changes

Review all commits that will be in the PR (not just the latest):
```bash
git diff main...HEAD --stat
```

### 3. Determine PR Title

Use Conventional Commits format matching the primary change type:

| Type | Example |
|------|---------|
| feat | `feat(auth): add OAuth2 login support` |
| fix | `fix(api): handle null response` |
| docs | `docs(readme): update installation guide` |
| style | `style(ui): improve button styling` |
| refactor | `refactor(core): simplify data flow` |
| perf | `perf(queries): optimize database calls` |
| test | `test(auth): add login integration tests` |
| build | `build(deps): upgrade to Node 20` |
| ci | `ci(actions): add deployment workflow` |
| chore | `chore(deps): update dependencies` |

### 4. Create the PR

```bash
# Push branch if needed
git push -u origin HEAD

# Create PR with HEREDOC for body
gh pr create --title "<type>(<scope>): <subject>" --body "$(cat <<'EOF'
## Summary

<1-3 bullet points describing what this PR does>

## Changes

<Brief description of the changes made>

## Test Plan

- [ ] <Testing checklist item>
- [ ] <Another testing item>

---

Generated with [Claude Code](https://claude.ai/code)
EOF
)"
```

### 5. Draft vs Ready

- Use `--draft` flag if work is in progress
- Convert to ready: `gh pr ready`

## PR Body Template

```markdown
## Summary

- <Primary change/feature>
- <Secondary change if applicable>

## Changes

<Describe what changed and why>

## Test Plan

- [ ] Unit tests pass
- [ ] Manual testing completed
- [ ] No regressions

---

Generated with [Claude Code](https://claude.ai/code)
```

## Useful Commands

```bash
# List your open PRs
gh pr list --author "@me"

# Check PR status
gh pr status

# View specific PR
gh pr view <PR-NUMBER>

# Add reviewers
gh pr edit <PR-NUMBER> --add-reviewer username

# Merge PR (squash)
gh pr merge <PR-NUMBER> --squash
```

## Important Notes

- NEVER force push to main/master
- Always analyze ALL commits in the branch, not just the latest
- If there's a PR template at `.github/pull_request_template.md`, use it
- Return the PR URL when done so user can access it

Now analyze the current branch and create an appropriate PR.
