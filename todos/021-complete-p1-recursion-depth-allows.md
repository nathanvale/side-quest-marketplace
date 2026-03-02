---
status: complete
priority: p1
issue_id: "021"
tags: [code-review, security]
dependencies: []
---

## Problem Statement

When recursion depth exceeds 4 in `checkCommandInternal`, the function returns `{ blocked: false }` -- an explicit allow. This means a deeply nested command can bypass all safety checks by wrapping a destructive git command in enough layers of shell invocations.

## Findings

- File: `plugins/git/hooks/git-safety.ts` lines 745-749
- The recursion depth limit of 4 is a reasonable guard against infinite recursion
- However, returning `{ blocked: false }` when the limit is hit means "this command is safe" rather than "I cannot determine if this command is safe"
- A command like `sh -c "bash -c \"eval 'env sh -c \\\"bash -c \\\\\\\"git reset --hard\\\\\\\"\\\"'\""` could bypass checks by nesting beyond the depth limit
- This is another fail-open pattern that contradicts the fail-closed philosophy

## Proposed Solutions

### Solution A: Change to blocked with explanatory reason

Change the return value from `{ blocked: false }` to `{ blocked: true, reason: 'Command nesting too deep for safety analysis' }`.

**Pros:**
- One-line fix
- Fail-closed behavior
- Clear reason communicated to the user/agent

**Cons:**
- Could theoretically block legitimate deeply-nested commands, though 4+ levels of shell nesting is extremely unusual in normal usage

### Solution B: Increase depth limit and block on exceed

Raise the limit to 8 and then block. Gives more headroom for legitimate nested commands.

**Pros:**
- Less likely to hit false positives

**Cons:**
- Deeper recursion means more processing time
- 4+ levels of nesting is already suspicious -- raising the limit may just shift the attack vector

## Technical Details

```typescript
// Current (fail-open):
if (depth > 4) {
  return { blocked: false };
}

// Fixed (fail-closed):
if (depth > 4) {
  return { blocked: true, reason: 'Command nesting too deep for safety analysis' };
}
```

## Acceptance Criteria

- Commands with nesting depth > 4 are blocked, not allowed
- The block reason clearly states that the command exceeded the nesting depth limit
- Normal commands with nesting depth <= 4 continue to be analyzed as before
