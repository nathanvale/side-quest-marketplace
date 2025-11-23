---
description: Universal task starter - works in any project
tags: [task-management, workflow]
---

# Start Task Command

You orchestrate task initiation across any project structure.

## Your Responsibilities

1. Detect project structure (monorepo vs single repo)
2. Find and select task
3. Handle monorepo multi-package scenarios
4. Create worktree using universal script
5. Spawn parallel-worker agent to execute

**Important**: You are the orchestrator. You don't delegate to an orchestrator agent - you ARE the
orchestration.

---

## Step 1: Detect Project Structure

```bash
# Check if monorepo
if [ -d "apps" ] || [ -d "packages" ]; then
  echo "Monorepo detected"
  IS_MONOREPO=true
else
  echo "Single repo detected"
  IS_MONOREPO=false
fi
```

---

## Step 2: Find Task Files

### For Single Repo:

```bash
# Search common locations
find . -maxdepth 3 \( -path "*/docs/tasks/*.md" -o -path "*/tasks/*.md" -o -path "*/.tasks/*.md" \) -type f
```

### For Monorepo (Multi-Package):

```bash
# Find ALL packages with tasks
find . \( -path "*/apps/*/docs/tasks" -o -path "*/packages/*/docs/tasks" \) -type d

# List packages:
# apps/api/docs/tasks/
# apps/web/docs/tasks/
# packages/utils/docs/tasks/
```

**If multiple packages found**, ask user:

```
Found tasks in multiple packages:
  1. api (3 tasks)
  2. web (2 tasks)
  3. utils (1 task)

Which package? (or 'all' to search across all)
```

---

## Step 3: Parse User Request

### Pattern 1: Explicit Task ID

**User**: "Start task T0030" **User**: "Start T0030"

Action:

1. Find task file matching T0030
2. If monorepo and multiple packages: search all packages
3. If found in multiple packages: ask which one
4. Proceed to Step 4

### Pattern 2: Next Task

**User**: "Start next task" **User**: "/next" **User**: "What should I work on"

Action:

1. If monorepo: ask which package (or search all)
2. Find all READY tasks
3. Use advanced selector if exists, else simple priority-based
4. Return highest priority task
5. Proceed to Step 4

### Pattern 3: New Task (Planning)

**User**: "Start new task: add authentication" **User**: "Create task for retry logic"

Action:

1. If monorepo: ask which package
2. Spawn planner agent to create task file
3. Return task ID
4. Proceed to Step 4

---

## Step 4: Select Task

### Try Advanced Selector First (Optional)

```bash
# Check for project-specific orchestrator
if [ -f "scripts/task-orchestrator.ts" ]; then
  # Use advanced analysis
  bun scripts/task-orchestrator.ts --next
elif [ -f "scripts/task-orchestrator.js" ]; then
  node scripts/task-orchestrator.js --next
else
  # Use simple priority-based selection
  # (See Step 4b below)
fi
```

### Simple Priority-Based Selection (Fallback)

```bash
# 1. Find READY tasks in target directory
find $TASK_DIR -name "*.md" -type f | while read file; do
  STATUS=$(grep "^status:" "$file" | sed 's/status: *//')
  if [ "$STATUS" = "READY" ]; then
    echo "$file"
  fi
done

# 2. Check dependencies
# For each READY task, verify all dependencies are COMPLETED

# 3. Sort by priority (P0 > P1 > P2 > P3)
# Extract priority from each file, sort

# 4. Return first match (highest priority, oldest created)
```

**Result**: Task ID (e.g., T0030)

---

## Step 5: Create Worktree

Use **TaskDock** from dotfiles:

```bash
taskdock worktree create $TASK_ID

# For monorepo with specific package:
taskdock worktree create $TASK_ID apps/api
```

**What this does**:

- Creates git worktree at `./worktrees/$TASK_ID`
- Updates task status to IN_PROGRESS (in worktree)
- Creates lock file
- Installs dependencies (auto-detects package manager)
- Commits initial status change to feature branch

---

## Step 6: Spawn Parallel-Worker

Use the Task tool to spawn parallel-worker agent:

```typescript
Task({
  subagent_type: "parallel-worker",
  model: "sonnet",
  description: "Execute task T0030",
  prompt: `Execute task T0030 in worktree ./worktrees/T0030

You are parallel-worker agent in an isolated git worktree.

**Context**:
- Task: T0030
- Worktree: ./worktrees/T0030
- Branch: feat/T0030-description
- Task file: Auto-detected (search in worktree)

**Your workflow**:
1. Read task requirements (auto-detect location in worktree)
2. Identify work streams for parallel execution
3. Spawn implementer sub-agents (all in one message for true parallel)
4. Coordinate execution and handle conflicts
5. Run code review if needed
6. Execute Phase 8: Update task to COMPLETED, create PR
7. Return consolidated summary

**Important**:
- All file paths relative to worktree root
- Use Task tool to spawn sub-agents in parallel
- Return ONLY final summary (not implementation details)

Proceed with execution.`,
});
```

---

## Step 7: Return Summary to User

After parallel-worker completes:

```markdown
## Task Started: T0030

**Worktree**: ./worktrees/T0030 **Branch**: feat/T0030-description **Status**: Work in progress

Parallel-worker is executing the task with these streams:

- Stream 1: Error classifier
- Stream 2: Retry queue logic
- Stream 3: CLI flag

You will be notified when complete.
```

---

## Monorepo Multi-Package Handling

### Scenario 1: User Specifies Package

```
User: "Start next task in api"
User: "Start T0030 from web package"
```

Action:

- Target package directory directly
- No disambiguation needed

### Scenario 2: User Doesn't Specify

```
User: "Start next task"
```

Action:

```markdown
Found tasks in multiple packages:

**api** (apps/api/docs/tasks/):

- T0001 (P0, READY): Add authentication
- T0002 (P1, READY): Add logging

**web** (apps/web/docs/tasks/):

- T0003 (P0, READY): Update UI
- T0004 (P2, READY): Fix layout

Which package? (or 'all' to find highest priority across all)
```

User response: "api" or "all"

**If "all"**: Search across all packages, return single highest priority task globally.

---

## Advanced vs Simple Selection

### When Advanced Exists (Optional)

```bash
# scripts/task-orchestrator.ts provides:
- Conflict analysis using PROJECT_INDEX.json
- Parallel task recommendations
- Complexity scoring
- Dependency graph analysis
```

### When Advanced Missing (Fallback)

```bash
# Simple selection provides:
- Priority-based sorting (P0 > P1 > P2 > P3)
- Dependency checking (YAML frontmatter)
- Created date tie-breaking
- READY status filtering
```

**Both work!** Advanced is optional optimization.

---

## Error Handling

### Git Not Clean

```
❌ Working directory has uncommitted changes.
Please commit or stash before starting a task.

git status shows:
M src/file.ts
?? new-file.ts
```

### Task Not Found

```
❌ Task T0030 not found.

Searched in:
- docs/tasks/
- tasks/
- apps/*/docs/tasks/
- packages/*/docs/tasks/

Please verify task ID or create a new task.
```

### Multiple Packages, No Disambiguation

```
⚠️  Found T0030 in multiple packages:
- apps/api/docs/tasks/T0030-add-auth.md
- packages/utils/docs/tasks/T0030-add-helpers.md

Which package?
```

### No READY Tasks

```
✅ All tasks are IN_PROGRESS or COMPLETED!

Current status:
- P0: 2 COMPLETED, 1 IN_PROGRESS
- P1: 3 COMPLETED, 0 READY

Would you like to:
1. Create a new task
2. Review completed work
3. Check IN_PROGRESS tasks
```

---

## Example Flows

### Flow 1: Single Repo, Explicit Task

```
User: "Start T0030"

1. Detect: Single repo
2. Find: docs/tasks/T0030-add-retry.md
3. Create worktree: taskdock worktree create T0030
4. Spawn: parallel-worker agent
5. Report: "Task T0030 started in ./worktrees/T0030"
```

### Flow 2: Monorepo, Next Task

```
User: "/next"

1. Detect: Monorepo (apps/ and packages/ exist)
2. Find packages with tasks:
   - apps/api/docs/tasks/
   - apps/web/docs/tasks/
3. Ask: "Which package? (api, web, all)"
4. User: "api"
5. Select: T0030 (P0, READY, oldest)
6. Create worktree: taskdock worktree create T0030 apps/api
7. Spawn: parallel-worker agent
8. Report: "Task T0030 from api package started"
```

### Flow 3: Monorepo, All Packages

```
User: "/next" → "all"

1. Search ALL packages for READY tasks
2. Find:
   - apps/api: T0001 (P1)
   - apps/web: T0003 (P0) ← HIGHEST
   - packages/utils: T0005 (P2)
3. Select: T0003 (highest priority globally)
4. Create worktree: taskdock worktree create T0003 apps/web
5. Spawn: parallel-worker agent
6. Report: "Task T0003 from web package started"
```

---

## Task File Format Reference

See `~/.claude/docs/TASK_FILE_FORMAT.md` for the complete standard format.

**Minimal required fields**:

```yaml
---
id: T0001
title: Task title
priority: P0
status: READY
created: 2025-11-16
---
```

---

## Summary

**You orchestrate, you don't delegate to an orchestrator agent.**

Your workflow:

1. Detect structure
2. Find/select task (handle monorepo multi-package)
3. Create worktree (universal script)
4. Spawn parallel-worker (Task tool)
5. Report to user

The parallel-worker handles all execution and Phase 8 completion.
