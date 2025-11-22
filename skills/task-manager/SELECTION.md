# Task Selection Algorithm (Fallback)

**⚠️ IMPORTANT**: Only use this document if `select-task.ts` script fails or returns an error. The
script is the primary selection method (95% token savings).

## When to Use This Document

Use this manual selection algorithm only when:

- Script execution fails with error
- Script returns `"success": false`
- Running from environment without Node.js/TypeScript support
- Debugging selection logic issues

## Manual Selection Algorithm

### Step 1: List All Task Files

```bash
# From project root
ls -1 docs/tasks/T*.md | sort
```

**Expected pattern:** `T####-descriptive-title.md`

Example:

```
docs/tasks/T0001-fix-query-execution-error-findbyname.md
docs/tasks/T0002-enable-delete-access-repository-configuration.md
docs/tasks/T0003-add-migration-mode-bidirectional-operations.md
```

### Step 2: Read Frontmatter from Each File

```bash
# Read frontmatter (first 20 lines)
for file in docs/tasks/T*.md; do
  echo "=== $file ==="
  head -20 "$file"
  echo ""
done
```

Extract these fields from YAML frontmatter:

- `id`: Task identifier (e.g., T0001)
- `title`: Task description
- `priority`: P0, P1, P2, or P3
- `component`: Component code (e.g., C01)
- `status`: TODO, READY, IN_PROGRESS, or DONE
- `created`: ISO timestamp
- `source`: Source document reference

### Step 3: Filter by READY Status

```bash
# Find tasks with status: READY
grep -l "^status: READY$" docs/tasks/T*.md
```

**Only READY tasks can be started.**

**Status meanings:**

- **TODO**: Has unmet dependencies (blocked)
- **READY**: All dependencies done, can start
- **IN_PROGRESS**: Currently being worked on
- **DONE**: Completed and validated

### Step 4: Group by Priority

```bash
# Find P0 tasks (critical path)
grep -l "^priority: P0$" docs/tasks/T*.md | xargs grep -l "^status: READY$"

# Find P1 tasks
grep -l "^priority: P1$" docs/tasks/T*.md | xargs grep -l "^status: READY$"

# Find P2 tasks
grep -l "^priority: P2$" docs/tasks/T*.md | xargs grep -l "^status: READY$"

# Find P3 tasks
grep -l "^priority: P3$" docs/tasks/T*.md | xargs grep -l "^status: READY$"
```

**Priority order:** P0 > P1 > P2 > P3

### Step 5: Select Next Task

**Selection logic:**

1. **Prefer P0 tasks** (critical path)
   - These block the most downstream work
   - Highest business impact

2. **Then P1 tasks** (high priority)
   - Important but not on critical path

3. **Then P2 tasks** (medium priority)

4. **Finally P3 tasks** (low priority)

**Within same priority:**

- Choose lower task ID (T0001 before T0002)
- Or choose by component criticality
- Or ask user for preference

### Step 6: Validate Dependencies

Before selecting a task, verify all dependencies are DONE:

```bash
# Read task file
cat docs/tasks/T0001-*.md

# Look for Dependencies section:
# ## Dependencies
# **Blocking:** None
# **Blocked By:** T0005, T0007
```

**Dependency rules:**

- **Blocking**: Tasks this one blocks (informational)
- **Blocked By**: Tasks that must be DONE first (critical)

**Validation:**

```bash
# For each task in "Blocked By" list, verify status is DONE
grep "^status: DONE$" docs/tasks/T0005-*.md
grep "^status: DONE$" docs/tasks/T0007-*.md
```

If ANY blocking task is not DONE, the task is **not truly READY** (data inconsistency).

### Step 7: Present Selection

Show the user:

1. **Selected task summary:**

   ```
   Task: T0001
   Title: Fix query execution error in ContactRepository.findByName()
   Priority: P0
   Component: C01
   Status: READY
   File: docs/tasks/T0001-fix-query-execution-error-findbyname.md
   ```

2. **Other ready tasks** (for context):

   ```
   Other READY tasks:
   - T0003 (P1): Add migration mode bidirectional operations
   - T0012 (P2): Refactor CSV parser error handling
   ```

3. **Reason for selection:**
   ```
   Selected T0001 because:
   - Highest priority (P0)
   - All dependencies satisfied
   - Critical path blocker
   ```

## Selection Examples

### Example 1: Standard Selection

**Scenario:** Multiple READY tasks across priorities

```bash
# List READY tasks
$ grep -l "^status: READY$" docs/tasks/T*.md
docs/tasks/T0001-fix-query-execution-error.md         # P0
docs/tasks/T0003-add-migration-mode.md                # P1
docs/tasks/T0008-refactor-csv-parser.md               # P2
docs/tasks/T0015-update-documentation.md              # P3
```

**Selection:** T0001 (P0 priority)

### Example 2: All Same Priority

**Scenario:** Multiple P1 tasks ready

```bash
$ grep -l "^priority: P1$" docs/tasks/T*.md | xargs grep -l "^status: READY$"
docs/tasks/T0003-add-migration-mode.md
docs/tasks/T0004-implement-retry-logic.md
docs/tasks/T0006-add-logging-enhancement.md
```

**Selection:** T0003 (lowest ID)

**Alternative:** Ask user which to prioritize

### Example 3: Dependency Check

**Scenario:** Task appears READY but has dependencies

```bash
# T0010 shows status: READY
$ grep "^status:" docs/tasks/T0010-*.md
status: READY

# But check dependencies
$ grep -A2 "^## Dependencies" docs/tasks/T0010-*.md
## Dependencies
**Blocking:** T0015
**Blocked By:** T0005, T0007

# Verify blocking tasks are DONE
$ grep "^status:" docs/tasks/T0005-*.md
status: IN_PROGRESS  # ❌ NOT DONE!

$ grep "^status:" docs/tasks/T0007-*.md
status: DONE  # ✅ DONE
```

**Result:** T0010 is **NOT** truly ready (T0005 still IN_PROGRESS)

**Action:** Skip T0010, update its status to TODO, select different task

## Fallback Selection Script

If you need to automate this manually (bash):

```bash
#!/usr/bin/env bash
# fallback-select.sh

TASKS_DIR="docs/tasks"

# Find all READY tasks by priority
for priority in P0 P1 P2 P3; do
  ready_tasks=$(grep -l "^priority: $priority$" $TASKS_DIR/T*.md 2>/dev/null | \
                xargs grep -l "^status: READY$" 2>/dev/null | \
                sort)

  if [ -n "$ready_tasks" ]; then
    # Take first task (lowest ID)
    selected=$(echo "$ready_tasks" | head -1)

    echo "Selected: $selected"
    echo "Priority: $priority"
    echo ""
    echo "Frontmatter:"
    head -20 "$selected"

    exit 0
  fi
done

echo "No READY tasks found"
exit 1
```

Usage:

```bash
chmod +x fallback-select.sh
./fallback-select.sh
```

## Troubleshooting Manual Selection

### No READY Tasks Found

**Symptoms:**

```bash
$ grep -l "^status: READY$" docs/tasks/T*.md
# No output
```

**Possible causes:**

1. All tasks are TODO (have dependencies)
2. All tasks are IN_PROGRESS or DONE
3. Task files don't have `status: READY` line

**Actions:**

```bash
# Check all statuses
grep "^status:" docs/tasks/T*.md

# Find TODO tasks and check their dependencies
grep -l "^status: TODO$" docs/tasks/T*.md | while read file; do
  echo "=== $file ==="
  grep -A2 "^## Dependencies" "$file"
done
```

### Multiple P0 Tasks Ready

**Symptoms:**

```bash
$ grep -l "^priority: P0$" docs/tasks/T*.md | xargs grep -l "^status: READY$"
docs/tasks/T0001-*.md
docs/tasks/T0002-*.md
docs/tasks/T0009-*.md
```

**Actions:**

1. Select lowest ID (T0001)
2. Or ask user which is most critical
3. Or check which has most dependents (blocks most work)

```bash
# Find tasks blocked by T0001
grep "Blocked By:.*T0001" docs/tasks/T*.md
```

### Task File Parsing Errors

**Symptoms:**

- YAML frontmatter malformed
- Missing required fields
- Incorrect indentation

**Actions:**

```bash
# Validate YAML frontmatter
python3 << EOF
import yaml
with open('docs/tasks/T0001-*.md') as f:
    content = f.read()
    frontmatter = content.split('---')[1]
    yaml.safe_load(frontmatter)
print("✅ Valid YAML")
EOF
```

### Inconsistent Dependencies

**Symptoms:**

- Task marked READY but dependencies not DONE
- Circular dependencies

**Actions:**

1. Audit dependency graph
2. Update task statuses to reflect reality
3. Break circular dependencies

## Return to Script-Based Selection

Once issues are resolved, return to using the script:

```bash
pnpm tsx ~/.claude/skills/task-manager/select-task.ts
```

The script is preferred because:

- **95% token savings** vs manual parsing
- Automatic validation
- Consistent JSON output
- Error handling built-in
