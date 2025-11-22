# Validation & Quality Checks

This document defines the complete validation procedure required before marking a task as DONE.

## Core Principle: All Checks Must Pass

**⚠️ CRITICAL**: A task cannot be marked DONE unless ALL quality checks pass. No exceptions.

**Quality Gate Process:**

```
1. Run Type Check → Must pass
   ↓
2. Run Linter → Must pass
   ↓
3. Run Test Suite → Must pass
   ↓
4. Run Format Check → Must pass
   ↓
5. Verify Acceptance Criteria → All checked
   ↓
6. Mark Task DONE
```

## Quality Check Commands

### Check 1: Type Safety

**Command:**

```bash
pnpm typecheck
```

**What it validates:**

- No TypeScript compilation errors
- All types correctly inferred or annotated
- No `any` types without justification
- Override modifiers present where needed
- Import paths correct with `.js` extensions

**Expected output:**

```
✓ Type checking complete (0 errors)
```

**If errors found:**

```
src/lib/mocks/mock-dataverse.ts:45:12 - error TS2532: Object is possibly 'undefined'.
src/lib/dynamics/contact-repository.ts:92:5 - error TS4114: This member must have an 'override' modifier.
```

**Resolution:**

1. Review error messages and file/line references
2. Apply patterns from `.claude/rules/typescript-patterns-condensed.md`
3. Fix each error one at a time
4. Re-run `pnpm typecheck` until 0 errors

### Check 2: Code Linting

**Command:**

```bash
pnpm lint
```

**What it validates:**

- ESLint rules compliance
- No unused variables (except `_error`)
- No empty catch blocks (without underscore)
- No non-null assertions without guards
- Consistent code style
- SonarJS quality rules

**Expected output:**

```
✓ Linting complete (0 errors, 0 warnings)
```

**If errors found:**

```
src/lib/mocks/mock-dataverse.ts
  45:5  error  'error' is defined but never used  @typescript-eslint/no-unused-vars
  67:3  error  Empty catch block                  sonarjs/no-ignored-exceptions
```

**Resolution:**

1. For unused catch variables: prefix with underscore `_error`
2. For empty catch blocks: add comment or handle error
3. For other errors: apply fix suggested by linter
4. Re-run `pnpm lint` until 0 errors

### Check 3: Test Suite

**Command:**

```bash
pnpm test
```

**What it validates:**

- All unit tests passing
- All integration tests passing
- No skipped tests (`test.skip`)
- No focused tests (`test.only`)
- Test coverage adequate

**Expected output:**

```
✓ tests/unit/mocks/mock-dataverse.test.ts (3 tests)
✓ tests/unit/dynamics/contact-repository.test.ts (5 tests)
✓ tests/integration/contact-service.test.ts (2 tests)

Test Files  3 passed (3)
     Tests  10 passed (10)
  Start at  10:30:00
  Duration  1.25s
```

**If tests fail:**

```
FAIL tests/unit/mocks/mock-dataverse.test.ts
  ● MockDataverseService.query() › should return empty array

    Expected: []
    Received: Error: Query failed

      at MockDataverseService.query (src/lib/mocks/mock-dataverse.ts:45:12)
```

**Resolution:**

1. Identify failing test and error message
2. Use Wallaby MCP to debug:
   ```bash
   mcp__wallaby__wallaby_testById --id="test-id"
   ```
3. Fix implementation to make test pass
4. Verify with Wallaby that test is now GREEN
5. Re-run full suite: `pnpm test`

### Check 4: Code Formatting

**Command:**

```bash
pnpm format:check
```

**What it validates:**

- Prettier formatting applied consistently
- Proper indentation (2 spaces)
- Line length under 100 characters
- Consistent quote style (single quotes)
- Trailing commas where appropriate

**Expected output:**

```
✓ All files formatted correctly
```

**If formatting issues found:**

```
src/lib/mocks/mock-dataverse.ts
src/lib/dynamics/contact-repository.ts
```

**Resolution:**

```bash
# Auto-fix formatting
pnpm format

# Or format specific files
pnpm prettier --write src/lib/mocks/mock-dataverse.ts

# Re-check
pnpm format:check
```

## Acceptance Criteria Validation

**After all quality checks pass, verify acceptance criteria:**

### Step 1: Read Task File AC Section

```bash
grep -A20 "^## Acceptance Criteria" docs/tasks/T0001-*.md
```

Example:

```markdown
## Acceptance Criteria

- [x] Mock query() returns empty array [] when no contacts match filter
- [x] findByName() returns null when no contacts found
- [x] Filter string parsing handles special characters safely
- [ ] All 100 test CSV rows process successfully
- [ ] Integration test validates mock query behavior
```

### Step 2: Verify Each Criterion

**For each unchecked item:**

1. **Manually test** the criterion
2. **Verify behavior** matches expectation
3. **Update task file** to check the box

**Example verification for AC4:**

```bash
# Run migration with 100 rows
USE_FIXTURES=true npx tsx src/cli.ts migrate referrals \
  --csv=worker \
  --dry-run \
  --limit=100

# Expected: All 100 succeed
# Actual: ✅ All 100 processed, 0 errors

# Check the box in task file
sed -i '' 's/- \[ \] All 100 test CSV rows/- [x] All 100 test CSV rows/' \
  docs/tasks/T0001-*.md
```

### Step 3: Ensure All Boxes Checked

```bash
# Verify no unchecked boxes remain
grep "- \[ \]" docs/tasks/T0001-*.md

# Should return no results (exit code 1)
# If any results, those AC items are not yet satisfied
```

## E2E Validation (If Required)

**For tasks requiring end-to-end testing:**

### Manual CLI Testing

```bash
# Example from task file verification section
USE_FIXTURES=true npx tsx src/cli.ts migrate referrals \
  --csv=worker \
  --dry-run \
  --limit=100
```

**Monitor for:**

- ✅ No errors or exceptions
- ✅ Expected output format
- ✅ Performance acceptable
- ✅ Logs show correct behavior

### Live Mode Testing (If Applicable)

**Only if task requires real Azure services:**

```bash
# Switch to live mode
# Edit .env.local: USE_FIXTURES=false

# Run same command
npx tsx src/cli.ts migrate referrals \
  --csv=worker \
  --dry-run \
  --limit=10  # Start small

# Verify:
# - Real API calls succeed
# - Data written correctly
# - No authentication errors
# - Rollback on failure works
```

**⚠️ CAUTION**: Live mode connects to real services. Use small limits first.

## Regression Testing

**Verify no existing functionality broken:**

### Step 1: Run Full Test Suite

```bash
pnpm test
```

**All tests must pass**, including tests not related to your changes.

### Step 2: Check Related Components

**From task file Regression Risk section:**

```markdown
## Regression Risk

**Blast Radius:**

- All contact creation operations during migration
- Any code path using ContactRepository.findByName()
- Potentially affects other repository findByX() methods
```

**Verify each component:**

```bash
# Test all repository findBy methods
pnpm test tests/unit/dynamics/*-repository.test.ts

# Test contact-related integration tests
pnpm test tests/integration/contact-*.test.ts

# Test full migration pipeline
pnpm test tests/integration/migration-pipeline.test.ts
```

### Step 3: Manual Smoke Testing

**Run common operations:**

```bash
# List tasks
npx tsx src/cli.ts --help

# Validate CSV (dry-run)
USE_FIXTURES=true npx tsx src/cli.ts migrate referrals \
  --csv=worker \
  --dry-run \
  --limit=5

# Check other CLI commands still work
npx tsx src/cli.ts validate relationships worker
```

## Pre-Completion Checklist

**Before updating task status to DONE, verify:**

### Code Quality

- [ ] `pnpm typecheck` → 0 errors
- [ ] `pnpm lint` → 0 errors
- [ ] `pnpm test` → All passing
- [ ] `pnpm format:check` → 0 errors
- [ ] No `console.log` statements left in code
- [ ] No commented-out code blocks
- [ ] No TODO comments without ticket reference

### Acceptance Criteria

- [ ] All AC items checked in task file
- [ ] Each AC manually verified
- [ ] E2E validation completed (if required)
- [ ] Live mode tested (if applicable)

### Testing

- [ ] Unit tests written and passing
- [ ] Integration tests written and passing
- [ ] E2E tests completed (manual or automated)
- [ ] Regression tests passing
- [ ] Wallaby MCP confirms coverage

### Documentation

- [ ] Code comments added where needed
- [ ] Complex logic explained
- [ ] Task file updated with completion notes
- [ ] Related docs updated (if applicable)

### Regression Prevention

- [ ] No existing tests broken
- [ ] Related components validated
- [ ] Smoke testing completed
- [ ] Blast radius components checked

## Task Completion Procedure

**Only after ALL checks pass:**

### Step 1: Update Task Status

```bash
# Edit task file
vi docs/tasks/T0001-fix-query-execution-error-findbyname.md

# Change frontmatter:
# status: IN_PROGRESS
#     ↓
# status: DONE
```

**Or use sed:**

```bash
sed -i '' 's/^status: IN_PROGRESS$/status: DONE/' \
  docs/tasks/T0001-*.md
```

### Step 2: Add Completion Timestamp

Add to task file frontmatter:

```yaml
completed: 2025-11-07T14:30:00Z
```

### Step 3: Update Dependencies

**Find tasks blocked by this one:**

```bash
# Search for tasks that list T0001 in "Blocked By"
grep -l "Blocked By:.*T0001" docs/tasks/T*.md
```

**For each blocked task:**

1. Remove T0001 from Blocked By list
2. If no blockers remain, update status to READY:
   ```bash
   sed -i '' 's/^status: TODO$/status: READY/' docs/tasks/T0003-*.md
   ```

### Step 4: Report Completion

**Show user:**

```
✅ Task T0001 completed successfully!

Summary:
- Duration: 3.5 hours (estimated: 4h)
- Files modified: 2
- Tests added: 5 unit, 2 integration
- Lines changed: +50, -20
- Quality checks: All passing

Acceptance Criteria (5/5):
✅ Mock query() returns empty array
✅ findByName() returns null when no contacts found
✅ Filter string parsing handles special characters
✅ All 100 test CSV rows process successfully
✅ Integration test validates mock query behavior

Tasks Unblocked:
- T0003 (P1): Add migration mode bidirectional operations
- T0015 (P2): Update contact lookup documentation

Next Recommended Task:
T0003 (P1) - Add migration mode bidirectional operations
```

### Step 5: Commit Changes

**If task completion warrants a commit:**

```bash
git add -A
git commit -m "fix(contact-repository): handle empty query results safely

- Add null checks to mock query() method
- Escape single quotes in filter strings
- Return empty array instead of throwing on error

Resolves: T0001
Closes: #123"
```

## Quality Check Failures - Troubleshooting

### TypeScript Errors Don't Resolve

**Symptoms:**

- Fix applied but error persists
- Error in different file than edited
- Cascading errors

**Actions:**

1. Clean build: `rm -rf dist/ && pnpm typecheck`
2. Restart IDE/editor TypeScript server
3. Check import paths are correct
4. Verify all dependencies installed: `pnpm install`

### Tests Fail Intermittently

**Symptoms:**

- Tests pass locally, fail in CI
- Tests pass first run, fail second run
- Random failures

**Actions:**

1. Check for test interdependencies (shared state)
2. Add proper cleanup in `afterEach` hooks
3. Use Wallaby to identify timing issues
4. Check for resource leaks (timers, listeners)

### Linter Conflicts with Prettier

**Symptoms:**

- `pnpm lint` fails after `pnpm format`
- Formatting changes rejected by linter

**Actions:**

1. Verify Prettier and ESLint configs compatible
2. Run both in order: `pnpm format && pnpm lint`
3. Check for conflicting rules in `.eslintrc`
4. Disable conflicting ESLint rule if Prettier correct

### Acceptance Criteria Ambiguous

**Symptoms:**

- Unclear what "done" means for an AC item
- AC seems satisfied but feels incomplete

**Actions:**

1. Re-read task Description section for context
2. Check Code Examples for expected behavior
3. Review Testing Requirements for validation approach
4. Ask user for clarification if truly ambiguous

## Validation Success Metrics

**After validation, you should have:**

- ✅ 0 TypeScript errors
- ✅ 0 ESLint errors
- ✅ 100% test pass rate
- ✅ 0 formatting violations
- ✅ All acceptance criteria checked
- ✅ E2E validation completed
- ✅ No regressions introduced
- ✅ Task status updated to DONE
- ✅ Dependent tasks unblocked
- ✅ User informed of completion

**Proceed to next task on critical path!**
