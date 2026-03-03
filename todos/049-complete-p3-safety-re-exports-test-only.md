---
status: complete
priority: p3
issue_id: "049"
tags: [code-review, quality]
dependencies: []
---

# git-safety.ts re-exports tokenizer functions only for tests

## Problem Statement

git-safety.ts re-exports `extractCommandHead`, `splitShellSegments`, `tokenizeShell` from shell-tokenizer.ts. These re-exports exist solely so git-safety.test.ts can import them from ./git-safety. Tests should import directly from the source module.

## Findings

- **Source:** TypeScript reviewer + Simplicity reviewer (2026-03-03)
- **File:** `plugins/git/hooks/git-safety.ts` lines 28-32

## Proposed Solutions

Update git-safety.test.ts to import directly from ./shell-tokenizer. Remove re-exports from git-safety.ts.

## Acceptance Criteria

- [ ] No re-exports in git-safety.ts
- [ ] Tests import from ./shell-tokenizer directly
