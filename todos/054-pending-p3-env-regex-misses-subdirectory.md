---
status: pending
priority: p3
issue_id: "054"
tags: [code-review, security]
dependencies: []
---

# .env regex doesn't match .env/ subdirectory paths

## Problem Statement

The `.env` pattern `/\.env($|\.)/` does not match paths like `/app/.env/database-credentials` because after `.env` comes `/`, which is neither end-of-string nor `.`.

## Findings

- **Source:** Security sentinel review (2026-03-03)
- **File:** `plugins/git/hooks/git-safety.ts` lines 55-68

## Proposed Solutions

Change regex to `/\.env($|[./])/` to also match `.env/` directory paths.

## Acceptance Criteria

- [ ] `/app/.env/secrets` is blocked
- [ ] `/app/.env` is still blocked
- [ ] `/app/.env.local` is still blocked
