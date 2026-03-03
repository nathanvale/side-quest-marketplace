---
status: complete
priority: p3
issue_id: "072"
tags: [code-review, security, dx-git, phase-4]
dependencies: []
---

# Pipe delimiter in for-each-ref is technically valid in branch names

## Problem Statement

The plan uses `|` (pipe) as delimiter in `git for-each-ref` format string and states "branch names can contain `/` and `.` but never `|`". This is incorrect -- git does allow `|` in branch names (`git checkout -b "feat|pipe"` is valid).

## Findings

- **Security sentinel (Round 4):** Low severity. If a branch named `feat|trick` existed, pipe-delimited parsing would misalign fields. Blast radius limited by `-d` (not `-D`) refusing to delete unmerged branches.

## Proposed Solutions

### Option A: Use null byte delimiter (Best practice)
```bash
git for-each-ref --format='%(refname:short)%00%(objectname:short)%00...' -- refs/heads/
```
- Pros: `%00` is the canonical plumbing approach. Cannot exist in branch names.
- Cons: Harder to document in markdown. LLM must handle null bytes in output parsing.
- Effort: Small
- Risk: Low

### Option B: Use multi-character delimiter
```bash
git for-each-ref --format='%(refname:short)<|>%(objectname:short)<|>...' -- refs/heads/
```
- Pros: Visually clear. Extremely unlikely in branch names. Easy to document.
- Cons: Not impossible in branch names (just very unlikely).
- Effort: Small
- Risk: Low

### Option C: Keep pipe, document the edge case
- Pros: Simple. Pipe in branch names is extremely rare.
- Cons: Technically incorrect claim in the plan.
- Effort: None
- Risk: Low (impractical attack vector)

## Acceptance Criteria

- [x] Delimiter choice documented accurately (remove false claim about `|`)
- [x] If delimiter changed, plan and workflows.md updated

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-03-03 | Created from /ce:review of Phase 4 plan | Security sentinel finding |
