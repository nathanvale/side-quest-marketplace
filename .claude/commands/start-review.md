---
description: Decompose a review into individual task files
tags: [task-management, reviews, task-creation]
---

# Start Review Command

Decomposes review findings into individual task files in a worktree.

Use this when you have a review document (security audit, code review, technical debt assessment,
etc.) that needs to be broken down into actionable tasks.

## Your Responsibilities

1. **Gather review information** from user
2. **Create worktree** for task generation
3. **Parse review** and decompose into tasks
4. **Create task files** in `docs/tasks/` directory
5. **Commit and create PR** for review
6. **Report summary** to user

---

## Step 1: Gather Review Information

Ask the user for the review source using these questions:

**Question 1: Review Source**

- "Do you have a review file/task to reference, or would you like to paste the review content?"
- Options:
  - **Reference a file/task** (e.g., "docs/reviews/security-audit-2024.md" or "MPCU-0010")
  - **Paste content directly** (user provides review text)

**Question 2: Review Name** (for branch/PR naming)

- "What should I call this review?"
- Examples: "security-audit", "code-review-q4", "tech-debt-assessment"

**Auto-Detection** (no questions needed):

- Task directory: Auto-detected using `get_task_directory`
- Task prefix: Auto-detected using `detect_task_prefix` (analyzes existing tasks)

---

## Step 2: Create Worktree for Task Generation

```bash
# Get task directory and prefix from TaskDock config
TASK_DIR=$(taskdock config get task_management.task_dir)
PREFIX=$(taskdock config get task_management.ticket_prefix)

if [ -z "$TASK_DIR" ] || [ -z "$PREFIX" ]; then
    echo "❌ TaskDock not initialized in this repository"
    echo "Run: taskdock init"
    exit 1
fi

echo "📁 Task directory: $TASK_DIR"
echo "🏷️  Task prefix: $PREFIX"

# Generate worktree name
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
REVIEW_NAME="<review-name-from-user>"  # e.g., "security-audit", "code-review-q4"
WORKTREE_NAME="review-${TIMESTAMP}-${REVIEW_NAME}"
BRANCH_NAME="feat/add-tasks-from-${REVIEW_NAME}"

# Create worktree (NO LOCK - we're creating tasks, not consuming them)
# Note: Use git worktree directly since TaskDock worktree create is for existing tasks
git worktree add ".worktrees/${WORKTREE_NAME}" -b "${BRANCH_NAME}"
cd ".worktrees/${WORKTREE_NAME}"

echo "✅ Created worktree: .worktrees/${WORKTREE_NAME}"
```

**Important:** This does NOT create a lock file. Review task generation is independent of the task
consumption workflow.

---

## Step 3: Parse Review Content

### If User Referenced a File:

```bash
# Read the review file
REVIEW_FILE="<path-from-user>"
REVIEW_CONTENT=$(cat "$REVIEW_FILE")
```

### If User Pasted Content:

Store the pasted content in a variable for processing.

### Parse Review Structure

Look for common review patterns:

- **Findings/Issues**: Numbered lists, bullet points, sections
- **Severity/Priority**: High/Medium/Low, P0/P1/P2/P3
- **Categories**: Security, Performance, Code Quality, etc.
- **Recommendations**: Action items, suggested fixes

---

## Step 4: Decompose Review into Task Files

For each finding/issue in the review, create a task file:

### Task File Naming Convention:

```
<PREFIX>-<NUMBER>-<slug>.md
```

Examples:

- `MPCU-0100-fix-sql-injection-vulnerability.md`
- `MPCU-0101-add-input-validation-to-api-endpoints.md`
- `MPCU-0102-implement-rate-limiting.md`

### Task File Template:

```markdown
---
title: <Finding Title>
status: READY
priority: <P0/P1/P2/P3 based on severity>
depends_on: []
created: <YYYY-MM-DD>
source: review-<review-name>
category: <security/performance/code-quality/etc>
---

# <Finding Title>

## Problem

<Description of the issue from review>

## Impact

<Why this matters - from review findings>

## Acceptance Criteria

- [ ] <Specific, testable criterion 1>
- [ ] <Specific, testable criterion 2>
- [ ] <Specific, testable criterion 3>

## Implementation Notes

<Recommendations from review>

## Review Reference

Source: `<review-file-path or "Direct Input">` Finding: `<Finding number/section from review>`

---

**Note:** This task was auto-generated from review: <review-name>
```

### Priority Mapping:

Map review severity to task priority:

- **Critical/High** → `P0` (immediate action)
- **Medium** → `P1` (high priority)
- **Low** → `P2` (normal priority)
- **Nice-to-have** → `P3` (low priority)

### Create Each Task File:

```bash
# Note: TaskDock review functionality is planned for future release
# For now, use manual task numbering or implement custom counter
# Future: taskdock review create will handle this automatically

for finding in <parsed-findings>; do
  # Get next task number - find highest existing number and increment
  TASK_NUM=$(find "$TASK_DIR" -name "${PREFIX}-*.md" | \
    sed -n "s/.*${PREFIX}-\([0-9]\+\).*/\1/p" | \
    sort -n | tail -1 | awk '{print $1+1}')
  TASK_NUM=${TASK_NUM:-1}  # Start at 1 if no tasks exist
  TASK_NUM=$(printf "%04d" $TASK_NUM)  # Zero-pad to 4 digits

  TASK_SLUG="<slugified-finding-title>"
  TASK_FILE="${TASK_DIR}/${PREFIX}${TASK_NUM}-${TASK_SLUG}.md"

  # Generate task file content
  cat > "$TASK_FILE" <<EOF
<task-content-using-template>
EOF

  echo "✅ Created: ${PREFIX}${TASK_NUM}-${TASK_SLUG}.md"
done
```

**Note:**

- This is a manual process until TaskDock review functionality is implemented
- TaskDock v0.2+ will include `taskdock review create` for automated task generation
- For now, ensure task numbering doesn't conflict with existing tasks
- Consider using higher number ranges for review-generated tasks (e.g., start at 1000)

---

## Step 5: Commit and Create PR

```bash
# Stage all new task files
git add apps/migration-cli/docs/tasks/*.md

# Create descriptive commit
TASK_COUNT=<number-of-tasks-created>
git commit -m "Add ${TASK_COUNT} tasks from ${REVIEW_NAME} review

Tasks created:
<list-of-task-ids>

Source: ${REVIEW_FILE:-Direct Input}
"

# Push branch
git push -u origin "${BRANCH_NAME}"

# Create PR
PR_BODY="## Review Task Generation

**Source:** ${REVIEW_FILE:-Direct Input}
**Type:** ${REVIEW_TYPE:-Code Review}
**Tasks Created:** ${TASK_COUNT}

### Generated Tasks

<table-of-tasks-with-priorities>

### Next Steps

1. Review generated tasks for accuracy
2. Adjust priorities if needed
3. Merge PR to add tasks to main (use `taskdock merge pr <pr-number>`)
4. Use `/next` (calls `taskdock next`) to start working on tasks
"

gh pr create \
  --title "Add ${TASK_COUNT} tasks from ${REVIEW_NAME}" \
  --body "$PR_BODY"
```

---

## Step 6: Report Summary to User

Return to user with:

```markdown
## ✅ Review Tasks Generated

**Worktree:** `.worktrees/${WORKTREE_NAME}` **Branch:** `${BRANCH_NAME}` **Tasks Created:**
${TASK_COUNT}

### Generated Tasks:

1. **MPCU-XXXX**: <title> [P0]
2. **MPCU-XXXX**: <title> [P1]
3. **MPCU-XXXX**: <title> [P2] ...

### Pull Request

🔗 <PR-URL>

### Next Steps

1. **Review the PR** - Check that tasks accurately reflect the review findings
2. **Adjust if needed** - Edit task files in the worktree if priorities/details need changes
3. **Merge when ready** - Run `/merge <pr-number>` (calls `taskdock merge pr <pr-number>`) to add
   tasks to main
4. **Start working** - Run `/next` (calls `taskdock next`) to pick up the highest priority task

### Worktree Info

- The worktree remains active until you merge the PR
- You can make edits directly in: `.worktrees/${WORKTREE_NAME}/apps/migration-cli/docs/tasks/`
- When merged, the worktree will be automatically cleaned up
```

---

## Error Handling

### No Review Content

```
❌ No review content provided.
Please provide either:
1. A file path/task ID to reference
2. Paste the review content directly
```

### Task Directory Not Found

```
❌ Task directory not found.
Expected: apps/migration-cli/docs/tasks

Please run this command from the repository root.
```

### Failed to Parse Review

```
⚠️  Could not automatically parse review structure.
Would you like to:
1. Manually specify findings (I'll ask for each one)
2. Provide review in a different format
3. Cancel
```

---

## Examples

### Example 1: Security Audit Review

```
User: "/start-review"

You: "What's the source of the review?"
User: "I'll paste it"

You: "Please paste the review content"
User: <pastes security audit findings>

You: "What should I call this review?"
User: "security-audit-q4-2024"

You:
✅ Created 8 tasks from security-audit-q4-2024
  - MPCU-0100: Fix SQL injection in search endpoint [P0]
  - MPCU-0101: Add input validation to user API [P0]
  - MPCU-0102: Implement rate limiting [P1]
  - MPCU-0103: Add CSRF tokens to forms [P1]
  - MPCU-0104: Update dependencies with CVEs [P2]
  - MPCU-0105: Enable security headers [P2]
  - MPCU-0106: Add security logging [P2]
  - MPCU-0107: Document security practices [P3]

📋 PR: https://github.com/org/repo/pull/123
🔗 Ready for review and merge
```

### Example 2: Reference Existing Review Task

```
User: "/start-review"

You: "What's the source of the review?"
User: "MPCU-0010" (a task that contains review findings)

You: <reads MPCU-0010 content>
You: "Found code review findings. What should I call this review?"
User: "code-review-auth-module"

You:
✅ Created 5 tasks from code-review-auth-module
  - MPCU-0100: Refactor error handling [P1]
  - MPCU-0101: Add unit tests for auth module [P1]
  - MPCU-0102: Remove duplicate code in utils [P2]
  - MPCU-0103: Update API documentation [P2]
  - MPCU-0104: Add type definitions [P3]
```

---

## Integration with Existing Workflow

```
┌─────────────────┐
│  /start-review  │ ← Decomposes review into tasks
└────────┬────────┘
         │
         ▼
    Creates PR
         │
         ▼
    Team reviews
         │
         ▼
     /merge PR  ← taskdock merge pr <num> - Adds tasks to main
         │
         ▼
   Tasks on main
         │
         ▼
      /next     ← taskdock next - Starts working on tasks
         │
         ▼
   Implements
         │
         ▼
     /merge    ← taskdock merge pr --current - Completes task
```

---

## Notes

- **No locking**: `/start-review` doesn't lock tasks (it creates them)
- **Parallel reviews**: Multiple reviews can be processed simultaneously
- **Worktree cleanup**: `/merge` (uses `taskdock merge`) handles cleanup automatically
- **Task numbering**: Manual for now - TaskDock v0.2+ will include `taskdock review create`
- **Flexible input**: Supports file references or direct paste
- **Interactive**: Asks questions to gather all needed information
- **Works in Claude Code and VS Code Copilot**: Uses standard prompting, falls back to text prompts
  if AskUserQuestion unavailable
- **TaskDock integration**: Uses `taskdock config` for task directory/prefix, `taskdock merge` for
  PR merging
