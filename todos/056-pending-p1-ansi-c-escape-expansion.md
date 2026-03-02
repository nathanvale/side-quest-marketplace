---
status: pending
priority: p1
issue_id: "056"
tags: [code-review, security]
dependencies: []
---

## Problem Statement

The `unquoteWord` function strips `$'...'` wrappers but does not expand escape sequences within ANSI-C quoted strings. In bash, `$'--ha\x72d'` expands to `--hard` (hex escape), but the tokenizer produces `--ha\x72d`, bypassing flag detection.

## Findings

- `unquoteWord` in `shell-tokenizer.ts` (line 427) handles `$'...'` by stripping the `$'` prefix and `'` suffix
- It does NOT process escape sequences: `\xHH` (hex), `\0NNN` (octal), `\n`, `\t`, `\\`, `\'`
- Existing tests (git-safety.test.ts lines 577-587) test `$'--hard'` but NOT `$'--ha\x72d'`
- This is a real bypass: `git reset $'--ha\x72d'` is interpreted by bash as `git reset --hard`

## Proposed Solutions

Implement ANSI-C escape sequence expansion within `unquoteWord` for `$'...'` strings. At minimum handle: `\xHH` (hex), `\0NNN` (octal), `\n`, `\t`, `\r`, `\\`, `\'`, `\"`.

## Technical Details

- **File**: `plugins/git/hooks/shell-tokenizer.ts` -- `unquoteWord` function
- **File**: `plugins/git/hooks/git-safety.test.ts` -- add tests for hex/octal escape bypass

## Acceptance Criteria

- `unquoteWord("$'--ha\\x72d'")` returns `--hard`
- `unquoteWord("$'--ha\\x52d'")` returns `--hRd` (uppercase R)
- `unquoteWord("$'\\x67it'")` returns `git`
- Safety hook blocks `git reset $'--ha\x72d'`
- Tests added for ANSI-C escape sequence bypass vectors
