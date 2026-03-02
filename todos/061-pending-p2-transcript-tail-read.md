---
status: pending
priority: p2
issue_id: "061"
tags: [code-review, performance]
dependencies: []
---

## Problem Statement

`getLastUserPrompt` reads the entire transcript file (potentially megabytes) and JSON-parses every line just to find the last user message. Only the last ~10KB matters.

## Findings

- `auto-commit-on-stop.ts` lines 50-73: reads full file, iterates all lines
- Session transcripts can be 1-10MB for long sessions
- Only the last user message is needed
- Bun supports `Bun.file().slice()` for reading byte ranges

## Proposed Solutions

Read the last ~10KB using `Bun.file().slice(size - 10240, size)`, split into lines, scan backwards for the last user message.

## Technical Details

- **File**: `plugins/git/hooks/auto-commit-on-stop.ts` lines 50-73

## Acceptance Criteria

- Only the tail of the transcript is read
- Correctly finds the last user prompt
- Handles transcripts smaller than 10KB
- Handles empty/missing transcripts gracefully
