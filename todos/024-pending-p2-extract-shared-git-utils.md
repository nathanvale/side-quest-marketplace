---
status: pending
priority: p2
issue_id: "024"
tags: [code-review, quality]
dependencies: []
---

## Problem Statement

5 copies of `runGit`, 2 copies of `getCurrentBranch`, and 2 copies of `isGitRepo` exist across hook files within the same plugin. Subtle behavioral differences between copies (some trim stdout, some don't; some pipe stderr, some ignore) create maintenance risk and inconsistency.

## Findings

Duplicate implementations found in:
- `plugins/git/hooks/git-safety.ts`
- `plugins/git/hooks/event-bus-client.ts`
- `plugins/git/hooks/auto-commit-on-stop.ts`
- `plugins/git/hooks/git-context-loader.ts`
- `plugins/git/hooks/session-summary.ts`

Since these are all within the same plugin, cross-file imports are straightforward and expected.

## Proposed Solutions

Extract all shared git utility functions into `plugins/git/hooks/git-utils.ts` with a `stderr` option parameter to unify the behavioral differences. Import in all hook files.

## Technical Details

- Create `plugins/git/hooks/git-utils.ts` with canonical `runGit`, `getCurrentBranch`, and `isGitRepo` implementations
- Add a `stderr` option parameter (e.g., `'pipe' | 'ignore'`) to `runGit` to handle the behavioral variance
- Add a `trim` option (default true) to normalize stdout handling
- Replace all duplicate implementations with imports from `git-utils.ts`

## Acceptance Criteria

- [ ] Single `runGit` definition in `git-utils.ts` used by all hooks
- [ ] Single `getCurrentBranch` definition in `git-utils.ts` used by all hooks
- [ ] Single `isGitRepo` definition in `git-utils.ts` used by all hooks
- [ ] No duplicate implementations remain across hook files
- [ ] All existing tests pass without modification
