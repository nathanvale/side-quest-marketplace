---
status: complete
priority: p3
issue_id: "064"
tags: [code-review, performance]
dependencies: []
---

## Problem Statement

`hasShortFlag` calls `collectShortFlags` which rebuilds an intermediate string from all args on every call. It is called 5-10 times per git command across different subcommand checks, recomputing each time. Also lacks documentation that it only works for single-character flags.

## Findings

- `git-safety.ts` lines 81-95: `collectShortFlags` iterates, filters, maps, joins args
- Called multiple times per `checkParsedSegments` invocation
- The API design invites misuse -- `.includes('rf')` could match across arg boundaries
- All current callers use single-character flags, so it is safe but fragile

## Proposed Solutions

1. Simplify to `args.some(arg => /^-[A-Za-z]+$/.test(arg) && arg.includes(flag))` -- avoids intermediate array, short-circuits on first match
2. Add JSDoc comment: "Only valid for single-character flag lookups"

## Technical Details

- **File**: `plugins/git/hooks/git-safety.ts` lines 81-95

## Acceptance Criteria

- `hasShortFlag` no longer rebuilds intermediate string
- JSDoc documents single-char-only constraint
- All existing tests pass
