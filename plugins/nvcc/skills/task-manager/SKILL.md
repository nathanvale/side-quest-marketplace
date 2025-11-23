---
name: task-manager
description:
  Automated task lifecycle orchestrator for docs/tasks/ directory - identifies next ready tasks by
  priority, loads full context from markdown files, guides TDD implementation with Wallaby MCP, runs
  quality checks, and tracks completion. Use when user says "start next task", "what should I work
  on", "show ready tasks", or mentions specific task IDs like "start T0001".
allowed-tools:
  [
    Read,
    Edit,
    Bash,
    Glob,
    Grep,
    TodoWrite,
    Task,
    mcp__wallaby__wallaby_allTestsForFile,
    mcp__wallaby__wallaby_coveredLinesForFile,
    mcp__wallaby__wallaby_failingTests,
    mcp__wallaby__wallaby_testById,
  ]
---

# Task Manager Skill v2.0.0

Automates the complete task lifecycle for migration CLI development: selection, context loading,
implementation guidance, quality validation, and completion tracking.

## Version History

- **v2.0.0** (2025-11-07): Script-based selection (95% token savings), multi-file task support,
  corrected task format parsing
- **v1.0.0** (2025-10-01): Initial release with TASKS.md-based selection

## When to Use This Skill

Claude should **automatically** invoke this skill when the user:

- Asks to "start the next task" or "what should I work on next"
- Requests "show me the next ready task" or "list ready tasks"
- Says "I'm ready to begin" or "what's next?"
- Mentions a specific task ID like "start T0001" or "work on T0002"
- Asks "what tasks are ready?" or "show task queue"
- Says "mark task X as done" or "complete T0001"
- Requests task status updates or progress reports

## Core Capabilities

### 1. **Task Discovery & Selection**

- Scans `docs/tasks/` directory for task files matching `T####-*.md` pattern
- Identifies tasks with `status: READY` in YAML frontmatter
- Prioritizes by: P0 (critical path) > P1 > P2 > P3
- Validates all dependencies are completed
- Handles optional task ID argument for direct selection

### 2. **Context Loading**

- **Parse YAML frontmatter**:
  - `id`: Task identifier (e.g., T0001)
  - `title`: Task description
  - `priority`: P0/P1/P2/P3
  - `component`: Component code (e.g., C01)
  - `status`: TODO/READY/IN_PROGRESS/DONE
  - `created`: Timestamp
  - `source`: Origin document reference

- **Extract markdown sections**:
  - Description: Problem statement and context
  - Acceptance Criteria: Checkboxes for validation
  - Implementation Steps: Ordered remediation sequence
  - Files to Change: Create/Modify/Delete lists
  - Testing Requirements: Test matrix with AC mapping
  - Dependencies: Blocking/Blocked By relationships
  - Regression Risk: Impact analysis and blast radius
  - Code Examples: Current vs Proposed code
  - Notes: Additional context and related issues

### 3. **Implementation Guidance**

- Provides step-by-step implementation plan from task file
- **Enforces Test-Driven Development (TDD)** approach using Wallaby MCP tools:
  - Read test requirements from task's Testing Requirements section
  - Guide user through writing tests FIRST (unit → integration → E2E)
  - Use `mcp__wallaby__wallaby_failingTests` to verify red state
  - Use `mcp__wallaby__wallaby_testById` to monitor test progress
  - Use `mcp__wallaby__wallaby_coveredLinesForFile` to check coverage
  - Only implement code AFTER tests are written
- Extracts code examples from task file (Current vs Proposed)
- Applies TypeScript quality patterns from `.claude/rules/typescript-patterns-condensed.md`
- Identifies files to create/modify/delete

### 4. **Quality Validation**

- Runs type checking (`pnpm typecheck`)
- Executes linting (`pnpm lint`)
- Runs test suite (`pnpm test`)
- Checks formatting (`pnpm format:check`)
- Validates all acceptance criteria are checked

### 5. **Task Lifecycle Management**

- Updates task file status: TODO → READY → IN_PROGRESS → DONE
- Marks dependencies complete in frontmatter
- Unblocks dependent tasks (updates their status to READY)
- Tracks completion statistics
- Adds completion timestamps to task files

## Supporting Documentation

- **@README.md**: Quick reference and usage examples
- **@SELECTION.md**: Fallback algorithm details (only if script fails)
- **@IMPLEMENTATION.md**: TDD guidance and implementation patterns
- **@VALIDATION.md**: Quality check procedures and completion criteria
- **@ERROR_HANDLING.md**: Error scenarios and resolution strategies
- **@EXAMPLES.md**: Detailed interaction examples

## Main Workflow

Follow this systematic process:

### Phase 1: Select Task (Script-Based - 95% Token Savings)

**⚡ ALWAYS use the script first** to save ~2000 tokens:

```bash
# From project root directory
cd /Users/nathanvale/code/MPCU-Build-and-Deliver

# Select next ready task (auto-priority: P0 > P1 > P2 > P3)
bun ~/.claude/skills/task-manager/select-task.ts

# Select specific task by ID
bun ~/.claude/skills/task-manager/select-task.ts --task-id=T0001

# List all ready tasks
bun ~/.claude/skills/task-manager/select-task.ts --show-ready
```

**Expected Output** (structured JSON ~100 tokens):

```json
{
  "readyTasks": [
    { "id": "T0001", "priority": "P0", "title": "..." },
    { "id": "T0003", "priority": "P1", "title": "..." }
  ],
  "success": true,
  "task": {
    "component": "C01",
    "created": "2025-11-07T00:00:00Z",
    "filePath": "docs/tasks/T0001-fix-query-execution-error-findbyname.md",
    "id": "T0001",
    "priority": "P0",
    "source": "docs/bugs/2025-11-07-migration-contact-creation-failure-100-percent.md",
    "status": "READY",
    "title": "Fix query execution error in ContactRepository.findByName()"
  }
}
```

**⚠️ CRITICAL**: Only read @SELECTION.md if the script fails or returns an error.

---

### Phase 2: Load Context

**Read the complete task file** using the `filePath` from script output:

```bash
# Read task file
cat docs/tasks/T0001-fix-query-execution-error-findbyname.md
```

**Display to user:**

1. **Task summary** (from frontmatter):
   - ID, priority, component, status
   - Created date, source document

2. **Description section**:
   - Problem statement
   - Error details
   - Root cause analysis

3. **Acceptance Criteria** (as checklist):

   ```
   - [ ] Mock query() returns empty array [] when no contacts match filter
   - [ ] findByName() returns null when no contacts found
   - [ ] Filter string parsing handles special characters safely
   - [ ] All 100 test CSV rows process successfully
   - [ ] Integration test validates mock query behavior
   ```

4. **Testing Requirements** (test matrix):
   - List all required tests with type, description, and location
   - Map tests to acceptance criteria they validate
   - Show TDD order: unit → integration → E2E

5. **Regression Risk section**:
   - Impact level and blast radius
   - Testing gaps identified
   - Rollback risk assessment

6. **Implementation Steps** (ordered sequence):
   - Extract numbered steps from task file
   - Show file references and line numbers
   - Include code change descriptions

7. **Files to Change section**:
   - Files to Create (list)
   - Files to Modify (with line ranges)
   - Files to Delete (list)

8. **Code Examples section**:
   - Current (Problematic) code
   - Proposed (Fixed) code
   - Highlight key differences

9. **Dependencies**:
   - Blocking: Tasks that block this one
   - Blocked By: Tasks this one blocks

10. **Notes section**:
    - Related issues/tasks
    - Investigation findings
    - Testing strategy
    - Future improvements

**Read related documents** referenced in `source` field or Notes section.

---

### Phase 3: Guide Implementation

**⚠️ CRITICAL**: Read @IMPLEMENTATION.md for complete TDD guidance before proceeding.

**Key principles:**

1. **Extract implementation plan** from task's Implementation Steps section
2. **Enforce TDD workflow** by STRICTLY following the test matrix:
   - Parse Testing Requirements table from task file
   - **Write tests FIRST** (never code before tests):

     ```bash
     # Check current test status
     bun ~/.claude/skills/task-manager/check-tests.ts T0001

     # Verify tests are failing (RED state)
     # Use Wallaby MCP: mcp__wallaby__wallaby_failingTests
     ```

   - Write unit tests first, then integration tests, then E2E
   - Verify each test fails before implementing (RED)
   - Implement code to make tests pass (GREEN)
   - Refactor while keeping tests green (REFACTOR)

3. **Extract code examples** from task file's Code Examples section
4. **Apply TypeScript quality patterns** from `.claude/rules/typescript-patterns-condensed.md`
5. **Use Wallaby MCP tools** throughout:
   - Monitor test execution in real-time
   - Check code coverage as you implement
   - Identify failing tests that need attention

---

### Phase 4: Confirm & Start

1. **Present implementation summary**:
   - What will be done (from Implementation Steps)
   - Files affected (from Files to Change)
   - Test strategy (from Testing Requirements)
   - Estimated effort (from frontmatter)

2. **Wait for user confirmation** ("yes", "proceed", "go ahead")

3. **CRITICAL - Update task status**:

   ```bash
   # Update status: READY → IN_PROGRESS
   # Edit docs/tasks/T####-*.md frontmatter
   ```

4. **Begin implementation** with user (TDD approach)

---

### Phase 5: Track Progress

**During implementation:**

1. **Guide through test creation** (TDD approach):
   - Unit tests first
   - Integration tests second
   - E2E tests last
   - Verify RED state before implementing

2. **Guide through code implementation**:
   - Implement to make tests pass (GREEN)
   - Refactor while tests stay green
   - Follow code examples from task file

3. **Check off acceptance criteria** as completed:
   - Update task file with checked items
   - Track progress visually for user

4. **Monitor test status** with Wallaby MCP:

   ```bash
   # Check failing tests
   mcp__wallaby__wallaby_failingTests

   # Check specific test
   mcp__wallaby__wallaby_testById --id="test-id"

   # Check coverage
   mcp__wallaby__wallaby_coveredLinesForFile --file="path/to/file.ts"
   ```

5. **Keep user informed** of remaining items and blockers

---

### Phase 6: Validate & Complete

**⚠️ CRITICAL**: Read @VALIDATION.md for complete quality check procedures.

**Required checks (ALL must pass):**

```bash
# 1. Type checking
pnpm typecheck
# Expected: 0 errors

# 2. Linting
pnpm lint
# Expected: 0 errors

# 3. Test suite
pnpm test
# Expected: All tests passing

# 4. Formatting
pnpm format:check
# Expected: 0 errors
```

**Only after ALL checks pass:**

1. **Verify all acceptance criteria checked** in task file
2. **Update task status**: IN_PROGRESS → DONE
   ```bash
   # Edit docs/tasks/T####-*.md
   # Change status: DONE
   # Add completion timestamp
   ```
3. **Unblock dependent tasks**:
   - Find tasks blocked by this one (from Dependencies)
   - Update their status: TODO → READY (if all dependencies done)
4. **Report completion statistics**:
   - Time taken
   - Files modified
   - Tests added/updated
   - Coverage improvement
5. **Recommend next task** on critical path (P0 tasks first)

---

## Critical Rules

**NEVER skip these steps:**

- ✅ **ALWAYS** run the script first (Phase 1) - do NOT read @SELECTION.md unless script fails
- ✅ **ALWAYS** verify ALL dependencies are DONE before starting
- ✅ **ALWAYS** read complete task file (all sections) before implementation
- ✅ **ALWAYS** enforce TDD: write tests FIRST, verify RED, then implement GREEN
- ✅ **ALWAYS** use Wallaby MCP tools to monitor test progress
- ✅ **ALWAYS** update task file status when changing phases
- ✅ **ALWAYS** run ALL quality checks before marking DONE
- ✅ **ALWAYS** unblock dependent tasks after completion
- ✅ **ALWAYS** follow TypeScript patterns from `.claude/rules/typescript-patterns-condensed.md`

**Task Status Flow:**

```
TODO → READY → IN_PROGRESS → DONE
```

**Priority Order:**

```
P0 (critical path) → P1 → P2 → P3
```

**TDD Cycle (Mandatory):**

```
Write Test (RED) → Implement Code (GREEN) → Refactor (keep GREEN)
```

---

## Error Scenarios

**For detailed error handling**, see: **@ERROR_HANDLING.md**

Common errors:

- Script execution failures → Read @SELECTION.md for fallback
- Task file not found → List available tasks in docs/tasks/
- Dependencies not met → Show blocking tasks and their status
- Task already in progress → Present options (continue/restart)
- No ready tasks → Analyze blockers and suggest next actions
- Quality checks fail → Show errors and guide fixes
- Tests not written first → Enforce TDD, reject code-first approach

---

## Success Metrics

After using this skill, user should have:

- ✅ Clear understanding of what to build
- ✅ Step-by-step implementation plan extracted from task file
- ✅ Test-first development approach (TDD enforced)
- ✅ Real-time test monitoring with Wallaby MCP
- ✅ Quality checks passing before completion
- ✅ Visibility into what tasks are unblocked
- ✅ Seamless transition to next task

---

## Integration with Other Skills

This skill works well with:

- **Code Review Skills**: For validating implementation quality
- **Testing Skills**: For comprehensive test coverage
- **Refactoring Skills**: For code quality improvements
- **Documentation Skills**: For updating specs/docs after completion
- **Wallaby MCP**: For real-time test execution and coverage monitoring

---

## Handy Commands

```bash
# Task selection
bun ~/.claude/skills/task-manager/select-task.ts
bun ~/.claude/skills/task-manager/select-task.ts --task-id=T0001
bun ~/.claude/skills/task-manager/select-task.ts --show-ready

# List all task files
ls -1 docs/tasks/T*.md | sort

# View task frontmatter
head -20 docs/tasks/T0001-*.md

# Count ready tasks
grep -l "^status: READY$" docs/tasks/T*.md | wc -l

# Find tasks by priority
grep -l "^priority: P0$" docs/tasks/T*.md

# Find tasks by component
grep -l "^component: C01$" docs/tasks/T*.md

# Quality validation
pnpm typecheck && pnpm lint && pnpm test && pnpm format:check

# Wallaby test monitoring (via MCP)
# mcp__wallaby__wallaby_failingTests
# mcp__wallaby__wallaby_testById --id="test-id"
# mcp__wallaby__wallaby_coveredLinesForFile --file="src/file.ts"
```
