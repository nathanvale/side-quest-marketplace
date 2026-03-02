---
status: pending
priority: p2
issue_id: "026"
tags: [code-review, performance]
dependencies: []
---

## Problem Statement

`session-summary.ts` reads entire cortex/summary JSONL files into memory, concatenates new entries, and rewrites the whole file. This is O(filesize) instead of O(new entries). The `appendFile` function is already imported but not used for this purpose.

## Findings

File: `plugins/git/hooks/session-summary.ts` lines 273-280, 287-292

The current pattern:
1. Read entire file contents
2. Concatenate new JSONL entry
3. Write entire file back

JSONL files are append-only by design, so the separator logic used to join old + new content is unnecessary.

## Proposed Solutions

Replace the read-concat-write pattern with `appendFile`. JSONL files should always end with a newline, making the separator logic redundant.

## Technical Details

- Replace `readFile` + string concat + `writeFile` with `appendFile` for both cortex and summary JSONL writes
- Ensure each appended entry ends with `\n` so the file remains valid JSONL
- Remove the separator/join logic that checks for trailing newlines in existing content

## Acceptance Criteria

- [ ] Cortex JSONL file writes use `appendFile`, not read-rewrite pattern
- [ ] Summary JSONL file writes use `appendFile`, not read-rewrite pattern
- [ ] JSONL files remain valid (each line is a complete JSON object, file ends with newline)
- [ ] All existing tests pass
