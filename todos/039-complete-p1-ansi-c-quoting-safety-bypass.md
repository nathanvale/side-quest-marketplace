---
status: complete
priority: p1
issue_id: "039"
tags: [code-review, security, safety-hook]
dependencies: []
---

# ANSI-C quoting ($'...') bypasses safety flag detection

## Problem Statement

The shell tokenizer does not handle ANSI-C quoting ($'...'). In bash/zsh, $'...' is a quoting mechanism that supports escape sequences. Commands like `git reset $'--hard'` pass through the safety hook unblocked because the tokenizer produces the arg `$'--hard'` which does not match `--hard`.

**Why it matters:** This is a confirmed safety bypass. Any blocked flag can be evaded by wrapping it in ANSI-C quotes.

## Findings

- **Source:** Security sentinel review (2026-03-03)
- **File:** `plugins/git/hooks/shell-tokenizer.ts` lines 175-235
- **Attack vectors:** `git reset $'--hard'`, `git push $'--force'`, `git clean $'-f'`
- The tokenizer sees `$` then `'`, appends `$` to buffer, enters single-quote state
- `unquoteWord` does not strip `$` prefix from single-quoted strings
- Result: arg becomes `$'--hard'` which doesn't match `--hard` in flag checks

## Proposed Solutions

### Option A: Handle ANSI-C quotes in tokenizer
Add a `$'` detection in the tokenizer. When `$` is followed by `'`, enter a special state that handles the content like single-quote but strips the `$` prefix during unquoting.

- **Pros:** Correct parsing, handles escape sequences
- **Cons:** Adds complexity to tokenizer (~20-30 lines)
- **Effort:** Medium

### Option B: Strip `$` prefix in unquoteWord
Add a simple `$'` prefix strip in the `unquoteWord` function.

- **Pros:** Minimal change (~3 lines)
- **Cons:** Doesn't handle escape sequences inside $'...' (e.g., $'\x2d\x2dhard')
- **Effort:** Low

## Acceptance Criteria

- [ ] `git reset $'--hard'` is blocked by the safety hook
- [ ] `git push $'--force'` is blocked by the safety hook
- [ ] `git clean $'-f'` is blocked by the safety hook
- [ ] Existing tokenizer tests pass
- [ ] New test cases cover ANSI-C quoting bypass attempts
