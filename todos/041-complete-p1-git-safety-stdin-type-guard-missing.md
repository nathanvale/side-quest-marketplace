---
status: complete
priority: p1
issue_id: "041"
tags: [code-review, typescript, safety-hook]
dependencies: []
---

# git-safety.ts uses bare as-cast on stdin instead of type guard

## Problem Statement

git-safety.ts uses `(await Bun.stdin.json()) as PreToolUseHookInput` instead of a proper type guard. Every other hook file (auto-commit, command-logger, git-context-loader, session-summary) uses an `is*HookInput` type guard for runtime validation. The safety hook is the most security-critical hook and should have the strongest input validation.

**Why it matters:** If stdin JSON has an unexpected shape, subsequent property access could produce incorrect results rather than failing cleanly.

## Findings

- **Source:** TypeScript reviewer (2026-03-03)
- **File:** `plugins/git/hooks/git-safety.ts` line 415
- The hook does have partial compensation: `typeof input.tool_name !== 'string'` at line 433 and `typeof command !== 'string'` at line 483
- But these only validate two fields out of the full input shape

## Proposed Solutions

### Option A: Add isPreToolUseHookInput type guard
Create a proper type guard function following the pattern used by other hooks.

- **Pros:** Consistent with codebase patterns, defense in depth
- **Cons:** Slightly more code
- **Effort:** Low

## Acceptance Criteria

- [ ] `isPreToolUseHookInput` type guard validates tool_name, tool_input shape
- [ ] git-safety.ts uses the type guard instead of bare as-cast
- [ ] Malformed stdin input triggers deny (fail-closed)
