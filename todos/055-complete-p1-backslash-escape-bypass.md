---
status: complete
priority: p1
issue_id: "055"
tags: [code-review, security]
dependencies: []
---

## Problem Statement

The shell tokenizer's `splitShellWords` does not handle backslash escapes outside of quotes. In bash, `\--hard` resolves to `--hard` (backslash before `-` is a no-op escape), but the tokenizer passes through `\--hard` as a literal word. This means `git reset \--hard` bypasses flag detection.

## Findings

- `splitShellWords` in `shell-tokenizer.ts` (lines 505-554) handles single/double quotes and `$(...)` but NOT backslash escapes in unquoted context
- `unquoteWord` (line 427) strips surrounding quotes but does not process backslash-prefixed characters outside quotes
- `args.includes('--hard')` in git-safety.ts fails because the arg is `\--hard`, not `--hard`
- No tests exist for backslash-escaped flags

## Proposed Solutions

Add backslash escape handling to `splitShellWords`: when a `\` is encountered in unquoted context, consume the next character as a literal (stripping the backslash). Then `\--hard` correctly becomes `--hard` in the parsed args.

## Technical Details

- **File**: `plugins/git/hooks/shell-tokenizer.ts` lines 505-554 (`splitShellWords`)
- **File**: `plugins/git/hooks/git-safety.test.ts` -- add test cases for `git reset \--hard`, `git push \--force`

## Acceptance Criteria

- `splitShellWords('git reset \\--hard')` produces `['git', 'reset', '--hard']`
- Safety hook blocks `git reset \--hard`
- Safety hook blocks `git push \--force`
- Tests added for backslash-escaped flag bypass vectors
