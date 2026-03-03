---
status: complete
priority: p2
issue_id: "048"
tags: [code-review, simplicity]
dependencies: []
---

# Event bus client is speculative infrastructure (443 LOC)

## Problem Statement

event-bus-client.ts (182 LOC) + tests (261 LOC) send events to a server that may not be running. Every hook imports and awaits `postEvent()`, adding latency to the hot path for a no-op when no server exists.

**Why it matters:** 443 lines of code and import cost on every hook invocation for infrastructure that silently does nothing.

## Findings

- **Source:** Simplicity reviewer (2026-03-03)
- **File:** `plugins/git/hooks/event-bus-client.ts`
- The negative cache means after first failed port file check, all subsequent calls are no-ops
- But every hook still pays the import cost

## Proposed Solutions

### Option A: Keep as-is (event bus is planned infrastructure)
Document that the event bus is forward-looking infrastructure for the observability server.

### Option B: Stub until server exists
Replace with `export async function postEvent() {}`. When the server materializes, add the real implementation.

## Acceptance Criteria

- [ ] Decision documented: keep or stub
- [ ] If kept, add JSDoc explaining the event bus is forward-looking infrastructure
