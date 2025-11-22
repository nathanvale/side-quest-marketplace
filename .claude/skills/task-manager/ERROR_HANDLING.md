# Error Handling & Troubleshooting

This document covers common error scenarios encountered during task management and their
resolutions.

## Error Categories

1. **Selection Errors** - Problems finding/choosing tasks
2. **Context Loading Errors** - Issues reading task files
3. **Implementation Errors** - Problems during development
4. **Validation Errors** - Quality check failures
5. **Dependency Errors** - Blocked task issues

---

## Selection Errors

### Error 1.1: Script Execution Failure

**Symptoms:**

```bash
$ pnpm tsx ~/.claude/skills/task-manager/select-task.ts
Error: Cannot find module 'fs'
```

**Causes:**

- Node.js not installed
- Script not found
- Permissions issue

**Resolution:**

```bash
# Verify Node.js installed
node --version  # Should show v18+

# Verify script exists
ls -la ~/.claude/skills/task-manager/select-task.ts

# Fix permissions
chmod +x ~/.claude/skills/task-manager/select-task.ts

# Try again
pnpm tsx ~/.claude/skills/task-manager/select-task.ts
```

**Fallback:** Use @SELECTION.md manual algorithm

---

### Error 1.2: No Ready Tasks Found

**Symptoms:**

```json
{
  "error": "No READY tasks found",
  "message": "All tasks are either TODO, IN_PROGRESS, or DONE",
  "success": false
}
```

**Causes:**

- All tasks have unmet dependencies (TODO)
- All tasks already in progress
- All tasks completed

**Resolution:**

```bash
# Check task statuses
grep "^status:" docs/tasks/T*.md

# Find TODO tasks and their blockers
for file in docs/tasks/T*.md; do
  if grep -q "^status: TODO$" "$file"; then
    echo "=== $(basename $file) ==="
    grep -A2 "^## Dependencies" "$file"
  fi
done

# Actions:
# 1. Complete blocking tasks
# 2. Update dependencies if incorrect
# 3. Manually change status to READY if dependencies satisfied
```

---

### Error 1.3: Task File Not Found

**Symptoms:**

```bash
$ pnpm tsx ~/.claude/skills/task-manager/select-task.ts --task-id=T0001
{
  "success": false,
  "error": "Task not found: T0001"
}
```

**Causes:**

- Task ID typo
- Task file deleted or renamed
- Wrong task directory

**Resolution:**

```bash
# List available tasks
ls -1 docs/tasks/T*.md

# Search for task by title
grep -r "T0001" docs/tasks/

# Check if task exists with different ID
grep -l "Fix query execution" docs/tasks/T*.md

# Update task ID or create task file if missing
```

---

### Error 1.4: Task Not Ready (Wrong Status)

**Symptoms:**

```json
{
  "error": "Task T0001 is not READY (current status: IN_PROGRESS)",
  "message": "Only READY tasks can be started",
  "success": false
}
```

**Causes:**

- Task already in progress
- Task completed
- Task dependencies not met (should be TODO)

**Resolution:**

```bash
# Check current status
grep "^status:" docs/tasks/T0001-*.md

# If IN_PROGRESS but should restart:
sed -i '' 's/^status: IN_PROGRESS$/status: READY/' docs/tasks/T0001-*.md

# If DONE but need to revisit:
# DON'T change back to READY - create new task instead

# If TODO, check dependencies:
grep -A2 "^## Dependencies" docs/tasks/T0001-*.md
```

---

## Context Loading Errors

### Error 2.1: Malformed YAML Frontmatter

**Symptoms:**

```
Error parsing task file: YAML syntax error at line 3
```

**Causes:**

- Missing closing `---`
- Invalid YAML syntax
- Incorrect indentation

**Resolution:**

```bash
# Validate YAML frontmatter
python3 << 'EOF'
import yaml
with open('docs/tasks/T0001-fix-query-execution.md') as f:
    content = f.read()
    parts = content.split('---')
    if len(parts) >= 3:
        frontmatter = parts[1]
        try:
            data = yaml.safe_load(frontmatter)
            print("✅ Valid YAML")
            print(data)
        except yaml.YAMLError as e:
            print(f"❌ YAML Error: {e}")
EOF

# Common fixes:
# - Add closing --- if missing
# - Fix indentation (use spaces not tabs)
# - Quote values with special characters
# - Escape single quotes in strings
```

---

### Error 2.2: Missing Required Fields

**Symptoms:**

```
Error: Task file missing required field 'priority'
```

**Causes:**

- Incomplete task file template
- Field name typo
- Field value missing

**Resolution:**

```bash
# Check which fields are present
grep "^[a-z].*:" docs/tasks/T0001-*.md | head -10

# Required fields:
# - id: T0001
# - title: Task description
# - priority: P0/P1/P2/P3
# - component: C01
# - status: TODO/READY/IN_PROGRESS/DONE
# - created: ISO timestamp

# Add missing field to frontmatter:
# Edit file and add before closing ---
```

---

### Error 2.3: Task File Empty or Corrupted

**Symptoms:**

```
Error: Cannot read task file (0 bytes)
```

**Causes:**

- File truncated during write
- Disk full
- Git conflict markers in file

**Resolution:**

```bash
# Check file size
ls -lh docs/tasks/T0001-*.md

# Check for git conflict markers
grep -n "^<<<<<<" docs/tasks/T0001-*.md
grep -n "^======" docs/tasks/T0001-*.md
grep -n "^>>>>>>" docs/tasks/T0001-*.md

# Restore from git if corrupted
git checkout HEAD -- docs/tasks/T0001-*.md

# Or restore from backup/previous commit
git show HEAD~1:docs/tasks/T0001-*.md > docs/tasks/T0001-*.md
```

---

## Implementation Errors

### Error 3.1: Test Not Failing (RED State Not Reached)

**Symptoms:**

- Write test for unimplemented feature
- Test passes immediately
- Expected RED, got GREEN

**Causes:**

- Test is testing wrong thing
- Feature already implemented
- Test has logic error

**Resolution:**

```bash
# Verify test is actually running
mcp__wallaby__wallaby_allTestsForFile \
  --file="tests/unit/mock-dataverse.test.ts"

# Check test assertions
# - Are they testing the right behavior?
# - Are they specific enough?
# - Do they match acceptance criteria?

# Fix test to properly validate unimplemented behavior
# Re-run and verify RED state
```

---

### Error 3.2: Can't Make Test Pass (Stuck on RED)

**Symptoms:**

- Implemented code but test still fails
- Tried multiple approaches
- Unclear why test fails

**Causes:**

- Misunderstanding acceptance criteria
- Test expectation incorrect
- Implementation logic error

**Resolution:**

```bash
# Use Wallaby MCP to debug
mcp__wallaby__wallaby_testById --id="failing-test-id"

# Check test output for specific error
# Review acceptance criteria again
# Compare with Code Examples from task file

# Add logging to implementation
console.log('Actual:', actualValue)
console.log('Expected:', expectedValue)

# Re-run test and analyze difference
```

---

### Error 3.3: Tests Pass But Acceptance Criteria Not Met

**Symptoms:**

- All tests GREEN
- Quality checks pass
- But AC items not satisfied

**Causes:**

- Tests don't validate AC items
- Missing tests for some criteria
- AC items unclear or ambiguous

**Resolution:**

```bash
# Review Testing Requirements table
# Map each test to AC items it validates
# Identify AC items without tests

# Add missing tests:
# 1. Write test for AC item
# 2. Verify RED
# 3. Implement
# 4. Verify GREEN

# For ambiguous AC items:
# - Ask user for clarification
# - Reference task Description section
# - Check Code Examples for expected behavior
```

---

### Error 3.4: Wallaby MCP Tools Not Available

**Symptoms:**

```
Error: mcp__wallaby__wallaby_failingTests not found
```

**Causes:**

- Wallaby MCP not installed
- Wallaby not connected
- Tool name typo

**Resolution:**

```bash
# Check if Wallaby MCP is installed
# Look in Claude Code MCP settings

# Alternative: Use standard test commands
pnpm test                              # Run all tests
pnpm test tests/unit/mock-dataverse.test.ts  # Run specific file
pnpm test --reporter=verbose          # Detailed output

# Install Wallaby MCP if not present:
# Follow Wallaby MCP installation guide
```

---

## Validation Errors

### Error 4.1: TypeScript Errors Won't Clear

**Symptoms:**

```bash
$ pnpm typecheck
src/lib/mocks/mock-dataverse.ts:45:12 - error TS2532
```

**Causes:**

- Type inference failing
- Missing type annotations
- Incorrect type assertions

**Resolution:**

```bash
# Review `.claude/rules/typescript-patterns-condensed.md`
# Apply pattern for specific error code (TS2532, etc.)

# Common fixes:
# - Add null check before access
# - Use optional chaining (?.)
# - Add type assertion with justification
# - Add override modifier for subclass methods

# Re-run after each fix
pnpm typecheck
```

---

### Error 4.2: Linter Errors After Code Changes

**Symptoms:**

```bash
$ pnpm lint
src/lib/mocks/mock-dataverse.ts:45:5 - error unused variable 'error'
```

**Causes:**

- Catch variable not used
- Empty catch block
- Incorrect ESLint disable comment

**Resolution:**

```bash
# Fix unused catch variable
# WRONG: catch (error) { }
# CORRECT: catch (_error) { }

# Fix empty catch block
# WRONG: catch { }
# CORRECT: catch (_error) { } // Safe in cleanup

# Apply lint auto-fixes
pnpm lint:fix

# Re-run
pnpm lint
```

---

### Error 4.3: Tests Fail After Refactoring

**Symptoms:**

- Tests were GREEN
- Refactored code
- Now tests RED

**Causes:**

- Broke functionality during refactor
- Changed API/interface
- Introduced bug

**Resolution:**

```bash
# STOP refactoring immediately
# Git diff to see what changed
git diff src/lib/mocks/mock-dataverse.ts

# Revert to last GREEN state
git checkout -- src/lib/mocks/mock-dataverse.ts

# Re-run tests - should be GREEN
pnpm test

# Re-do refactoring in smaller steps
# Run tests after EACH small change
# Keep tests GREEN throughout refactoring
```

---

### Error 4.4: Acceptance Criteria Incomplete

**Symptoms:**

- All quality checks pass
- But some AC items unchecked
- Can't determine if satisfied

**Causes:**

- AC item requires manual verification
- AC item depends on external system
- AC item unclear how to validate

**Resolution:**

```bash
# For each unchecked AC item:

# 1. Manual testing
# Run the specific command/operation
# Verify behavior matches expectation
# Document result

# 2. External system testing
# If requires live Azure services:
# Switch to live mode
# Run validation with small dataset
# Verify result

# 3. Unclear AC
# Re-read task Description section
# Check Code Examples
# Ask user for clarification if truly ambiguous

# Only check box when 100% confident satisfied
```

---

## Dependency Errors

### Error 5.1: Circular Dependencies Detected

**Symptoms:**

```
Task T0001 blocked by T0005
Task T0005 blocked by T0001
Cannot determine ready tasks
```

**Causes:**

- Incorrect dependency specification
- Task breakdown error
- Misunderstanding of dependencies

**Resolution:**

```bash
# Visualize dependency graph
for file in docs/tasks/T*.md; do
  id=$(grep "^id:" "$file" | cut -d: -f2 | tr -d ' ')
  blocked=$(grep "^**Blocked By:**" "$file" | sed 's/.*By: //')
  echo "$id -> $blocked"
done

# Identify circular dependencies
# Break circle by:
# 1. Re-analyzing which task should come first
# 2. Splitting task into smaller independent tasks
# 3. Removing incorrect dependency

# Update task files to break circle
```

---

### Error 5.2: Dependency Task Not Found

**Symptoms:**

```
Task T0001 blocked by T9999
Task T9999 does not exist
```

**Causes:**

- Task ID typo
- Task deleted without updating dependents
- Task not yet created

**Resolution:**

```bash
# Search for the task
ls docs/tasks/T9999-*.md

# If not found:
# 1. Check if ID typo (T0999 vs T9999)
grep "T9999" docs/tasks/T*.md

# 2. Check git history
git log --all --full-history -- "docs/tasks/T9999-*.md"

# 3. Fix dependency reference
# Edit T0001 task file
# Update "Blocked By: T9999" to correct task or "None"
```

---

### Error 5.3: Task Marked READY But Has Unmet Dependencies

**Symptoms:**

```
Task T0001 status: READY
Task T0001 blocked by T0005
Task T0005 status: IN_PROGRESS (not DONE)
```

**Causes:**

- Task status updated prematurely
- Dependency status not updated
- Manual status change error

**Resolution:**

```bash
# Verify all blocking tasks are DONE
grep "Blocked By:" docs/tasks/T0001-*.md

# For each blocking task, check status
grep "^status:" docs/tasks/T0005-*.md

# If any blocker not DONE:
# Change T0001 back to TODO
sed -i '' 's/^status: READY$/status: TODO/' docs/tasks/T0001-*.md

# Or fix blocker status if incorrect
# Or remove dependency if not actually needed
```

---

## General Troubleshooting

### Debug Mode

Enable verbose logging for more context:

```bash
# TypeScript compilation
pnpm tsc --noEmit --extendedDiagnostics

# Test runner
pnpm test --reporter=verbose

# Linter
pnpm eslint --debug src/file.ts
```

### Reset State

If skill state becomes inconsistent:

```bash
# 1. Verify all task files valid
for file in docs/tasks/T*.md; do
  echo "Checking $file"
  python3 -c "
import yaml
with open('$file') as f:
    content = f.read()
    parts = content.split('---')
    yaml.safe_load(parts[1])
print('  ✅ Valid')
  "
done

# 2. Reset quality checks
pnpm install  # Reinstall dependencies
rm -rf dist/  # Clean build
rm -rf node_modules/.cache  # Clear caches

# 3. Re-run validation
pnpm typecheck && pnpm lint && pnpm test && pnpm format:check
```

### Get Help

If truly stuck:

1. **Re-read task file completely** - Often answer is there
2. **Check Code Examples** - Shows expected vs actual
3. **Review error messages carefully** - Usually specific about problem
4. **Search project for similar code** - Copy working patterns
5. **Ask user for clarification** - Better than guessing
6. **Read @IMPLEMENTATION.md** - Detailed TDD guidance
7. **Read @VALIDATION.md** - Detailed quality check procedures

---

## Error Prevention

### Before Starting Task

- [ ] Verify all dependencies DONE
- [ ] Read complete task file
- [ ] Understand acceptance criteria
- [ ] Review test requirements
- [ ] Check code examples

### During Implementation

- [ ] Write tests first (enforce TDD)
- [ ] Verify RED before implementing
- [ ] Verify GREEN after implementing
- [ ] Run quality checks frequently
- [ ] Commit working code regularly

### Before Marking DONE

- [ ] All quality checks pass
- [ ] All AC items checked
- [ ] E2E validation completed
- [ ] No regressions introduced
- [ ] Documentation updated

By following these error handling procedures and prevention strategies, most issues can be resolved
quickly and systematically.
