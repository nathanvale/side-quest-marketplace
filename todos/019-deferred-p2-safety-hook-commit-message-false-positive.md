---
status: complete
priority: p2
issue_id: "019"
tags: [git, safety-hook, false-positive]
dependencies: []
---

# Safety hook triggers on blocked patterns in commit message body

## Problem Statement

The `git-safety.ts` PreToolUse hook checks the full bash command string for blocked patterns (e.g. `--no-verify`, `--force`, `--hard`). When a commit message contains these strings as documentation text (inside a heredoc), the hook incorrectly blocks the commit.

**Why it matters:** Any commit that documents blocked patterns in its message body will be denied. The workaround is to rewrite the message to avoid literal blocked strings, which is fragile and surprising.

## Findings

- **Source:** CodeRabbit review fix commit (2026-03-02)
- **Trigger:** Commit message documented the `-n` short flag for `--no-verify` in isCommitCommand(), and the hook's `command.includes('--no-verify')` matched the literal text inside the heredoc
- **Root cause:** `isCommitCommand()` runs `command.includes('--no-verify')` against the entire bash command string, which includes the heredoc commit message body
- **Affected code:** `plugins/git/hooks/git-safety.ts` -- `isCommitCommand()` function, lines ~160-164

## Proposed Solutions

### Option A: Extract commit message and check flags only in the command portion

Parse the bash command to separate the `git commit` invocation from the heredoc body. Only check flags (like `--no-verify`, `-n`) in the command portion before the message.

- **Pros:** Precise, eliminates false positives entirely
- **Cons:** Parsing heredocs from bash strings is non-trivial; many quoting styles to handle
- **Effort:** Medium
- **Risk:** Low (only affects flag detection, not BLOCKED_PATTERNS)

### Option B: Check only before the -m flag or heredoc marker

Split the command at `-m` or the heredoc marker (`<<`) and only check the prefix for flags.

- **Pros:** Simpler than full heredoc parsing
- **Cons:** Doesn't handle all commit message passing styles (e.g. `-F`, template files)
- **Effort:** Low-medium
- **Risk:** Low

### Option C: Accept the quirk and document it

Document that commit messages should avoid literal blocked pattern strings. The workaround (rephrasing) is not onerous.

- **Pros:** Zero code change
- **Cons:** Surprising behaviour; new patterns added to BLOCKED_PATTERNS become new foot-guns
- **Effort:** Minimal
- **Risk:** None

## Recommended Action

TBD -- needs triage.

## Acceptance Criteria

- [ ] Commit messages containing literal blocked-pattern strings (e.g. `--no-verify`, `--force`) are not incorrectly blocked
- [ ] Actual `--no-verify` flag usage on non-WIP commits is still blocked
- [ ] All existing git-safety tests pass
- [ ] New test covering this edge case added

## Work Log

### 2026-03-02 - Discovery

**By:** Claude Code

**Actions:**
- Attempted to commit with a message documenting the `-n` short form of `--no-verify`
- Hook blocked the commit because `command.includes('--no-verify')` matched the message body
- Workaround: rewrote message to say "no-verify flag" instead of the literal `--no-verify`

**Learnings:**
- The hook processes the entire bash command string, including heredoc content
- This affects any blocked pattern that uses `command.includes()` or broad regex matching
- BLOCKED_PATTERNS regexes are less affected since they anchor on `git\s+` prefixes, but `isCommitCommand()`'s simple string includes is the main culprit
