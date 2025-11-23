---
description: Project Manager - task execution and status tracking for VTM
---

# Project Manager - Start Next Task

Run the task orchestrator to find the next ready task and start working on it.

## Instructions

1. **Find Next Task**: Run the task orchestrator script:

   ```bash
   cd /Users/nathanvale/code/MPCU-Build-and-Deliver/apps/migration-cli && bun scripts/task-orchestrator.ts --next
   ```

2. **Parse Output**: Extract from the script output:
   - Task ID (e.g., T0029)
   - Task file path (e.g., `docs/tasks/T0029-...md`)
   - Priority and complexity
   - Estimated file changes
   - Recommended agent type

3. **Read Task File**: Load the complete task file to understand:
   - Description and acceptance criteria
   - Implementation plan
   - Testing requirements
   - File changes needed

4. **Execute Task**: Follow the 7-phase TDD workflow from `.github/copilot-instructions.md`:
   - Phase 1: RED - Write failing tests first
   - Phase 2: GREEN - Minimal implementation to pass
   - Phase 3: REFACTOR - Clean up code
   - Phase 4: VALIDATE - Run `pnpm typecheck && pnpm lint && pnpm test`
   - Phase 5: DOCUMENT - Update docs if needed
   - Phase 6: COMMIT - Create atomic commits
   - Phase 7: REVIEW - Self-review changes

5. **Track Progress**: Use TodoWrite tool to track implementation steps

6. **Complete Task**: After validation passes, mark task as done:
   ```bash
   cd /Users/nathanvale/code/MPCU-Build-and-Deliver/apps/migration-cli && bun scripts/manage-task-metadata.ts --complete T####
   ```

## Agent Recommendations

The orchestrator recommends specialized approaches:

- **tester**: Focus on TDD, write comprehensive tests first
- **implementer**: Focus on clean implementation after tests
- **reviewer**: Focus on code quality and refactoring
- **planner**: Focus on breaking down complex tasks

Follow the recommended approach while adhering to TDD workflow.

## Important Rules

- ✅ Always read the FULL task file before starting
- ✅ Write tests FIRST, then implementation
- ✅ Run validation before marking complete
- ✅ Use TodoWrite to track progress
- ✅ Make atomic commits with meaningful messages
- ❌ Never skip validation steps
- ❌ Never mark task complete if tests fail
- ❌ Never skip the TDD workflow

## Example Flow

```
User: /pm
↓
Claude: Runs task-orchestrator.ts --next
↓
Output: "Task T0029: Fix memory exhaustion (P0, MEDIUM, @tester)"
↓
Claude: Reads docs/tasks/T0029-memory-exhaustion-80k-records.md
↓
Claude: Creates todos, writes tests first, implements streaming
↓
Claude: Runs pnpm typecheck && pnpm lint && pnpm test
↓
Claude: Marks T0029 as complete
```

## Context Awareness

This command is designed for the VTM migration-cli project which uses:

- Bun runtime
- Vitest for testing
- TDD workflow
- Task-based development with frontmatter metadata
- Git worktrees for parallel work
