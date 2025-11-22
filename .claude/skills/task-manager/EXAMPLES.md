# Task Manager Interaction Examples

This document provides detailed examples of typical interactions with the task-manager skill.

## Example 1: Starting Next Task (Auto-Selection)

**User:** "Start the next task"

**Claude Response:**

```
I'll use the task-manager skill to select the next ready task.

Running selection script...
```

**Script Output:**

```json
{
  "readyTasks": [
    { "id": "T0001", "priority": "P0", "title": "Fix query execution error" },
    { "id": "T0003", "priority": "P1", "title": "Add migration mode bidirectional" }
  ],
  "success": true,
  "task": {
    "component": "C01",
    "created": "2025-11-07T00:00:00Z",
    "filePath": "docs/tasks/T0001-fix-query-execution-error-findbyname.md",
    "id": "T0001",
    "priority": "P0",
    "source": "docs/bugs/2025-11-07-migration-contact-creation-failure.md",
    "status": "READY",
    "title": "Fix query execution error in ContactRepository.findByName()"
  }
}
```

**Claude Continues:**

```
Selected Task: T0001 (P0 - Critical Path)
Title: Fix query execution error in ContactRepository.findByName()
Component: C01 (Data Layer / Repositories)
Estimated Effort: 4 hours

Loading complete task context...

## Problem Description

The mock Dataverse query() method throws an unexpected error instead of
returning an empty array when ContactRepository.findByName() executes.
This causes 100% failure rate in referral migration with all 100 CSV rows
failing during contact creation phase.

**Error:** [DATAVERSE-E005] DATAVERSE_QUERY_FAILED
**Root Cause:** Mock's query() method throws exception instead of returning []

## Acceptance Criteria

- [ ] Mock query() returns empty array [] when no contacts match filter
- [ ] findByName() returns null when no contacts found (no exception thrown)
- [ ] Filter string parsing handles special characters and quotes safely
- [ ] All 100 test CSV rows process successfully without errors
- [ ] Integration test validates mock query behavior matches expected contract

## Testing Requirements

Unit Tests:
1. Mock query returns [] for empty results (AC1, AC2)
2. findByName handles special characters (AC3)

Integration Tests:
3. End-to-end with 100 CSV rows (AC4, AC5)

## Implementation Steps

1. Add defensive null checks to mock query() (mock-dataverse.ts:282-311)
2. Add input validation to findByName() (contact-repository.ts:88-108)
3. Escape single quotes in filter strings
4. Add comprehensive logging
5. Test with original failing dataset

## Files to Modify

- src/lib/mocks/mock-dataverse.ts (~30 lines)
- src/lib/dynamics/contact-repository.ts (~20 lines)

## Code Examples

[Shows Current (Problematic) vs Proposed (Fixed) code from task file]

---

Shall I proceed with implementing this task using TDD approach?
```

**User:** "Yes"

**Claude Continues:**

```
✅ Updating task status: READY → IN_PROGRESS

Starting TDD implementation...

Phase 1: Write Tests First

Creating unit test for mock query() returning empty array...

test/unit/mocks/mock-dataverse.test.ts
[Writes failing test]

Verifying RED state with Wallaby MCP...
✅ Test fails as expected (RED state confirmed)

Phase 2: Implement Fix

Applying defensive null checks to mock query()...
[Makes implementation changes]

Verifying GREEN state...
✅ Test passes (GREEN state confirmed)

Phase 3: Continue TDD Cycle

[Repeats for remaining tests...]

All tests passing. Running quality checks...

✅ pnpm typecheck → 0 errors
✅ pnpm lint → 0 errors
✅ pnpm test → All passing
✅ pnpm format:check → 0 errors

All acceptance criteria satisfied ✓

Marking task as DONE...

Tasks unblocked:
- T0003 (P1): Add migration mode bidirectional operations

Next recommended task: T0003 (P1)
```

---

## Example 2: Starting Specific Task by ID

**User:** "Start task T0003"

**Claude Response:**

```
I'll use the task-manager skill to select task T0003.

Running selection script with --task-id=T0003...
```

**Script Output:**

```json
{
  "success": true,
  "task": {
    "component": "C02",
    "created": "2025-11-07T01:00:00Z",
    "filePath": "docs/tasks/T0003-add-migration-mode-bidirectional-operations.md",
    "id": "T0003",
    "priority": "P1",
    "status": "READY",
    "title": "Add migration mode bidirectional operations"
  }
}
```

**Claude Continues:**

```
Selected Task: T0003 (P1)
Title: Add migration mode bidirectional operations

[Loads and displays task context...]

Ready to implement. Shall I proceed?
```

---

## Example 3: Listing Ready Tasks

**User:** "What tasks are ready?"

**Claude Response:**

```
I'll use the task-manager skill to list all ready tasks.

Running selection script with --show-ready...
```

**Script Output:**

```json
{
  "message": "Found 3 ready tasks",
  "readyTasks": [
    {
      "component": "C01",
      "id": "T0001",
      "priority": "P0",
      "title": "Fix query execution error in ContactRepository.findByName()"
    },
    {
      "component": "C02",
      "id": "T0003",
      "priority": "P1",
      "title": "Add migration mode bidirectional operations"
    },
    {
      "component": "C03",
      "id": "T0008",
      "priority": "P2",
      "title": "Refactor CSV parser error handling"
    }
  ],
  "success": true
}
```

**Claude Continues:**

```
Ready Tasks (3):

P0 (Critical Path):
- T0001: Fix query execution error in ContactRepository.findByName()
  Component: C01 (Data Layer)

P1 (High Priority):
- T0003: Add migration mode bidirectional operations
  Component: C02 (Migration Orchestration)

P2 (Medium Priority):
- T0008: Refactor CSV parser error handling
  Component: C03 (CSV Processing)

Recommendation: Start with T0001 (P0) for maximum impact.

Would you like to start T0001?
```

---

## Example 4: No Ready Tasks Available

**User:** "What should I work on next?"

**Claude Response:**

```
I'll use the task-manager skill to find the next task.

Running selection script...
```

**Script Output:**

```json
{
  "error": "No READY tasks found",
  "message": "All tasks are either TODO, IN_PROGRESS, or DONE",
  "success": false
}
```

**Claude Continues:**

```
No tasks are currently READY.

Analyzing task statuses...

IN_PROGRESS (1):
- T0001: Fix query execution error (Started: 2025-11-07)

TODO (2):
- T0005: Add rollback mechanism
  Blocked by: T0001 (IN_PROGRESS)
- T0007: Implement batch processing
  Blocked by: T0001 (IN_PROGRESS), T0003 (TODO)

DONE (5):
[Lists completed tasks]

Recommendation:
Complete T0001 (currently in progress) to unblock T0005 and T0007.

Would you like to continue working on T0001?
```

---

## Example 5: Task Already In Progress

**User:** "Start T0001"

**Script Output:**

```json
{
  "error": "Task T0001 is not READY (current status: IN_PROGRESS)",
  "message": "Only READY tasks can be started",
  "success": false,
  "task": {
    "id": "T0001",
    "status": "IN_PROGRESS",
    "title": "Fix query execution error"
  }
}
```

**Claude Response:**

```
Task T0001 is already IN_PROGRESS.

Options:
1. Continue working on T0001
2. Mark T0001 as DONE (if completed)
3. Reset T0001 to READY (if need to restart)
4. Select a different ready task

What would you like to do?
```

**User:** "Continue working on it"

**Claude:**

```
Loading T0001 context...

Task: T0001 - Fix query execution error
Status: IN_PROGRESS

Current progress:
- [x] Unit tests written
- [x] Mock query() fixed
- [ ] findByName() validation added
- [ ] Special character handling
- [ ] E2E testing

Remaining work:
1. Add input validation to findByName()
2. Implement quote escaping
3. Run E2E test with 100 rows

Let's continue with step 1: Adding input validation...
```

---

## Example 6: Marking Task as Done

**User:** "Mark T0001 as done"

**Claude Response:**

```
I'll verify completion criteria for T0001 before marking as DONE.

Running validation checks...

Quality Checks:
✅ pnpm typecheck → 0 errors
✅ pnpm lint → 0 errors
✅ pnpm test → All passing (10/10)
✅ pnpm format:check → 0 errors

Acceptance Criteria:
✅ Mock query() returns empty array
✅ findByName() returns null when no contacts found
✅ Filter string parsing handles special characters
✅ All 100 test CSV rows process successfully
✅ Integration test validates mock query behavior

All criteria satisfied! Marking task as DONE...

✅ Updated task status: IN_PROGRESS → DONE
✅ Added completion timestamp: 2025-11-07T14:30:00Z

Tasks Unblocked:
- T0005 (P1): Add rollback mechanism (TODO → READY)
- T0007 (P2): Implement batch processing (still blocked by T0003)

Summary:
- Duration: 3.5 hours (estimated: 4h)
- Files modified: 2
- Tests added: 5 unit, 2 integration
- Quality checks: All passing

Next Recommended Task:
T0005 (P1) - Add rollback mechanism

Would you like to start T0005?
```

---

## Example 7: TDD Enforcement

**User:** "Let me implement the fix for the mock query method"

**Claude Response:**

```
⚠️ STOP: Tests must be written FIRST (TDD approach)

Before implementing, we need to:
1. Write failing test (RED state)
2. Verify test fails
3. Then implement code (GREEN state)

Let's write the test first:

test/unit/mocks/mock-dataverse.test.ts:

describe('MockDataverseService.query()', () => {
  it('should return empty array when no results match filter', async () => {
    const mockService = new MockDataverseService()

    const results = await mockService.query('contacts', {
      filter: "firstname eq 'NonExistent'"
    })

    expect(results).toEqual([])
  })
})

Verifying this test FAILS (RED state)...
[Uses Wallaby MCP to check]

✅ Test fails as expected: "Query operation failed"

Now we can implement the fix to make this test pass.

Shall I proceed with the implementation?
```

---

## Example 8: Handling Script Failure

**User:** "Start next task"

**Claude Response:**

```
I'll use the task-manager skill to select the next task.

Running selection script...

Error: Script execution failed
Cause: Node.js not found in PATH

Falling back to manual selection algorithm...

[Reads @SELECTION.md]

Manually scanning docs/tasks/ directory...

Found 8 task files.

Filtering by status: READY...
Found 2 READY tasks.

Sorting by priority...
P0 tasks: 1
P1 tasks: 1

Selected: T0001 (P0)
Title: Fix query execution error
File: docs/tasks/T0001-fix-query-execution-error-findbyname.md

[Continues with normal task loading...]
```

---

## Example 9: Complex Dependency Resolution

**User:** "Why isn't T0007 ready?"

**Claude Response:**

```
Let me analyze task T0007's dependencies...

Task: T0007 - Implement batch processing
Current Status: TODO
Priority: P2

Dependencies (Blocked By):
- T0001: Fix query execution error (Status: IN_PROGRESS)
- T0003: Add migration mode bidirectional (Status: TODO)

T0007 cannot become READY until BOTH dependencies are DONE.

Current blocker analysis:
1. T0001 (IN_PROGRESS):
   - Currently being worked on
   - Expected completion: Today
   - Blocking: T0005, T0007

2. T0003 (TODO):
   - Waiting for dependencies
   - Blocked by: T0002 (IN_PROGRESS)
   - Cannot start until T0002 is DONE

Dependency chain:
T0002 → T0003 → T0007

Recommendation:
1. Complete T0001 (in progress now)
2. Complete T0002 (next)
3. Then T0003 becomes READY
4. Complete T0003
5. Then T0007 becomes READY

Estimated time until T0007 is READY: 8-12 hours

Would you like to focus on T0001 to start unblocking the chain?
```

---

## Example 10: Quality Check Failure Handling

**User:** "I think I'm done with T0001"

**Claude Response:**

```
Let me verify T0001 is ready for completion...

Running quality checks...

✅ pnpm typecheck → 0 errors
❌ pnpm lint → 2 errors found
✅ pnpm test → All passing
✅ pnpm format:check → 0 errors

Lint Errors:
src/lib/mocks/mock-dataverse.ts:45:5
  error: 'error' is defined but never used  @typescript-eslint/no-unused-vars

src/lib/mocks/mock-dataverse.ts:67:3
  error: Empty catch block  sonarjs/no-ignored-exceptions

⚠️ Cannot mark as DONE until all quality checks pass.

Applying fixes...

Fix 1: Prefix unused catch variable with underscore
- catch (error) { }
+ catch (_error) { }

Fix 2: Add comment to empty catch block
+ catch (_error) {
+   // Safe to ignore - cleanup operation
+ }

Re-running lint...
✅ pnpm lint → 0 errors

All quality checks now passing!

Verifying acceptance criteria...
[Checks all AC items]

✅ Ready to mark as DONE. Shall I proceed?
```

---

## Key Takeaways from Examples

1. **Script-first approach** saves tokens and provides structured output
2. **Fallback to manual algorithm** when script fails
3. **TDD strictly enforced** - tests always written first
4. **Quality checks mandatory** before marking DONE
5. **Dependency analysis** helps understand task readiness
6. **Clear status updates** keep user informed
7. **Unblocking visualization** shows impact of completing tasks
8. **Next task recommendations** maintain flow
9. **Error handling** provides actionable solutions
10. **Context loading** gives complete picture before starting

These examples demonstrate the skill's systematic approach to managing the complete task lifecycle.
