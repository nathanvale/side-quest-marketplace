---
status: pending
priority: p3
issue_id: "014"
tags: [code-review, architecture, parser]
dependencies: []
---

# Add .claude-plugin to IGNORE_DIRS

## Problem Statement

The `IGNORE_DIRS` set in `parser.ts` skips `.git`, `.obsidian`, `node_modules`, `.claude`, `dist`, `coverage` but doesn't include `.claude-plugin`. If a vault source overlaps with a plugin directory, markdown files inside `.claude-plugin/` could be indexed as cortex docs.

**Why it matters:** Minor edge case but easy to fix. Plugin directories contain markdown files (SKILL.md, commands) that should not be indexed as knowledge documents.

## Findings

- **Source:** architecture-strategist
- **Location:** `src/parser.ts:14-21` -- `IGNORE_DIRS`
- **Evidence:** `.claude-plugin` not in the set

## Proposed Solutions

### Option A: Add .claude-plugin to IGNORE_DIRS

One-line change.

- **Pros:** Prevents accidental indexing of plugin files
- **Cons:** None
- **Effort:** Trivial
- **Risk:** None

## Recommended Action

_(Quick fix)_

## Technical Details

- **Affected files:** `src/parser.ts`

## Acceptance Criteria

- [ ] `.claude-plugin` added to `IGNORE_DIRS`
- [ ] `bun run validate` passes

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-28 | Created from multi-agent review | Architecture strategist recommendation |

## Resources

- Branch: `feat/add-cortex`
