---
description: Show git activity during this Claude session
model: haiku
allowed-tools: mcp__plugin_git_git-intelligence__get_recent_commits, mcp__plugin_git_git-intelligence__get_diff_summary
---

# Session Activity Log

Show what git activity has happened during this session using the git-intelligence MCP tools.

## Instructions

Display a summary of git activity during the current Claude session, including:
- Commits made
- Files changed
- Current uncommitted work

### Workflow

1. **Get recent commits** → Use `get_recent_commits` tool with `limit: 10`
   - Shows commits with hash, message, author, and relative time

2. **Get current status** → Use `get_status` tool
   - Returns branch, staged/modified/untracked counts, and file lists

3. **Get diff summary** → Use `get_diff_summary` tool
   - Returns files changed with lines added/deleted

4. **Check for session summary file** (Bash fallback):
   ```bash
   cat .claude-session-summary 2>/dev/null || echo "No session summary found"
   ```

### Output Format

Present the information in a clear summary:

```
## Session Activity

### Commits Made (recent)
- abc1234 feat(auth): add login endpoint (5 minutes ago)
- def5678 fix(api): handle null case (20 minutes ago)

### Current Changes
Staged: 2 files (+45, -12)
Modified: 3 files
Untracked: 1 file

### Uncommitted Files
 M src/auth.ts
 M src/api.ts
?? src/new-file.ts
```

Now show the session activity.
