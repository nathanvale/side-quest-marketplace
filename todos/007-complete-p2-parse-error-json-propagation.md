---
status: pending
priority: p2
issue_id: "007"
tags: [code-review, agent-native, error-handling]
dependencies: []
---

# Parse error JSON not propagated to stdout

## Problem Statement

When `buildIndex()` encounters malformed frontmatter, it logs warnings via `logger.warn()` but still returns docs with best-effort data. The warnings go to stderr but are not surfaced in the JSON output envelope. An agent has no way to know that some documents in the result set have degraded/incomplete frontmatter.

**Why it matters:** Agents relying on frontmatter fields (e.g., filtering by `type` or `status`) may get unexpected results from docs with coerced/missing fields without any indication of data quality.

## Findings

- **Source:** agent-native-reviewer (critical -- P2 for pragmatic reasons)
- **Location:** `src/parser.ts` -- `parseDoc()` best-effort path; `src/output.ts` -- no warning aggregation
- **Evidence:** Warnings logged to stderr only, not included in JSON response

## Proposed Solutions

### Option A: Add warnings array to success envelope

Include a `warnings` field in the JSON success envelope listing any parse issues encountered during indexing.

- **Pros:** Agents can inspect data quality, transparent
- **Cons:** Envelope schema change
- **Effort:** Small
- **Risk:** Low

### Option B: Add a `quality` field to each doc

Include a `quality: "full" | "partial"` field on each CortexDoc so agents can filter or handle degraded docs.

- **Pros:** Per-doc granularity
- **Cons:** More complex schema
- **Effort:** Small
- **Risk:** Low

## Recommended Action

_(To be filled during triage)_

## Technical Details

- **Affected files:** `src/output.ts`, `src/parser.ts`, `src/schema.ts`

## Acceptance Criteria

- [ ] JSON output indicates when docs have degraded frontmatter
- [ ] Agents can programmatically detect data quality issues
- [ ] `bun run validate` passes

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-28 | Created from multi-agent review | Agent-native reviewer flagged |

## Resources

- Branch: `feat/add-cortex`
