---
status: complete
priority: p3
issue_id: "037"
tags: [code-review, simplicity]
dependencies: []
---

## Problem Statement

The CortexEntry system with 17 SaliencePattern regexes reads the entire transcript, runs regex against every sentence, deduplicates, and writes to `~/.claude/cortex/<repo>.jsonl`. If nothing consumes these files, this is ~130 lines of write-only infrastructure.

## Findings

- `session-summary.ts` (lines 33-162) implements the full salience extraction pipeline
- 17 regex patterns scan every sentence in the session transcript
- Results are deduplicated and written to a JSONL file per repository
- The patterns are brittle -- e.g., "always" matches casual language like "I always forget"
- No consumer of the cortex JSONL files has been identified in the codebase

## Proposed Solutions

1. Search the codebase and related projects for anything that reads `~/.claude/cortex/*.jsonl`
2. If no consumer exists, remove the entire salience extraction system (~130 lines)
3. Keep the git state summary functionality which has clear value

If a consumer does exist, document it and consider tightening the regex patterns to reduce false positives.

## Technical Details

- **File**: `plugins/git/hooks/session-summary.ts` lines 33-162
- The 17 `SaliencePattern` regexes include patterns for decisions, conventions, gotchas, preferences, etc.
- False positive example: pattern for "always" would match "I always use tabs" (useful) but also "it's always been that way" (noise)
- The deduplication uses exact-match which won't catch near-duplicate phrasings

## Acceptance Criteria

- Either a documented consumer of cortex JSONL files exists, or the dead code is removed
- If kept, brittle regex patterns are tightened to reduce false positives
