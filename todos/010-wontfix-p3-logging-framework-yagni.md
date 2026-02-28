---
status: pending
priority: p3
issue_id: "010"
tags: [code-review, simplicity, yagni]
dependencies: []
---

# Logging framework may be YAGNI for Stage 0

## Problem Statement

The code uses LogTape structured logging with auto text/JSON switching, logger hierarchy, and configured sinks. For a Stage 0 CLI that runs as a single-shot process, `console.error()` or simple stderr writes would suffice.

**Why it matters:** ~50 LOC of logging infrastructure (setup, configuration, sink selection) adds complexity without clear benefit at this stage.

## Findings

- **Source:** code-simplicity-reviewer
- **Location:** `src/logging.ts` (or equivalent), logging setup in `src/cli.ts`
- **Evidence:** Full structured logging framework for a CLI that runs for <100ms

## Proposed Solutions

### Option A: Keep it -- it's already built

The logging is already implemented and working. Removing it would be churn. It will be useful in Stage 1 when the tool becomes an MCP server.

- **Pros:** No churn, future-ready
- **Cons:** Slightly over-engineered for Stage 0
- **Effort:** None
- **Risk:** None

### Option B: Simplify to console.error

Replace LogTape with `console.error()` calls. Re-add structured logging in Stage 1.

- **Pros:** Simpler code, fewer dependencies
- **Cons:** Rework in Stage 1, loses structured logging for debugging
- **Effort:** Small
- **Risk:** Low

## Recommended Action

_(To be filled during triage -- likely keep as-is)_

## Technical Details

- **Affected files:** `src/logging.ts`, `src/cli.ts`, all files using `getLogger()`

## Acceptance Criteria

- [ ] Decision made: keep or simplify
- [ ] If simplifying, all logger calls replaced with console.error
- [ ] `bun run validate` passes

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-28 | Created from multi-agent review | Simplicity reviewer flagged as removable |

## Resources

- Branch: `feat/add-cortex`
