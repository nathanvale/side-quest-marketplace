---
status: complete
priority: p2
issue_id: "062"
tags: [code-review, agent-native]
dependencies: []
---

## Problem Statement

The context loader routing table injected at session start lumps `/git:history`, `/git:changelog`, `/git:compare`, and `/git:review-pr` under "invoke workflow skill", which is not actionable for sub-agent callers. After compaction, this is the only context Claude has.

## Findings

- `git-context-loader.ts` lines 123-136: routing table only lists 6 of 10 commands explicitly
- "invoke workflow skill" is ambiguous -- sub-agents cannot invoke skills directly
- After compaction, the routing table is the sole reference for available commands

## Proposed Solutions

List all 10 slash commands explicitly in the routing table with brief descriptions.

## Technical Details

- **File**: `plugins/git/hooks/git-context-loader.ts` lines 123-136

## Acceptance Criteria

- All 10 git commands listed in the routing table
- Each has a brief description of when to use it
- Sub-agents can discover all commands from the routing table alone
