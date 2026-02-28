---
status: pending
priority: p3
issue_id: "013"
tags: [code-review, architecture, stage-1]
dependencies: []
---

# Extract pure functions from commands for MCP reuse

## Problem Statement

Command handlers in `src/commands/` mix business logic with CLI I/O (exit codes, writeSuccess/writeError). When Stage 1 adds an MCP server interface, the business logic will need to be reusable without the CLI output wiring.

**Why it matters:** Planning ahead for Stage 1 MCP integration. Not urgent but worth noting for architectural direction.

## Findings

- **Source:** architecture-strategist
- **Location:** `src/commands/*.ts`
- **Evidence:** Business logic (filtering, sorting, matching) is coupled to CLI output functions

## Proposed Solutions

### Option A: Extract at Stage 1

When building the MCP server, extract pure functions (filter, sort, match) from command handlers. This is a natural refactor point.

- **Pros:** No premature abstraction, refactor when needed
- **Cons:** Slightly more work at Stage 1
- **Effort:** Medium (at Stage 1)
- **Risk:** Low

## Recommended Action

_(Defer to Stage 1)_

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-28 | Created from multi-agent review | Architecture strategist recommendation |

## Resources

- Branch: `feat/add-cortex`
