---
status: complete
priority: p2
issue_id: "071"
tags: [code-review, agent-native, dx-git, phase-4]
dependencies: []
---

# Add default behaviors for 3 blocking prompts in headless mode

## Problem Statement

The commit-push-pr workflow has 3 decision points that present numbered prompts requiring interactive response. Headless agents (Codex, sub-agents, CI orchestrators) cannot respond to these prompts and will stall.

The deferred flags (`--on-mixed`, `--on-validate-fail`) are correctly deferred to post-MVP, but the plan needs to document what happens when no response is available.

## Findings

- **Agent-native reviewer (Round 4):** 3 blocking prompts need sensible defaults for non-interactive callers.
- **Ultra-think analysis:** Non-fast-forward "Rebase" option is misleading since `git rebase` is not in allowed-tools.

### The 3 blocking prompts:

1. **Mixed WIP + GOOD commits (Phase 2, line 287-290):** "1) Squash all 2) Skip squash 3) Abort"
   - Recommended default: `skip` (push as-is) -- least destructive, preserves all commits
2. **Validation failure (Phase 4, line 325-327):** "1) Fix and retry 2) Push anyway 3) Abort"
   - Recommended default: `abort` -- headless agents should never silently push broken code
3. **Non-fast-forward push (Phase 5, line 338):** "1) Rebase 2) Merge 3) Abort"
   - Recommended default: `abort` -- conflict resolution requires judgment
   - Additional issue: "Rebase" is misleading because `git rebase` is NOT in allowed-tools. Should clarify these are manual instructions, not actions the command will take.

## Proposed Solutions

### Option A: Document defaults in workflows.md (Recommended)
Add a one-line note after each prompt: "If no interactive response is available, defaults to [X]."

- Pros: No new flags needed. Covers the gap for MVP. Simple 3-line addition.
- Cons: LLM must interpret "no interactive response available" correctly.
- Effort: Small
- Risk: Low

### Option B: Skip prompts when `[description]` argument is provided
If the user passed a description, assume they want the workflow to complete autonomously.

- Pros: Uses existing signal (description = intent expressed). No new flags.
- Cons: Conflates "I want to describe my commit" with "I want full autonomy."
- Effort: Small
- Risk: Medium

## Technical Details

**Affected files:**
- `docs/plans/2026-03-02-feat-git-plugin-v2-phase-4-commands-plan.md` (lines 287-290, 325-327, 338)
- `plugins/dx-git/skills/workflow/references/workflows.md` (during implementation)

**Additional fix needed:**
- Add `--on-diverge=rebase|merge|abort` to the "What's NOT in This Phase" deferred table (currently missing, unlike `--on-mixed` and `--on-validate-fail`)
- Clarify non-fast-forward options are manual instructions (rebase/merge require tools not in allowed-tools)

## Acceptance Criteria

- [x] Each of the 3 prompts documents a default behavior for non-interactive callers
- [x] Non-fast-forward options clarified as manual user instructions
- [x] `--on-diverge` added to deferred items table
- [x] Plan document updated

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-03-03 | Created from /ce:review of Phase 4 plan | Agent-native reviewer + ultra-think analysis |
