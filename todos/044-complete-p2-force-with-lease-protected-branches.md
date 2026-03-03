---
status: complete
priority: p2
issue_id: "044"
tags: [code-review, security, safety-hook]
dependencies: []
---

# git push --force-with-lease not blocked on protected branches

## Problem Statement

The safety hook suggests `--force-with-lease` as a safe alternative to `--force`, but `--force-with-lease` can still destroy remote history if the local reflog is stale. For an autonomous agent that runs `git fetch` before pushing, the lease check provides almost no protection.

**Why it matters:** An agent running `git fetch && git push --force-with-lease origin main` will succeed despite being a destructive operation on a protected branch.

## Findings

- **Source:** Security sentinel review (2026-03-03)
- **File:** `plugins/git/hooks/git-safety.ts` line 166-172
- The deny message says "Use --force-with-lease if you must"
- `--force-with-lease` is not checked against PROTECTED_BRANCHES

## Proposed Solutions

Block `--force-with-lease` on PROTECTED_BRANCHES specifically. Allow it on feature branches where it's genuinely safer than `--force`.

## Acceptance Criteria

- [ ] `git push --force-with-lease origin main` is blocked
- [ ] `git push --force-with-lease origin feature-branch` is allowed
- [ ] Deny message updated to not suggest --force-with-lease for protected branches
