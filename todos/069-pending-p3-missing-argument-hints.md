---
status: pending
priority: p3
issue_id: "069"
tags: [code-review, agent-native]
dependencies: []
---

## Problem Statement

`/git:create-pr` and `/git:session-log` commands are missing `argument-hint` fields in their frontmatter. Sub-agent callers cannot discover what arguments are accepted.

## Findings

- `create-pr.md` has no `argument-hint` field
- `session-log.md` has no `argument-hint` field
- All other commands that accept arguments have `argument-hint` defined
- Missing hints reduce agent discoverability

## Proposed Solutions

Add `argument-hint` to both command files:
- `create-pr.md`: `argument-hint: "[title]"`
- `session-log.md`: `argument-hint: "[time-range]"`

## Technical Details

- **Files**: `plugins/git/commands/create-pr.md`, `plugins/git/commands/session-log.md`

## Acceptance Criteria

- Both commands have `argument-hint` in frontmatter
- Hints are under 30 chars
- Plugin validation passes
