---
status: complete
priority: p2
issue_id: "030"
tags: [code-review, agent-native]
dependencies: []
---

## Problem Statement

The auto-commit-on-stop hook uses `git add -u` which only stages tracked file modifications. New files created during the session are not checkpointed, meaning agent work product can be partially lost.

## Findings

File: `plugins/git/hooks/auto-commit-on-stop.ts` line 177

- `git add -u` only stages changes to files already tracked by git
- A TODO comment at line 177 acknowledges this limitation
- Files created by the agent during the session (new source files, test files, config files) would not be included in the checkpoint commit
- This creates a silent data loss risk for agent-generated work

## Proposed Solutions

**Solution A (minimum viable):** Emit a warning listing untracked files that were NOT committed, so the user is aware of what was left out.

**Solution B (preferred):** Include untracked files with explicit `git add <file>` calls, excluding noise patterns (`.DS_Store`, `node_modules/`, `.env`, etc.).

## Technical Details

- Run `git status --porcelain` to detect untracked files (`??` prefix)
- For Solution A: log untracked file paths as a warning after the checkpoint commit
- For Solution B: define an exclusion list (gitignore-style) and run `git add` for each untracked file not matching an exclusion pattern
- Consider reading `.gitignore` patterns to avoid adding ignored files
- `git add --intent-to-add` could be used to track files without staging content, but `git add <file>` is simpler

## Acceptance Criteria

- [ ] At minimum, untracked files produce a visible warning when the auto-commit checkpoint runs
- [ ] Ideally, untracked files are included in the checkpoint commit (excluding noise patterns)
- [ ] `.DS_Store`, `node_modules/`, `.env`, and other common noise files are never auto-added
- [ ] Existing tests pass and new behavior has test coverage
