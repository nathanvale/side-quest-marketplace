---
status: pending
priority: p2
issue_id: "059"
tags: [code-review, performance]
dependencies: []
---

## Problem Statement

`parseGitInvocation` creates a `new Set()` with 7 elements on every call. This allocates on the PreToolUse hot path (1-3 times per tool call).

## Findings

- `shell-tokenizer.ts` lines 607-615: `optionsWithValue` Set created inside function body
- Called once per segment, 1-3 segments per command
- Set contents are static constants

## Proposed Solutions

Hoist `optionsWithValue` to module scope as a constant.

## Technical Details

- **File**: `plugins/git/hooks/shell-tokenizer.ts` lines 607-615

## Acceptance Criteria

- `optionsWithValue` is a module-level constant
- No behavioral change
