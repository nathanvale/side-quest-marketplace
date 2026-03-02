---
status: pending
priority: p2
issue_id: "046"
tags: [code-review, quality, safety-hook]
dependencies: []
---

# Repetitive deny + postEvent + exit pattern in git-safety.ts

## Problem Statement

Four nearly identical deny-and-exit blocks in git-safety.ts construct hookSpecificOutput, JSON.stringify it, call postEvent, and process.exit(2). A helper would cut ~60 lines.

**Why it matters:** DRY violation making the hot path harder to read and maintain.

## Findings

- **Source:** Simplicity reviewer (2026-03-03)
- **File:** `plugins/git/hooks/git-safety.ts` lines 457-561
- Pattern repeats 4 times (file edit, command block, protected branch, no-verify)

## Proposed Solutions

Extract a `denyAndExit(reason, input)` helper function.

## Acceptance Criteria

- [ ] Single deny-and-exit helper used by all 4 deny paths
- [ ] No behavioral changes
- [ ] All existing tests pass
