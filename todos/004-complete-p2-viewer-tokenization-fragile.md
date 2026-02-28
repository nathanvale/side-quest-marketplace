---
status: pending
priority: p2
issue_id: "004"
tags: [code-review, security, cli]
dependencies: []
---

# Viewer tokenization fragile for quoted args

## Problem Statement

The `viewer` config value is split with `.split(' ')`, which doesn't handle quoted arguments (e.g., `"/Applications/My Editor.app/Contents/MacOS/editor" --wait`). Paths with spaces in the viewer command will break.

**Why it matters:** macOS applications commonly have spaces in paths. Users configuring a custom viewer may encounter silent failures.

## Findings

- **Source:** security-sentinel (medium)
- **Location:** `src/commands/open.ts:66` -- `viewer.split(' ')`
- **Evidence:** Simple space splitting doesn't handle quoted paths or escaped spaces

## Proposed Solutions

### Option A: Use shell-quote or similar parser

Use a shell tokenizer library to properly parse the viewer command into tokens.

- **Pros:** Handles all edge cases (quotes, escapes)
- **Cons:** New dependency
- **Effort:** Small
- **Risk:** Low

### Option B: Accept viewer as array in config

Allow `viewer` to be specified as `["path", "arg1", "arg2"]` in YAML config.

- **Pros:** Unambiguous, no parsing needed
- **Cons:** Less ergonomic for simple cases
- **Effort:** Small
- **Risk:** Low

### Option C: Document the limitation

Note in docs that viewer paths with spaces must not be used, or suggest symlinking.

- **Pros:** No code change
- **Cons:** Poor DX
- **Effort:** Trivial
- **Risk:** Low

## Recommended Action

_(To be filled during triage)_

## Technical Details

- **Affected files:** `src/commands/open.ts`, `src/config.ts` (if changing config shape)

## Acceptance Criteria

- [ ] Viewer paths with spaces work correctly
- [ ] OR limitation is documented
- [ ] `bun run validate` passes

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-28 | Created from multi-agent review | Security sentinel flagged as medium |

## Resources

- Branch: `feat/add-cortex`
