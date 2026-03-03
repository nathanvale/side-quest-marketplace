---
status: complete
priority: p2
issue_id: "070"
tags: [code-review, security, dx-git, phase-4, allowed-tools]
dependencies: []
---

# Narrow `Bash(git config:*)` to read-only in clean-gone command

## Problem Statement

The `/dx-git:clean-gone` command's allowed-tools includes `Bash(git config:*)` which permits both reads AND writes. The plan only needs `git config --get-all cleanup.protectedBranch` (read-only). The broad wildcard also permits:

- `git config core.hooksPath /dev/null` (disables all git hooks)
- `git config core.bare true` (breaks the repo -- known issue in MEMORY.md)
- `git config http.sslVerify false` (disables TLS verification)

The safety hook does NOT inspect `git config` writes.

## Findings

- **Security sentinel (Round 4):** Medium severity. `Bash(git config:*)` permits arbitrary config writes including security-weakening changes.
- **Agent-native reviewer (Round 4):** Also flagged. Recommends narrowing to `Bash(git config --get-all:*)`.
- **Consistent with Phase 4 principle:** All other tools were tightened (e.g., `git reset --soft:*`, `git branch -d:*`, `gh pr create:*`). `git config:*` is the only remaining broad pattern.

## Proposed Solutions

### Option A: Narrow to read-only (Recommended)
Replace `Bash(git config:*)` with `Bash(git config --get:*), Bash(git config --get-all:*)`.

- Pros: Principle of least privilege. Blocks all writes. Covers both single-value and multi-value reads.
- Cons: None significant. If config writes are ever needed, add them explicitly.
- Effort: Small (1 line change in plan + 1 line in command file)
- Risk: Low

### Option B: Keep broad
Keep `Bash(git config:*)` and rely on the safety hook + LLM judgment.

- Pros: No change needed. Simpler.
- Cons: Violates the principle applied everywhere else in this plan.
- Effort: None
- Risk: Medium -- inconsistent with defense-in-depth pattern

## Technical Details

**Affected files:**
- `docs/plans/2026-03-02-feat-git-plugin-v2-phase-4-commands-plan.md` (line 140)
- `plugins/dx-git/commands/clean-gone.md` (during implementation)

## Acceptance Criteria

- [x] `clean-gone.md` allowed-tools uses `Bash(git config --get:*), Bash(git config --get-all:*)` instead of `Bash(git config:*)`
- [x] Plan document updated to reflect the narrowed pattern

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-03-03 | Created from /ce:review of Phase 4 plan | Security sentinel + agent-native reviewer converged on this finding |
