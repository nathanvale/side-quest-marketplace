# Implementation Guidance & TDD Workflow

This document provides comprehensive guidance for implementing tasks using Test-Driven Development
(TDD) with Wallaby MCP integration.

## Core Principle: Tests First, Always

**⚠️ CRITICAL RULE**: This skill **enforces** Test-Driven Development. You MUST write tests BEFORE
implementing code. Code-first approaches will be rejected.

**TDD Cycle:**

```
1. Write Test (RED)
   ↓
2. Run Test → Verify Failure
   ↓
3. Implement Minimal Code (GREEN)
   ↓
4. Run Test → Verify Pass
   ↓
5. Refactor (keep GREEN)
   ↓
6. Repeat for next test
```

## Phase-by-Phase Implementation Guide

### Phase 1: Analyze Task Context

**From task file, extract:**

1. **Problem statement** (Description section)
   - What is broken or missing?
   - Why does it need to be fixed?
   - What is the root cause?

2. **Acceptance criteria** (checklist items)
   - What defines "done"?
   - How will success be measured?

3. **Implementation steps** (ordered sequence)
   - What code changes are needed?
   - Which files require modification?
   - What is the recommended approach?

4. **Test requirements** (test matrix table)
   - What tests are required?
   - Which acceptance criteria does each test validate?
   - What is the test execution order?

5. **Code examples** (Current vs Proposed)
   - What does the current code look like?
   - What should the fixed code look like?
   - What are the key differences?

6. **Regression risk** (impact analysis)
   - What could break?
   - How large is the blast radius?
   - What are the testing gaps?

**Present summary to user:**

```
Task: T0001 - Fix query execution error
Priority: P0 (Critical Path)
Component: C01 (Data Layer / Repositories)
Effort: 4 hours

Problem: Mock query() throws error instead of returning []
Impact: 100% failure rate in referral migration
Root Cause: Missing null checks in mock implementation

Files to Modify:
- src/lib/mocks/mock-dataverse.ts (30 lines)
- src/lib/dynamics/contact-repository.ts (20 lines)

Tests Required:
1. Unit test: Mock query returns [] for empty results
2. Unit test: findByName handles special characters
3. Integration test: End-to-end with 100 CSV rows

Acceptance Criteria: 5 items to validate
```

### Phase 2: Plan Test Strategy

**Extract from Testing Requirements table:**

| Test Type   | Validates AC | Description                             | Location                                         |
| ----------- | ------------ | --------------------------------------- | ------------------------------------------------ |
| Unit        | AC1, AC2     | Mock query returns [] for empty results | `tests/unit/mocks/mock-dataverse.test.ts`        |
| Unit        | AC3          | findByName handles special characters   | `tests/unit/dynamics/contact-repository.test.ts` |
| Integration | AC4, AC5     | End-to-end migration with 100 CSV rows  | Manual: CLI command with --limit=100             |

**TDD Execution Order:**

1. **Unit tests first** (fastest, most isolated)
2. **Integration tests second** (cross-component)
3. **E2E tests last** (slowest, most comprehensive)

**For each test:**

- Identify test file location
- Write test before any implementation
- Verify test fails (RED state)
- Only then implement code

### Phase 3: Write Tests (RED State)

**For EACH test in the matrix:**

#### Step 3.1: Check Test File Exists

```bash
# Check if test file exists
ls tests/unit/mocks/mock-dataverse.test.ts

# If not, create test file structure
mkdir -p tests/unit/mocks
touch tests/unit/mocks/mock-dataverse.test.ts
```

#### Step 3.2: Write Failing Test

**Example from T0001:**

```typescript
// tests/unit/mocks/mock-dataverse.test.ts
import { describe, it, expect } from "vitest";
import { MockDataverseService } from "../../../src/lib/mocks/mock-dataverse";

describe("MockDataverseService.query()", () => {
  it("should return empty array when no results match filter", async () => {
    const mockService = new MockDataverseService();

    // Execute query with filter that matches nothing
    const results = await mockService.query("contacts", {
      filter: "firstname eq 'NonExistent' and lastname eq 'User'",
    });

    // Assert: should return [] not throw error
    expect(results).toEqual([]);
    expect(results).toHaveLength(0);
  });

  it("should handle special characters in filter without throwing", async () => {
    const mockService = new MockDataverseService();

    // Execute query with single quote (O'Brien)
    const results = await mockService.query("contacts", {
      filter: "firstname eq 'O''Brien' and lastname eq 'Smith'",
    });

    // Should not throw, should return []
    expect(results).toEqual([]);
  });
});
```

#### Step 3.3: Run Test - Verify RED

**Use Wallaby MCP to verify test fails:**

```bash
# Option 1: Check all failing tests
mcp__wallaby__wallaby_failingTests

# Option 2: Check tests for specific file
mcp__wallaby__wallaby_allTestsForFile \
  --file="tests/unit/mocks/mock-dataverse.test.ts"
```

**Expected output (RED state):**

```json
{
  "failingTests": [
    {
      "error": "Expected [] but received Error: Query failed",
      "id": "tests/unit/mocks/mock-dataverse.test.ts:5",
      "name": "should return empty array when no results match filter"
    }
  ]
}
```

**✅ ONLY proceed to implementation if test FAILS**

**❌ If test passes without implementation, the test is wrong**

### Phase 4: Implement Code (GREEN State)

**Now that test is RED, implement the fix:**

#### Step 4.1: Apply Code Changes

Follow Implementation Steps from task file.

**Example from T0001:**

```typescript
// src/lib/mocks/mock-dataverse.ts (BEFORE)
async query<T = any>(entityLogicalName: string, options: QueryOptions = {}): Promise<T[]> {
  let results = entityDataMap[entityLogicalName] ?? []

  // ❌ No null check - crashes if filter is undefined
  if (options.filter) {
    const filterValue = options.filter
    results = results.filter((record) => {
      return JSON.stringify(record).toLowerCase().includes(filterValue.toLowerCase())
    })
  }

  return results as T[]
}
```

```typescript
// src/lib/mocks/mock-dataverse.ts (AFTER - Fixed)
async query<T = any>(entityLogicalName: string, options: QueryOptions = {}): Promise<T[]> {
  try {
    let results = entityDataMap[entityLogicalName] ?? []

    // ✅ Null check and type validation
    if (options?.filter && typeof options.filter === 'string') {
      const filterValue = options.filter
      results = results.filter((record) => {
        try {
          return JSON.stringify(record).toLowerCase().includes(filterValue.toLowerCase())
        } catch {
          return false  // ✅ Safe fallback
        }
      })
    }

    return results as T[]
  } catch (error) {
    console.error(`Query error:`, error)
    return []  // ✅ Return empty array instead of throwing
  }
}
```

#### Step 4.2: Run Test - Verify GREEN

**Use Wallaby MCP to verify test passes:**

```bash
# Check test status
mcp__wallaby__wallaby_testById \
  --id="tests/unit/mocks/mock-dataverse.test.ts:5"
```

**Expected output (GREEN state):**

```json
{
  "test": {
    "duration": 15,
    "id": "tests/unit/mocks/mock-dataverse.test.ts:5",
    "name": "should return empty array when no results match filter",
    "status": "passed"
  }
}
```

**✅ Test passes → Code is correct**

#### Step 4.3: Check Coverage

```bash
mcp__wallaby__wallaby_coveredLinesForFile \
  --file="src/lib/mocks/mock-dataverse.ts"
```

**Review uncovered lines** and add tests if needed.

### Phase 5: Refactor (Keep GREEN)

**Now that tests pass, improve code quality:**

1. **Remove duplication**
2. **Improve naming**
3. **Extract helper functions**
4. **Apply TypeScript patterns** from `.claude/rules/typescript-patterns-condensed.md`

**Example refactoring:**

```typescript
// Extract filter logic to helper
private applyFilter<T>(records: T[], filterValue: string): T[] {
  return records.filter((record) => {
    try {
      return JSON.stringify(record).toLowerCase().includes(filterValue.toLowerCase())
    } catch {
      return false
    }
  })
}

async query<T = any>(entityLogicalName: string, options: QueryOptions = {}): Promise<T[]> {
  try {
    let results = entityDataMap[entityLogicalName] ?? []

    if (options?.filter && typeof options.filter === 'string') {
      results = this.applyFilter(results, options.filter)
    }

    return results as T[]
  } catch (error) {
    console.error(`Query error:`, error)
    return []
  }
}
```

**After each refactoring:**

```bash
# Verify tests still pass
mcp__wallaby__wallaby_allTestsForFile \
  --file="tests/unit/mocks/mock-dataverse.test.ts"
```

**Tests must stay GREEN during refactoring!**

### Phase 6: Repeat for Next Test

**Cycle through all tests in the matrix:**

1. Write next test (Unit Test #2)
2. Verify RED
3. Implement code
4. Verify GREEN
5. Refactor
6. Repeat for Integration tests
7. Repeat for E2E tests

## TypeScript Quality Patterns

**Apply patterns from `.claude/rules/typescript-patterns-condensed.md`:**

### Pattern 1: Array Access Safety

```typescript
// ❌ WRONG
const first = results[0].property;

// ✅ CORRECT
if (results.length > 0) {
  const first = results[0].property;
}
// OR
expect(results).toHaveLength(1);
const first = results[0]!.property; // Safe after length check
```

### Pattern 2: Null/Undefined Handling

```typescript
// ❌ WRONG
function process(value: string | undefined) {
  return value.toUpperCase(); // Crash if undefined!
}

// ✅ CORRECT
function process(value: string | undefined): string {
  return value?.toUpperCase() ?? "DEFAULT";
}
```

### Pattern 3: Error Handling

```typescript
// ❌ WRONG
catch (error) { }  // Unused variable

// ✅ CORRECT
catch (_error) { }  // Underscore = intentional suppression
// OR
catch (error) {
  logger.error('Operation failed', error)
}
```

### Pattern 4: Override Modifiers

```typescript
// ❌ WRONG
class MyRepository extends DataverseRepository {
  mapDto(data: any): MyDto {} // Missing override
}

// ✅ CORRECT
class MyRepository extends DataverseRepository {
  override mapDto(data: any): MyDto {}
}
```

### Pattern 5: Quote Escaping (SQL/OData)

```typescript
// ❌ WRONG - SQL injection vulnerable
const filter = `firstname eq '${firstName}'`; // Breaks with O'Brien

// ✅ CORRECT - Escape single quotes
const safeFirstName = firstName.replace(/'/g, "''");
const filter = `firstname eq '${safeFirstName}'`;
```

## Acceptance Criteria Tracking

**As you implement, check off AC items:**

```markdown
## Acceptance Criteria

- [x] Mock query() returns empty array [] when no contacts match filter
- [x] findByName() returns null when no contacts found (no exception thrown)
- [x] Filter string parsing handles special characters and quotes safely
- [ ] All 100 test CSV rows process successfully without errors
- [ ] Integration test validates mock query behavior matches expected contract
```

**Update task file** after each AC is satisfied.

## Integration Testing

**For integration tests (cross-component):**

```bash
# Run specific integration test
pnpm test tests/integration/contact-service.test.ts

# Or run full integration suite
pnpm test:integration
```

**Example integration test from T0001:**

```typescript
// tests/integration/contact-service.test.ts
describe("Contact Service Integration", () => {
  it("should handle contact lookup with no results gracefully", async () => {
    const service = new ContactService(mockDataverse, mockLogger);

    // Lookup non-existent contact
    const result = await service.findByName("NonExistent", "User");

    // Should return null, not throw
    expect(result).toBeNull();
    expect(mockLogger.errors).toHaveLength(0);
  });
});
```

## E2E Testing (Manual CLI)

**For end-to-end validation:**

```bash
# From task file verification section
USE_FIXTURES=true npx tsx src/cli.ts migrate referrals \
  --csv=worker \
  --dry-run \
  --limit=100

# Expected: All 100 rows succeed, no errors
```

**Monitor output for:**

- ✅ All rows processed successfully
- ✅ No DATAVERSE_QUERY_FAILED errors
- ✅ Explosion ratio: 1 CSV row → 9 Dataverse records
- ✅ Performance acceptable (< 60 seconds for 100 rows)

## Common Implementation Mistakes

### Mistake 1: Implementing Before Testing

**❌ WRONG:**

```
1. Write code first
2. Then write tests to verify
```

**✅ CORRECT:**

```
1. Write test first (fails)
2. Write minimal code (passes)
3. Refactor
```

### Mistake 2: Writing Too Much Code at Once

**❌ WRONG:**

```
1. Write all implementation
2. Run all tests
3. Debug failures
```

**✅ CORRECT:**

```
1. Write ONE test
2. Write MINIMAL code to pass
3. Verify GREEN
4. Move to next test
```

### Mistake 3: Not Using Wallaby MCP

**❌ WRONG:**

```
# Run tests manually
pnpm test
```

**✅ CORRECT:**

```
# Use Wallaby MCP for real-time feedback
mcp__wallaby__wallaby_failingTests
mcp__wallaby__wallaby_testById --id="test-id"
```

### Mistake 4: Skipping Refactoring

**❌ WRONG:**

```
1. Write test
2. Make it pass
3. Move to next test (never refactor)
```

**✅ CORRECT:**

```
1. Write test (RED)
2. Make it pass (GREEN)
3. Refactor (keep GREEN)
4. Move to next test
```

### Mistake 5: Ignoring Code Examples

**❌ WRONG:**

```
Read task, implement from scratch
```

**✅ CORRECT:**

```
1. Read Code Examples section
2. Compare Current vs Proposed
3. Apply patterns from examples
4. Test against acceptance criteria
```

## Implementation Checklist

Before marking task as done, verify:

- [ ] All tests written BEFORE implementation
- [ ] All tests verified RED before implementing
- [ ] All tests GREEN after implementation
- [ ] Refactoring completed (no duplication)
- [ ] TypeScript patterns applied correctly
- [ ] All acceptance criteria checked
- [ ] Code examples from task file applied
- [ ] Integration tests passing
- [ ] E2E validation completed
- [ ] Wallaby MCP confirms full coverage
- [ ] No regression in existing tests

## Proceeding to Validation

Once implementation is complete and all tests pass, proceed to **@VALIDATION.md** for quality checks
and task completion procedures.
