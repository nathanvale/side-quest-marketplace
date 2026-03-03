---
status: complete
priority: p3
issue_id: "038"
tags: [code-review, agent-native]
dependencies: []
---

## Problem Statement

The `/git:history` command uses haiku model, but history exploration requires chaining multiple git commands and reasoning about results. Haiku may struggle with complex queries like "when did we introduce the auth bug".

## Findings

- `history.md` (line 3) specifies haiku as the model
- History exploration involves: parsing git log output, identifying relevant commits, following file renames, correlating changes across branches
- Other commands like `checkpoint` and `session-log` are simpler and appropriate for haiku
- Complex history queries require multi-step reasoning that benefits from a more capable model

## Proposed Solutions

Change the model from haiku to sonnet for the `/git:history` command. Leave `checkpoint` and `session-log` on haiku since they perform simpler, more mechanical tasks.

## Technical Details

- **File**: `plugins/git/commands/history.md` line 3
- The model is specified in the YAML frontmatter of the command file
- Sonnet provides better multi-step reasoning for complex git history queries
- Cost increase is minimal since history is an infrequently used interactive command

## Acceptance Criteria

- `/git:history` uses sonnet model
- `/git:checkpoint` and `/git:session-log` remain on haiku
