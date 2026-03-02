---
status: pending
priority: p3
issue_id: "065"
tags: [code-review, quality]
dependencies: []
---

## Problem Statement

`sanitizeRepoName` is called twice for the same repo name: once inside `getRepoKeyFromGitRoot` and again in `postEventInner`. The double sanitization is harmless but signals confusion about trust boundaries.

## Findings

- `event-bus-client.ts` line 73: `getRepoKeyFromGitRoot` calls `sanitizeRepoName(baseName)`
- `event-bus-client.ts` line 126: `postEventInner` calls `sanitizeRepoName(repoName)` on the already-sanitized name
- `sanitizeRepoName` is idempotent, so this is correct but wasteful

## Proposed Solutions

Remove the redundant `sanitizeRepoName` call in `postEventInner` and add a comment that `getRepoKeyFromGitRoot` produces already-sanitized names.

## Technical Details

- **File**: `plugins/git/hooks/event-bus-client.ts` lines 73, 126

## Acceptance Criteria

- Single `sanitizeRepoName` call per repo name
- Comment documents the trust boundary
