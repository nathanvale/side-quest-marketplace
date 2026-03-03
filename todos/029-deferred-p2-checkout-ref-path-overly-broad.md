---
status: complete
priority: p2
issue_id: "029"
tags: [code-review, agent-native]
dependencies: []
---

## Problem Statement

The safety hook blocks ALL uses of `git checkout <ref> -- <path>`, including targeted single-file operations like `git checkout main -- package.json`. This is non-destructive and a common agent workflow for restoring a specific file from another branch.

## Findings

File: `plugins/git/hooks/git-safety.ts` lines 856-865

The current rule treats any `git checkout <ref> -- <path>` as destructive, but single-file checkout is a safe, targeted operation that agents frequently need for:
- Restoring a specific file from another branch
- Pulling a configuration file from main
- Reverting a single file to a known state

## Proposed Solutions

**Solution A (preferred):** Only block when path is `.` or a directory wildcard (e.g., `*`, `**`). Allow specific file paths.

**Solution B:** Suggest `git show <ref>:<path> > <path>` as an alternative in the denial message, giving agents a workaround.

## Technical Details

- Modify the checkout path detection to distinguish between single-file paths and broad path specifiers
- Paths that indicate "everything" (`.`, `*`, `**`, `/`) should remain blocked
- Specific file paths (containing a filename with extension, or a relative path to a file) should be allowed
- Edge case: `git checkout main -- src/` (directory) should still be blocked
- Update denial message to explain the distinction

## Acceptance Criteria

- [ ] `git checkout main -- single-file.txt` is allowed OR has a documented workaround in the denial message
- [ ] `git checkout main -- .` remains blocked
- [ ] `git checkout main -- *` remains blocked
- [ ] `git checkout main -- src/` (directories) remain blocked
- [ ] Test coverage for both allowed and blocked cases
