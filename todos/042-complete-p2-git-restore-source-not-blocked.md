---
status: complete
priority: p2
issue_id: "042"
tags: [code-review, security, safety-hook]
dependencies: []
---

# git restore --source=REF path not blocked

## Problem Statement

The safety hook only blocks `git restore .` (with literal `.`). But `git restore --source=HEAD~5 src/` or bare `git restore file.txt` (which discards unstaged changes) are not blocked.

**Why it matters:** `git restore <path>` without `--staged` discards working tree changes with no recovery.

## Findings

- **Source:** Security sentinel review (2026-03-03)
- **File:** `plugins/git/hooks/git-safety.ts` lines 199-203
- Single-dot check is too narrow
- `git restore --source=HEAD~5 src/` overwrites entire directory

## Proposed Solutions

Block `git restore` when it has positional path arguments unless `--staged` is the only mode flag (since `git restore --staged` only unstages, which is non-destructive).

## Acceptance Criteria

- [ ] `git restore file.txt` is blocked (discards unstaged changes)
- [ ] `git restore --source=HEAD~5 src/` is blocked
- [ ] `git restore --staged file.txt` is NOT blocked (non-destructive)
- [ ] `git restore .` remains blocked
