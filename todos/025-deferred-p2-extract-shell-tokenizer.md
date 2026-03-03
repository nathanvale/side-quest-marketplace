---
status: complete
priority: p2
issue_id: "025"
tags: [code-review, architecture]
dependencies: []
---

## Problem Statement

`git-safety.ts` is 1320 lines with two distinct responsibilities: a shell tokenizer/parser and a safety policy engine. The tokenizer is independently testable and potentially reusable beyond the safety hook.

## Findings

File: `plugins/git/hooks/git-safety.ts` (lines 54-611, ~560 lines)

The following functions form a cohesive shell tokenizer module:
- `tokenizeShell`
- `splitShellSegments`
- `splitShellWords`
- `getCommandWords`
- `parseGitInvocation`
- `extractCommandHead`
- `consumeCommandSubstitution`
- `extractCommandSubstitutions`
- `extractWrappedShellCommand`

## Proposed Solutions

Move all tokenizer functions to `plugins/git/hooks/shell-tokenizer.ts`. Keep the safety policy logic in `git-safety.ts`, reducing it to ~700 lines. The tokenizer module becomes independently testable and reusable.

## Technical Details

- Create `plugins/git/hooks/shell-tokenizer.ts` with all tokenizer/parser functions
- Update `git-safety.ts` to import from `shell-tokenizer.ts`
- Move corresponding tests to `shell-tokenizer.test.ts` or keep them co-located with safety tests depending on test organization preference
- No behavioral changes -- pure refactor

## Acceptance Criteria

- [ ] `git-safety.ts` is under 800 lines
- [ ] `shell-tokenizer.ts` contains all tokenizer/parser functions
- [ ] All 160+ existing tests still pass
- [ ] No behavioral changes to safety hook
