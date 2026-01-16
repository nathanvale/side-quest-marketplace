---
description: Create git worktree with dedicated tmux session
---

# Git Worktree Wizard

Create a new git worktree with a dedicated tmux session for parallel branch development.

## Your Role

Help the user create a worktree with intelligent branch naming.

## Flow

1. **Gather context**: Ask the user to describe what they're working on (feature, bug fix, refactor, Jira ticket, etc.)

2. **Suggest branch name** following conventions:
   - Jira tickets: `feat/PROJ-123-short-description`
   - Features: `feat/short-description`
   - Bug fixes: `fix/short-description`
   - Refactors: `refactor/short-description`
   - Use kebab-case, max 50 chars total

3. **Confirm** the suggested name with the user (they can modify it)

4. **Execute** the worktree script:
   ```bash
   ~/code/dotfiles/bin/tmux/worktree-ai.sh <branch-name>
   ```

5. **Report success** with:
   - Worktree path (`.worktrees/<branch>/`)
   - Session name (`<repo>-wt-<branch>`)
   - How to switch back: `Ctrl-g t` to open tx picker

## Branch Name Examples

| User Description | Suggested Branch |
|------------------|------------------|
| "Adding OAuth login for PAICC-456" | `feat/PAICC-456-oauth-login` |
| "Fix the checkout bug" | `fix/checkout-bug` |
| "Refactor the auth module" | `refactor/auth-module` |
| "GMAAPP-789 add dark mode" | `feat/GMAAPP-789-dark-mode` |

## Important Notes

- The script creates worktrees in `.worktrees/` (globally git-ignored)
- Each worktree gets a full tmux session with the standard template (4 Claude panes)
- Session naming: `<repo>-wt-<branch>` for easy filtering
- Works from inside or outside tmux
