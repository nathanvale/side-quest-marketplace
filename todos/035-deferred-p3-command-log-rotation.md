---
status: complete
priority: p3
issue_id: "035"
tags: [code-review, operations]
dependencies: []
---

## Problem Statement

`git-command-log.jsonl` grows unbounded with no rotation. Over extended use this could consume significant disk space. The log also contains all executed commands which may include sensitive arguments.

## Findings

- `command-logger.ts` (lines 82-86) appends to the JSONL file on every git command execution
- There is no size check, rotation, or truncation mechanism
- The log path is typically `~/.claude/git-command-log.jsonl`
- Each entry includes the full command string, which could contain sensitive data (tokens, passwords in URLs, etc.)

## Proposed Solutions

Add a size check before each append:

1. Check file size with `stat` before writing
2. If file exceeds 10MB, rotate: rename current file to `.1` (overwriting any existing rotation)
3. Alternatively, truncate by keeping only the last N entries

## Technical Details

- **File**: `plugins/git/hooks/command-logger.ts` lines 82-86
- JSONL format makes tail-truncation straightforward (read lines, keep last N, rewrite)
- Size-based rotation is simpler and avoids reading the entire file

## Acceptance Criteria

- Log file has a size cap or rotation mechanism
- Rotation triggers before the file exceeds 10MB
- Old rotated files are cleaned up (at most 1 backup)
