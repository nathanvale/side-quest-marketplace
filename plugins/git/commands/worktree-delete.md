---
description: Delete git worktree and associated tmux session
---

# Git Worktree Delete

Delete a git worktree with smart cleanup of associated resources.

## Your Role

Help the user safely delete a worktree, handling edge cases gracefully.

## Flow

1. **If no argument provided**: Ask user which worktree to delete (list available ones)

2. **Show what will be deleted**:
   - Worktree path
   - Tmux session (if exists)
   - Branch status (merged/unmerged)

3. **Check for issues**:
   - Uncommitted changes → warn and ask to force
   - Active session → warn they'll be switched out
   - Unmerged branch → extra confirmation if deleting branch

4. **Execute deletion**:
   ```bash
   ~/code/dotfiles/bin/tmux/worktree-delete.sh <branch-name>
   ```

5. **Or run interactively** (no args):
   ```bash
   ~/code/dotfiles/bin/tmux/worktree-delete.sh
   ```

## What Gets Cleaned Up

| Resource | Action |
|----------|--------|
| Worktree directory | `git worktree remove` |
| Tmux session | `tmux kill-session` |
| Git branch | Optional (ask user) |

## Safety Checks

- **Uncommitted changes**: Requires force confirmation
- **Unmerged branch**: Extra warning before branch deletion
- **Active session**: Switches to main session first

## Examples

User: "Delete the feat-auth worktree"
→ Run: `~/code/dotfiles/bin/tmux/worktree-delete.sh feat-auth`

User: "Clean up my worktrees"
→ Run interactive: `~/code/dotfiles/bin/tmux/worktree-delete.sh`
→ Show the fzf picker
