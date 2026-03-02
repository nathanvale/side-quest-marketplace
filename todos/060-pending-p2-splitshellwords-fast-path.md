---
status: pending
priority: p2
issue_id: "060"
tags: [code-review, performance]
dependencies: []
---

## Problem Statement

`splitShellWords` runs the full char-by-char lexer on every command, but most Claude commands are simple (no quotes, no `$`, no backslash). A fast-path check could use a plain `.split(/\s+/)` for simple commands.

## Findings

- `shell-tokenizer.ts` lines 505-554: char-by-char word splitter
- Majority of commands are simple: `git status`, `ls -la`, `cat file.txt`
- A regex guard `!/['"\`$\\]/.test(segment)` could skip the lexer entirely

## Proposed Solutions

Add a fast-path guard clause at the top of `splitShellWords`. Note: this depends on 055 (backslash handling) being resolved first, since the fast path must correctly identify that backslash-containing commands need the full parser.

## Technical Details

- **File**: `plugins/git/hooks/shell-tokenizer.ts` lines 505-554
- **Depends on**: 055 (backslash escape handling)

## Acceptance Criteria

- Simple commands use fast path (split on whitespace)
- Commands with quotes/substitutions use full lexer
- All existing tests continue to pass
