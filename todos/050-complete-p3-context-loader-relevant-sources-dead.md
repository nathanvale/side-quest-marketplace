---
status: complete
priority: p3
issue_id: "050"
tags: [code-review, simplicity]
dependencies: []
---

# git-context-loader relevantSources check lists all possible values

## Problem Statement

The `relevantSources` array at line 171 lists all four SessionSource values ('startup', 'resume', 'compact', 'clear'). The filter can never exclude anything - it's dead logic.

## Findings

- **Source:** Simplicity reviewer (2026-03-03)
- **File:** `plugins/git/hooks/git-context-loader.ts` lines 171-179

## Proposed Solutions

Remove the check entirely, or make it actually selective if there are sources that should be skipped.

## Acceptance Criteria

- [ ] Dead filter logic removed or made meaningful
