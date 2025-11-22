---
description: Merge a PR and clean up worktree and branches
tags: [task-management, git, cleanup, workflow]
---

# Merge PR Command

Merges a completed PR to main branch and performs complete cleanup (worktree, branches, locks).

Use this after `/next` has created a PR and it's been reviewed/approved.

## Your Responsibilities

**Step 1: Ask merge strategy**

Use the AskUserQuestion tool to ask:

**Question:** "How would you like to merge?" **Options:**

1. **Manual Merge** - Merge current branch directly into main (no PR)
   - Description: "Merge your changes directly to main branch, then clean up worktree and branch
     locally. No pull request created."
2. **Create/Merge PR** - Use the standard PR workflow
   - Description: "Create or merge a pull request through GitHub/Azure DevOps with proper review
     workflow."

**Step 2: Execute based on choice**

### If user chose "Manual Merge":

**Step 2a: Detect and confirm branch**

First, detect the current branch and worktree:

```bash
CURRENT_BRANCH=$(git branch --show-current)
WORKTREE_PATH=$(git worktree list --porcelain | grep "^worktree" | grep -v "$(git rev-parse --show-toplevel)$" | awk '{print $2}' | head -1)
```

Then use AskUserQuestion to confirm or allow manual entry:

**Question:** "Confirm branch to merge and delete?" **Options:**

1. **Use Current Branch** - `$CURRENT_BRANCH`
   - Description: "Merge and delete the current branch: $CURRENT_BRANCH"
   - If worktree exists: "Worktree: $WORKTREE_PATH will also be removed"
2. **Enter Branch Manually** - Custom branch name
   - Description: "Specify a different branch name to merge and delete"

**Step 2b: Run manual merge script**

Based on user's choice:

```bash
# If "Use Current Branch":
taskdock merge manual

# If "Enter Branch Manually":
taskdock merge manual <branch-name>
```

The script will:

1. Detect current branch and worktree (or use provided branch)
2. Ask for final confirmation
3. Update main branch
4. Merge specified branch into main (--no-ff)
5. Push to origin/main
6. Delete remote branch
7. Remove worktree (if exists)
8. Delete local branch
9. Clean up lock file
10. Display summary

### If user chose "Create/Merge PR":

Parse user input and execute the merge script:

1. **Determine the argument:**
   - If user provides a number (e.g., `/merge 123`) → Use that as the argument
   - If user provides a task ID (e.g., `/merge T0030` or `/merge MPCU-0005`) → Use that as the
     argument
   - If user provides no argument (e.g., `/merge`) → Use `--current` flag

2. **Run the command:**

   ```bash
   taskdock merge pr <argument>
   ```

3. **Display the output:** TaskDock provides comprehensive colored output showing each step of the
   merge process. Simply relay the output to the user.

**TaskDock automatically handles:**

1. Git remote type detection (GitHub/Azure DevOps)
2. PR and branch identification
3. PR status verification
4. Merging to main branch
5. Branch deletion (remote and local)
6. Worktree removal
7. Lock file cleanup
8. Summary display

---

## Usage Examples

### Example 1: Merge by PR Number

```bash
User: "/merge 123"
You: Run taskdock merge pr 123
```

### Example 2: Merge Current Worktree

```bash
User: "/merge"
# User is currently in a worktree
You: Run taskdock merge pr --current
```

### Example 3: Merge by Task ID

```bash
User: "/merge T0030"
You: Run taskdock merge pr T0030
```

### Example 4: Merge by Task ID (monorepo format)

```bash
User: "/merge MPCU-0005"
You: Run taskdock merge pr MPCU-0005
```

---

## Script Arguments

The script auto-detects the argument type:

- **Numeric** (e.g., `123`) → Treated as PR number
- **Task ID** (e.g., `T0030`, `MPCU-0005`) → Searches for matching branch
- **`--current`** → Uses current worktree's branch
- **No argument** → Defaults to `--current` mode

---

## Performance Optimization

The script is optimized for speed:

- **Batched API calls**: Single `gh pr view` call fetches all PR data (state, mergeable, title,
  etc.)
- **Batched JSON parsing**: Single `jq` invocation processes multiple fields
- **Reduced network round trips**: 2 GitHub API calls instead of 4-5
- **Expected performance**: ~1.1 seconds (40-50% faster than inline approach)

---

## Integration with /next Command

**Complete workflow:**

```bash
# Start task
/next
  → Creates worktree: .worktrees/T0030
  → Creates branch: feat/T0030-add-retry-logic
  → Locks task atomically
  → Implements changes
  → Creates PR #123

# Review PR (manual)
# Make any needed changes in worktree
# Push updates

# Merge when ready
/merge 123
  → Runs taskdock merge pr 123
  → Merges PR #123 to main
  → Deletes branch (remote + local)
  → Removes worktree
  → Cleans up lock file
  → Returns to main
  → Shows summary

# Repeat
/next
  → Starts next task
```

---

## Error Handling

The script handles all error scenarios:

- **PR not found** → Lists available open PRs
- **Merge conflicts** → Shows resolution instructions
- **PR not approved** → Displays review status
- **Branch not found** → Reports missing branch for task ID
- **Already merged** → Gracefully handles already-merged PRs
- **Network failures** → Exits cleanly without partial cleanup

All operations are **atomic** - the script either completes fully or exits cleanly without partial
state.

---

## Script Location

**Source:** `taskdock merge pr` command

The script supports:

- GitHub (via `gh` CLI)
- Azure DevOps (via `az` CLI)
- Automatic git provider detection
- Both single repos and monorepos
- Task ID formats: `T####`, `TASK-####`, `MPCU-####`, etc.

---

## Notes

- **Consolidated workflow**: All merge logic in single script (easier to test/maintain)
- **Network-optimized**: Batched API calls reduce latency by 40-50%
- **Safe cleanup**: Uses `--force` for worktree removal (safe because PR is merged)
- **Lock cleanup**: Automatically removes task locks (prevents stale locks)
- **Idempotent**: Can run multiple times safely
- **Cross-platform**: Works with both GitHub and Azure DevOps

---

## Why This Approach Works

1. **Single source of truth**: All logic in one script, not scattered across command
2. **Performance**: Optimized for minimal network round trips
3. **Maintainability**: Easy to test and update in isolation
4. **Flexibility**: Supports multiple input methods (PR number, task ID, current)
5. **Safety**: Verifies PR status before destructive operations
6. **Complete cleanup**: No orphaned worktrees, branches, or locks
7. **User-friendly**: Clear colored output with progress indicators
