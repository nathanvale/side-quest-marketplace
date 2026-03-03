---
status: complete
priority: p3
issue_id: "034"
tags: [code-review, simplicity]
dependencies: []
---

## Problem Statement

`conventions.md` already has an example for every commit type. `examples.md` repeats similar patterns with marginal value. Two separate files means more token cost when both are loaded.

## Findings

- `conventions.md` contains a full table of commit types with example subjects
- `examples.md` provides additional full commit message examples
- When both files are loaded as skill references, the overlap wastes context tokens
- The progressive disclosure pattern means both may be loaded together for commit-related queries

## Proposed Solutions

Add a "Full Examples" section to `conventions.md` with 2-3 examples showing distinct patterns:

1. Simple single-line commit
2. Commit with body and footer
3. Breaking change commit

Then delete `examples.md` and remove it from any reference loading config.

## Technical Details

- **Files**: `plugins/git/skills/workflow/references/examples.md`, `plugins/git/skills/workflow/references/conventions.md`
- Estimated savings: ~60 lines / reduced token cost per skill activation

## Acceptance Criteria

- Single `conventions.md` with examples section covering distinct patterns
- `examples.md` is deleted
- ~60 lines saved in total reference material
