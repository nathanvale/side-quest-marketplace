---
status: pending
priority: p2
issue_id: "045"
tags: [code-review, performance, safety-hook]
dependencies: []
---

# Double parse on commit commands in safety hook hot path

## Problem Statement

When a command is a git commit, it goes through two full parse cycles: `checkCommand()` tokenizes and parses, then `isCommitCommand()` re-tokenizes and re-parses the same command string. The char-by-char tokenizer runs twice over identical input.

**Why it matters:** Eliminates redundant work on the safety hook hot path (runs on every Bash tool use).

## Findings

- **Source:** Performance oracle review (2026-03-03)
- **File:** `plugins/git/hooks/git-safety.ts` lines 487-512
- `checkCommand` calls `splitShellSegments()` -> `tokenizeShell()` -> `parseGitInvocation()`
- `isCommitCommand` calls `splitShellSegments()` again (re-tokenizes from scratch)
- Additionally, `getCommandWords` is called twice per segment within `checkCommand` itself

## Proposed Solutions

Have `checkCommand` return the parsed segments and git invocations as part of its result, so `isCommitCommand` can reuse them. Alternatively, merge commit-specific checks into `checkCommand`.

## Acceptance Criteria

- [ ] Commit commands are only tokenized/parsed once
- [ ] No behavioral changes to safety logic
- [ ] All existing tests pass
