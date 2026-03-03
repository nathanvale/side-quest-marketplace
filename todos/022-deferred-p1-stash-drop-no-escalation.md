---
status: complete
priority: p1
issue_id: "022"
tags: [code-review, agent-native]
dependencies: []
---

## Problem Statement

The safety hook blocks `git stash drop` and `git stash clear` with no escalation path. An agent that stashes work as part of a workflow (stash, switch branch, apply, drop stash) gets permanently stuck. The stash list grows unboundedly with no way to clean it up. The hook hard-denies with exit code 2 and there is no mechanism to override.

## Findings

- File: `plugins/git/hooks/git-safety.ts` lines 842-855
- `git stash drop` (with or without a ref) and `git stash clear` are both blocked
- A common agent workflow is: stash -> switch branch -> apply -> drop stash
- Without the drop step, the stash accumulates indefinitely
- The deny is a hard exit code 2 with no escalation or override mechanism
- This creates an operational dead end for autonomous agent workflows

## Proposed Solutions

### Solution A: Allow targeted stash drop, block blanket operations

Allow `git stash drop stash@{N}` when targeting a specific ref. Continue to block `git stash drop` (no args, drops most recent) and `git stash clear` (drops all).

**Pros:**
- Enables agent workflows that target specific stash entries
- Still protects against accidental mass deletion
- Minimal change to safety logic

**Cons:**
- Slightly relaxed security posture -- a specific stash entry can still contain important work
- Agent must know the stash ref to drop

### Solution B: Add a `/git:stash` command for safe stash operations

Create a command-level wrapper that manages the full stash lifecycle (push, list, apply, drop) with built-in safety checks and confirmation for destructive operations.

**Pros:**
- Full workflow support with guided safety
- Can include smarts like "show stash contents before dropping"
- Works well in both interactive and agent contexts

**Cons:**
- More code to write and maintain
- Agents need to learn to use the command instead of raw git

### Solution C: Allow stash drop only when preceded by stash apply in same session

Track stash operations in session state. Only allow drop after a successful apply of the same ref.

**Pros:**
- Tightly scoped -- only drops what was just applied
- Very safe

**Cons:**
- Requires session state tracking, which the hook currently does not support
- Complex to implement correctly

## Technical Details

```typescript
// Current: blocks all stash drop/clear
// lines 842-855 in git-safety.ts

// Solution A approach:
// Allow: git stash drop stash@{0}, git stash drop stash@{3}
// Block: git stash drop (no args), git stash clear
const stashDropWithRef = /^git\s+stash\s+drop\s+stash@\{\d+\}$/;
if (stashDropWithRef.test(command)) {
  return { blocked: false }; // targeted drop is safe
}
```

## Acceptance Criteria

- An agent can complete a stash -> switch -> apply -> drop workflow without getting stuck
- `git stash clear` remains blocked (mass deletion)
- `git stash drop` without arguments remains blocked (implicit target)
- `git stash drop stash@{N}` with a specific ref is allowed
- The stash list does not grow unboundedly during agent operation
