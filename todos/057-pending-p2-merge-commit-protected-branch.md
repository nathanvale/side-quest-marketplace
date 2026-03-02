---
status: pending
priority: p2
issue_id: "057"
tags: [code-review, security]
dependencies: []
---

## Problem Statement

`hasProtectedBranchCommitAction` only detects merge commits when `--no-ff` or `--commit` is explicitly present. A plain `git merge feature/foo` on a protected branch creates a merge commit if it cannot fast-forward, but this bypasses detection.

## Findings

- `git-safety.ts` lines 551-557: checks for explicit `--no-ff` or `--commit` flags
- A non-fast-forward merge without those flags still creates a commit
- Cannot determine at parse time whether a merge will fast-forward
- Test at line 172 confirms `git merge feature/foo` is intentionally allowed

## Proposed Solutions

Treat `git merge <ref>` as potentially commit-creating unless `--squash` or `--no-commit` is explicitly present. This is safer (blocks more) but may produce false positives for fast-forward merges on protected branches.

## Technical Details

- **File**: `plugins/git/hooks/git-safety.ts` lines 551-557

## Acceptance Criteria

- `git merge feature/foo` on a protected branch is detected as commit-creating
- `git merge --squash feature/foo` is NOT flagged
- `git merge --no-commit feature/foo` is NOT flagged
- Tests updated accordingly
