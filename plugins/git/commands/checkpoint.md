---
description: Create a quick WIP checkpoint commit to save your current work
---

# Quick Checkpoint Commit

Create a quick WIP checkpoint commit to save your current work.

## Instructions

Create a quick checkpoint commit to save work-in-progress. This is useful for:
- Saving state before risky operations
- Creating restore points during development
- Quick saves when switching context

### Workflow

1. **Check current status** - Use `get_status` MCP tool
   - Quickly see staged, modified, and untracked files
   - Check for any files that shouldn't be committed (secrets, etc.)

2. **Stage all changes** (unless there are files with secrets):
   ```bash
   git add -A
   ```

3. **Create checkpoint commit**:
   ```bash
   git commit -m "$(cat <<'EOF'
   chore(wip): checkpoint - <brief description>

   Generated with [Claude Code](https://claude.ai/code)

   Co-Authored-By: Claude <noreply@anthropic.com>
   EOF
   )"
   ```

### Notes

- Checkpoints can be squashed later with `git rebase -i`
- The description should be brief (e.g., "before refactor", "auth working", "halfway done")
- Skip files that shouldn't be committed (secrets, large binaries)

### Arguments

If the user provides a description after the command, use it:
- `/git:checkpoint before api changes` -> `chore(wip): checkpoint - before api changes`
- `/git:checkpoint` -> Ask for a brief description or use current context

Now create a checkpoint commit.
