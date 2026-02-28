---
status: pending
priority: p3
issue_id: "011"
tags: [code-review, simplicity, yagni]
dependencies: []
---

# --fields projection feature may be premature

## Problem Statement

The `--fields` flag allows selecting specific frontmatter fields in output. This is a power-user feature that adds ~30 LOC (`projectFields` function + CLI plumbing) but may not be needed in Stage 0 dogfood.

**Why it matters:** If no one uses `--fields` during dogfooding, it's dead code adding maintenance burden.

## Findings

- **Source:** code-simplicity-reviewer
- **Location:** `src/output.ts` -- `projectFields()`, `src/cli.ts` -- `--fields` flag handling
- **Evidence:** Feature exists but no documented use case in Stage 0 plan

## Proposed Solutions

### Option A: Keep it -- low cost, useful for agents

The feature is already built and is useful for agents that want minimal data. Cost of keeping is near zero.

- **Pros:** Useful for agent workflows, already implemented
- **Cons:** Slightly more code surface
- **Effort:** None
- **Risk:** None

### Option B: Remove and re-add if needed

Remove the feature and re-add it when there's a concrete use case.

- **Pros:** Less code
- **Cons:** Churn, may need it soon
- **Effort:** Small
- **Risk:** Low

## Recommended Action

_(To be filled during triage -- likely keep)_

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-28 | Created from multi-agent review | Simplicity reviewer flagged |

## Resources

- Branch: `feat/add-cortex`
