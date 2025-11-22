# Task Manager Quick Reference

**Version:** 2.0.0 | **Last Updated:** 2025-11-07

## Quick Start

```bash
# Select next ready task (auto-priority)
pnpm tsx ~/.claude/skills/task-manager/select-task.ts

# Select specific task by ID
pnpm tsx ~/.claude/skills/task-manager/select-task.ts --task-id=T0001

# List all ready tasks
pnpm tsx ~/.claude/skills/task-manager/select-task.ts --show-ready
```

## What This Skill Does

Automates the complete task lifecycle:

1. **Select** next ready task by priority (P0 > P1 > P2 > P3)
2. **Load** complete context from task markdown file
3. **Guide** TDD implementation with Wallaby MCP tools
4. **Validate** with quality checks (typecheck, lint, test, format)
5. **Complete** and unblock dependent tasks

## Activation Phrases

Claude automatically uses this skill when you say:

- "start next task"
- "what should I work on next"
- "show ready tasks"
- "start T0001" (specific task ID)
- "mark T0001 as done"
- "what's the task queue"

## Task File Format

Task files live in `docs/tasks/` with pattern `T####-*.md`:

````markdown
---
id: T0001
title: Fix query execution error
priority: P0
component: C01
status: READY
created: 2025-11-07T00:00:00Z
source: docs/bugs/bug-report.md
---

# T0001: Fix query execution error

## Description

Problem statement...

## Acceptance Criteria

- [ ] Criterion 1
- [ ] Criterion 2

## Implementation Steps

1. Step one...
2. Step two...

## Files to Change

### Files to Modify

- `file.ts:100-120` - Description

## Testing Requirements

| Test Type | Validates AC | Description | Location        |
| --------- | ------------ | ----------- | --------------- |
| Unit      | AC1          | Test desc   | path/to/test.ts |

## Dependencies

**Blocking:** None **Blocked By:** None

## Regression Risk

**Impact:** Description **Blast Radius:** Details

## Code Examples

**Current (Problematic):**

```typescript
// Current code
```
````

**Proposed (Fixed):**

```typescript
// Fixed code
```

## Notes

Additional context...

```

## Task Status Flow

```

TODO → READY → IN_PROGRESS → DONE

````

- **TODO**: Has dependencies not yet completed
- **READY**: All dependencies done, can start
- **IN_PROGRESS**: Currently being worked on
- **DONE**: Completed and validated

## Priority Levels

- **P0**: Critical path, highest priority
- **P1**: High priority
- **P2**: Medium priority
- **P3**: Low priority

## TDD Workflow (Mandatory)

This skill **enforces** Test-Driven Development:

1. **Write tests FIRST** (from Testing Requirements section)
2. **Verify RED state** (tests fail) using Wallaby MCP
3. **Implement code** to make tests pass
4. **Verify GREEN state** (tests pass)
5. **Refactor** while keeping tests green

**Wallaby MCP Tools Used:**
- `mcp__wallaby__wallaby_failingTests` - Show failing tests
- `mcp__wallaby__wallaby_testById` - Check specific test
- `mcp__wallaby__wallaby_coveredLinesForFile` - Check coverage
- `mcp__wallaby__wallaby_allTestsForFile` - Show all tests in file

## Quality Checks (Required Before Completion)

```bash
# All must pass to mark task DONE
pnpm typecheck    # 0 errors
pnpm lint         # 0 errors
pnpm test         # All passing
pnpm format:check # 0 errors
````

## Common Commands

```bash
# List task files
ls -1 docs/tasks/T*.md | sort

# View task frontmatter
head -20 docs/tasks/T0001-*.md

# Count ready tasks
grep -l "^status: READY$" docs/tasks/T*.md | wc -l

# Find P0 tasks
grep -l "^priority: P0$" docs/tasks/T*.md

# Find tasks by component
grep -l "^component: C01$" docs/tasks/T*.md

# Update task status
sed -i '' 's/^status: READY$/status: IN_PROGRESS/' docs/tasks/T0001-*.md
```

## File Structure

```
~/.claude/skills/task-manager/
├── SKILL.md              # Main skill entry point
├── select-task.ts        # Task selection script (TypeScript)
├── README.md             # This file - quick reference
├── SELECTION.md          # Fallback selection algorithm
├── IMPLEMENTATION.md     # TDD implementation guidance
├── VALIDATION.md         # Quality check procedures
├── ERROR_HANDLING.md     # Error scenarios and fixes
└── EXAMPLES.md           # Detailed interaction examples
```

## Supporting Documentation

- **@SELECTION.md** - Read only if script fails
- **@IMPLEMENTATION.md** - TDD guidance and patterns
- **@VALIDATION.md** - Quality check procedures
- **@ERROR_HANDLING.md** - Error scenarios
- **@EXAMPLES.md** - Interaction examples

## Critical Rules

**Never skip:**

1. ✅ Run script first (don't read SELECTION.md unless it fails)
2. ✅ Verify dependencies are DONE before starting
3. ✅ Read complete task file before implementing
4. ✅ Write tests FIRST (TDD mandatory)
5. ✅ Use Wallaby MCP to monitor tests
6. ✅ Update task status when changing phases
7. ✅ Run ALL quality checks before marking DONE
8. ✅ Unblock dependent tasks after completion
9. ✅ Follow TypeScript patterns from project rules

## Troubleshooting

**Script fails:**

- Check you're in project root: `pwd` should show `.../MPCU-Build-and-Deliver`
- Check tasks directory exists: `ls docs/tasks/`
- Read @ERROR_HANDLING.md for detailed scenarios

**No ready tasks:**

- Check task dependencies: some tasks may be blocked
- Review task statuses: `grep "^status:" docs/tasks/T*.md`
- Analyze blockers and update task dependencies

**Quality checks fail:**

- Review errors from `pnpm typecheck`, `pnpm lint`, `pnpm test`
- Apply fixes from `.claude/rules/typescript-patterns-condensed.md`
- Re-run checks until all pass

**Tests not passing:**

- Use Wallaby MCP tools to identify failures
- Check test requirements match implementation
- Verify acceptance criteria alignment

## Version History

- **v2.0.0** (2025-11-07): Script-based selection, multi-file task support, corrected task format
- **v1.0.0** (2025-10-01): Initial TASKS.md-based version

## Related Skills

- Code review skills
- Testing/TDD skills
- Refactoring skills
- Documentation skills
- Wallaby MCP integration
