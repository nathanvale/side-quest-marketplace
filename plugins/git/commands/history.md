# Git History Explorer

Interactively explore git commit history using the git-intelligence MCP tools.

## Instructions

Help the user explore git history to understand past changes. Use the MCP tools for efficient queries.

### Available MCP Tools

Based on the user's request, use the appropriate tool:

1. **Recent commits** → Use `get_recent_commits` tool
   - Default: 10 commits, adjust `limit` as needed

2. **Search by message** → Use `search_commits` tool
   - Set `query` to the search term
   - Set `search_code: false` (default)

3. **Search by code change** → Use `search_commits` tool
   - Set `query` to the code snippet
   - Set `search_code: true` (like git log -S)

4. **Current status** → Use `get_status` tool
   - Shows branch, staged/modified/untracked files

### Fallback to Bash

For queries not covered by MCP tools, use Bash:

- **File history**: `git log --oneline -10 -- <filepath>`
- **Branch info**: `git branch -a`
- **Show specific commit**: `git show <commit-hash> --stat`
- **Compare branches**: `git log --oneline main..HEAD`
- **Who changed what**: `git blame <filepath>`
- **Time-based queries**: `git log --oneline --since="last week"`

### Arguments

Parse the user's query to determine intent:
- `/git:history` → Use `get_recent_commits`
- `/git:history auth` → Use `search_commits` with query "auth"
- `/git:history src/api.ts` → Use Bash: `git log --oneline -10 -- src/api.ts`
- `/git:history -S function` → Use `search_commits` with search_code: true
- `/git:history last week` → Use Bash: `git log --oneline --since="last week"`

### Output

Present results clearly with:
- Commit hash (short)
- Subject line
- Author and relative time
- Optionally show diff for specific commits

Now explore the history based on the query: $ARGUMENTS
