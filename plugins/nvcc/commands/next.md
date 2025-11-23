---
description: Start the next highest-priority READY task
tags: [task-management, workflow]
---

# Next Task Command

Start the next available READY task with automatic locking and worktree creation.

---

**Progress Checkpoints:**

- ✅ Safe stopping point - No permanent state changes
- ⚠️ State change - Worktree/lock/PR created, resume needed if interrupted

---

## Variables (Extract from JSON)

After Step 1, you'll have these variables from the script output:

```bash
TASK_ID="MPCU-0017"           # Task identifier
TASK_FILE="/full/path/..."    # Absolute path to task file
PRIORITY="P1"                 # Priority level
TITLE="Task title here"       # Task description
TASK_DIR="apps/.../tasks"     # Task directory
```

**Lock System**:

- Lock file exists = task locked, script skips to next
- Lock created automatically when task selected
- No PID checking, no manual lock operations

---

## Step 1: Find and Lock Next Task ✅

Run the TaskDock next command **ONCE**:

```bash
taskdock next --json
```

**Success response:**

```json
{
  "filePath": "/full/path/to/task.md",
  "priority": "P1",
  "taskDir": "apps/migration-cli/docs/tasks",
  "taskId": "MPCU-0017",
  "title": "Task title"
}
```

**No tasks available:**

```json
{}
```

**IMPORTANT:**

- This command **atomically locks** the task it returns
- The returned task is **already locked** and ready to work on
- DO NOT check if the task is locked - it's YOUR lock
- DO NOT call this command again if you get a valid response
- If you get `{}`, all tasks are either locked by others or have unmet dependencies

**Error Handling:**

- If `{}`: Report "No READY tasks available" and exit
- If command fails: Report error and exit

**Dependency Resolution:** TaskDock automatically checks the `depends_on` field in task frontmatter:

- Task with `depends_on: [T0001, T0002]` requires both tasks to have `status: COMPLETED`
- If dependencies aren't met, TaskDock skips that task and selects the next highest priority task
- Tasks with no dependencies or all dependencies met are eligible for selection

---

## Step 2: Read Task File ✅

Use the `filePath` from JSON with the Read tool:

```
Read(filePath)
```

**Verify task contents:**

- ✅ Has `status: READY` in frontmatter
- ✅ Has acceptance criteria section
- ✅ Has implementation notes

---

## Step 3: Create Worktree ⚠️

Run the TaskDock worktree command:

```bash
taskdock worktree create TASK_ID
```

**What this does:**

- Creates `.worktrees/TASK_ID` directory
- Creates feature branch
- Updates task status to IN_PROGRESS
- Installs dependencies (if package.json exists)

**Note for monorepos:** The script auto-detects the package location from the TASK_FILE path. For
example:

- Task file: `apps/migration-cli/docs/tasks/MPCU-0017.md`
- Package location: `apps/migration-cli`
- Package name: Extracted from `apps/migration-cli/package.json`

No additional parameters needed - the script handles this automatically.

**Error Handling:**

- If worktree creation fails: Report error and exit
- If dependencies fail: Continue (manual install may be needed)

**For non-Node.js projects:** If your project doesn't have a package.json:

- Dependency installation is skipped automatically
- The worktree is still created successfully
- You can manually install dependencies if needed
- Validation (Step 6) may need custom commands instead of `pnpm` scripts

---

## Step 4: Implement Task ⚠️

Work directly in the worktree. Use these patterns:

**File Operations:**

- ✅ Use Read, Edit, Write, Glob, Grep tools
- ❌ Don't use `cat`, `sed`, `find` commands

**Running Commands:**

```bash
# Pattern 1: Use absolute paths
pnpm --filter PACKAGE_NAME --prefix WORKTREE_ROOT typecheck

# Pattern 2: Use -C flag
git -C WORKTREE_ROOT status

# Pattern 3: Use subshells
(cd WORKTREE_ROOT && pnpm test)
```

**Never:**

- ❌ `cd path && command && other-command` (chains break easily)
- ❌ Mix relative and absolute paths

---

## Step 5: Validation ⚠️

Run validation in the worktree:

```bash
taskdock validate .worktrees/TASK_ID
```

Or from within the worktree:

```bash
taskdock validate
```

**This runs:**

1. Format check: `pnpm format`
2. Type check: `pnpm typecheck` (REQUIRED)
3. Lint check: `pnpm lint`
4. Tests: `pnpm test` (REQUIRED)

**Configuration:** Validation can be customized in `.taskdock/config.yaml`:

```yaml
validation:
  run_format: true
  run_typecheck: true
  run_lint: true
  run_tests: true
```

**Error Handling:**

- If validation fails: Fix issues and re-run
- If tests fail: Update code or tests
- Don't skip validation

---

## Step 6: Create Pull Request ⚠️

Stage and commit changes:

```bash
# Stage all changes in worktree
git -C WORKTREE_ROOT add .

# Verify what's staged
git -C WORKTREE_ROOT status

# Create commit with proper message
git -C WORKTREE_ROOT commit -m "feat: TASK_ID - TITLE

<Summary of changes>

Closes #TASK_ID"
```

Then push and create PR:

```bash
git -C WORKTREE_ROOT push -u origin BRANCH_NAME

gh pr create \
  --title "TASK_ID: TITLE" \
  --body "$(cat <<'EOF'
## Summary
Brief description of changes made.

## Changes
- List key changes
- Implementation details
- Any notable decisions

## Test Plan
- [ ] Run validation: `~/.claude/scripts/validate-worktree.sh WORKTREE_ROOT PACKAGE_NAME`
- [ ] Manual testing steps
- [ ] Edge cases verified

## Closes
Closes #TASK_ID
EOF
)"
```

**Error Handling:**

- If commit fails: Check for uncommitted files
- If push fails: Check remote exists
- If PR creation fails: Check gh CLI is authenticated

---

## Step 8: Summary ✅

Report to user:

````markdown
✅ Task Complete: TASK_ID

**Worktree:** .worktrees/TASK_ID **Branch:** feat/TASK_ID-slug **PR:**
https://github.com/org/repo/pull/123

**Changes:**

- Summary of what was implemented

**Validation:** ✅ All checks passed

**Lock Status:** Lock file (`TASK_ID.lock`) is stored in `.git/task-locks/` (shared across all
worktrees). Lock remains active until PR is merged via `/merge` command. This prevents other agents
from picking up the same task while your PR is in review.

**To check/manage locks:**

```bash
taskdock locks list        # View all active locks
taskdock locks unlock T0001  # Unlock a specific task (if needed)
```
````

**Next Steps:**

1. Review the PR
2. Run `/merge TASK_ID` when ready to merge

````

---

## Resuming Interrupted Sessions

If your session is interrupted (network issue, crash, etc.), you can resume work:

**1. Identify your active worktree:**
```bash
git worktree list
````

**2. Find your task file:**

```bash
# Look for locked tasks (works from anywhere - main repo or worktree)
taskdock locks list
```

**3. Resume from where you left off:**

- Change to the worktree: `cd .worktrees/TASK_ID`
- Check current status: `git status`
- Continue implementation from Step 5
- When done, continue to Step 6 (Validation)

**Lock remains active** - Your task is still locked, preventing duplicate work.

---

## Error Scenarios

### No Tasks Available

```
✅ No READY tasks available

All tasks are either:
- Locked by other agents
- Have unmet dependencies
- Already IN_PROGRESS or COMPLETED
```

### Lock Already Exists

The script automatically skips locked tasks and returns the next available one. No action needed -
continue with returned task.

### Worktree Creation Failed

```
❌ Worktree creation failed

Possible causes:
- Branch already exists
- Worktree directory exists
- Git errors

Fix: Clean up manually and retry
```

### Validation Failed

```
❌ Validation failed: typecheck errors

**Fix and retry:**
1. Fix the errors in the worktree
2. Re-run validation: `taskdock validate .worktrees/TASK_ID`
3. Once validation passes, continue to Step 6 (Create PR)

**Lock remains active** - Your task is still locked, no need to restart from `/next`
```

### PR Creation Failed

```
❌ PR creation failed

Possible causes:
- gh CLI not authenticated: gh auth login
- Remote branch doesn't exist: git push first
- Network issues

Fix and retry: gh pr create ...
```

---

## Notes

- You are the executor - work directly, don't delegate
- Use tools (Read, Edit, Write) instead of bash for file operations
- Lock is managed automatically - don't remove or check locks
- Validation must pass before creating PR
- Use absolute paths or -C/-prefix flags for commands
