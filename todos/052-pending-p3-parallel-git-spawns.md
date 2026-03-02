---
status: pending
priority: p3
issue_id: "052"
tags: [code-review, performance]
dependencies: []
---

# Sequential git subprocess spawns could run in parallel

## Problem Statement

git-context-loader.ts and session-summary.ts both run 3 sequential git commands (branch, log, status) that could use Promise.all() for parallel execution. Saves ~10-20ms each.

## Findings

- **Source:** Performance oracle review (2026-03-03)
- **Files:** `plugins/git/hooks/git-context-loader.ts` lines 63-92, `plugins/git/hooks/session-summary.ts` lines 170-209

## Proposed Solutions

Use Promise.all() to run independent git commands in parallel.

## Acceptance Criteria

- [ ] git-context-loader runs status + log in parallel
- [ ] session-summary runs branch + log + status in parallel
- [ ] All existing tests pass
