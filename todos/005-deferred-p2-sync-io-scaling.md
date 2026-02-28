---
status: pending
priority: p2
issue_id: "005"
tags: [code-review, performance, architecture]
dependencies: []
---

# Synchronous I/O won't scale beyond small vaults

## Problem Statement

All file I/O in `parser.ts` and `config.ts` uses synchronous APIs (`readFileSync`, `statSync`, `Bun.Glob.scanSync`). For Stage 0 with small vaults this is fine, but it blocks the event loop and will become a bottleneck with larger document sets.

**Why it matters:** Performance oracle flagged this as critical for scaling, but for the current Stage 0 dogfood MVP scope, this is acceptable. Flagged as P2 for Stage 1 planning.

## Findings

- **Source:** performance-oracle (critical -- downgraded to P2 for Stage 0)
- **Location:** `src/parser.ts` -- `buildIndex()`, `scanDir()`, `parseDoc()`; `src/config.ts` -- `loadConfig()`
- **Evidence:** All I/O operations are synchronous

## Proposed Solutions

### Option A: Async refactor in Stage 1

Convert to async/await with `Bun.file().text()`, `fs.promises.stat()`, and async glob scanning. This is a straightforward refactor.

- **Pros:** Non-blocking, enables concurrent file reads
- **Cons:** Larger refactor touching multiple functions
- **Effort:** Medium
- **Risk:** Low

### Option B: Worker thread for indexing

Run the index build in a worker thread so the main thread remains responsive.

- **Pros:** Minimal API changes, isolates blocking I/O
- **Cons:** Worker thread complexity, serialization overhead
- **Effort:** Medium
- **Risk:** Medium

## Recommended Action

_(To be filled during triage -- defer to Stage 1)_

## Technical Details

- **Affected files:** `src/parser.ts`, `src/config.ts`

## Acceptance Criteria

- [ ] Index building does not block the event loop
- [ ] Performance acceptable for 1000+ document vaults
- [ ] `bun run validate` passes

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-28 | Created from multi-agent review | Performance oracle critical, downgraded for Stage 0 |

## Resources

- Branch: `feat/add-cortex`
