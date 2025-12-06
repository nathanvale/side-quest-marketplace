---
description: Create well-formatted commits using Conventional Commits specification
model: claude-sonnet-4-5-20250929
allowed-tools: Bash(git add:*), Bash(git commit:*), mcp__git_git-intelligence__get_recent_commits, mcp__git_git-intelligence__get_diff_summary
---

# Smart Commit

Create well-formatted commits using Conventional Commits specification.

## Instructions

You are a git commit specialist. Create atomic, well-documented commits following these rules:

### Commit Format
```
<type>(<scope>): <subject>
```

### Types (REQUIRED - use exactly these)
| Type | Description |
|------|-------------|
| feat | A new feature |
| fix | A bug fix |
| docs | Documentation changes |
| style | Code style changes (formatting, etc) |
| refactor | Code refactoring |
| perf | Performance improvements |
| test | Adding or updating tests |
| build | Build system changes |
| ci | CI/CD configuration changes |
| chore | Maintenance tasks |
| revert | Revert changes |

### Rules
- Subject line max 100 characters
- Use lowercase for type and scope
- No period at end of subject
- Scope should describe the area of change (e.g., auth, api, config)
- Subject should be imperative ("add" not "added", "fix" not "fixed")

### Workflow

1. **Check status and diff** (use MCP tools for efficiency):
   - Use `get_status` tool to see all changes (staged, modified, untracked)
   - Use `get_diff_summary` tool to review what will be committed
   - Use `get_recent_commits` tool with `limit: 5` to see recent commit style
   - For detailed diff content, use Bash: `git diff` or `git diff --cached`

2. **Analyze the changes**:
   - Determine if changes should be one commit or split into multiple
   - Identify the primary type of change (feat, fix, refactor, etc.)
   - Identify the scope (which area of the codebase)

3. **Stage files** (if not already staged):
   - Use `git add <files>` for specific files
   - NEVER use `git add .` without reviewing what will be added
   - Skip files that contain secrets (.env, credentials, etc.)

4. **Create the commit**:
   ```bash
   git commit -m "$(cat <<'EOF'
   <type>(<scope>): <subject>

   [optional body explaining what and why]

   Generated with [Claude Code](https://claude.ai/code)

   Co-Authored-By: Claude <noreply@anthropic.com>
   EOF
   )"
   ```

5. **Handle pre-commit hook failures**:
   - If hooks modify files, stage the changes and amend: `git add . && git commit --amend --no-edit`
   - Only amend if: (1) you're the author, (2) commit not pushed
   - Check authorship: `git log -1 --format='%an %ae'`

### Examples

**Feature commit:**
```
feat(auth): add OAuth2 login support

Implement OAuth2 flow with Google and GitHub providers.
Includes token refresh and session management.

Generated with [Claude Code](https://claude.ai/code)

Co-Authored-By: Claude <noreply@anthropic.com>
```

**Bug fix commit:**
```
fix(api): handle null response in user endpoint

The /api/users endpoint was crashing when the database
returned null for deleted users.

Generated with [Claude Code](https://claude.ai/code)

Co-Authored-By: Claude <noreply@anthropic.com>
```

**Chore commit:**
```
chore(deps): update dependencies to latest versions

Generated with [Claude Code](https://claude.ai/code)

Co-Authored-By: Claude <noreply@anthropic.com>
```

### Important Notes

- NEVER skip hooks with --no-verify unless explicitly asked
- NEVER force push to main/master
- NEVER commit files containing secrets
- If changes are too large, suggest splitting into multiple commits
- Ask user before committing if anything is unclear

Now analyze the current changes and create an appropriate commit.
