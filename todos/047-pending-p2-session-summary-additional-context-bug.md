---
status: pending
priority: p2
issue_id: "047"
tags: [code-review, agent-native]
dependencies: []
---

# Session summary uses bugged additionalContext instead of stdout

## Problem Statement

The session-summary hook outputs via `hookSpecificOutput.additionalContext`, but git-context-loader documents this path as bugged (bug #16538) and uses plain stdout instead.

**Why it matters:** Compaction summary context may be silently discarded, losing git state awareness after compaction.

## Findings

- **Source:** Agent-native reviewer (2026-03-03)
- **File:** `plugins/git/hooks/session-summary.ts` lines 293-299
- git-context-loader explicitly works around this bug using console.log of plain text

## Proposed Solutions

Switch session-summary to use plain stdout (console.log) like git-context-loader does, or verify bug #16538 has been fixed for PreCompact hooks specifically.

## Acceptance Criteria

- [ ] Compaction context is actually injected after compaction
- [ ] Verify via testing that the context appears in Claude's conversation
