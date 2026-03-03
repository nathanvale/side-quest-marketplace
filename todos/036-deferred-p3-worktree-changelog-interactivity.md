---
status: complete
priority: p3
issue_id: "036"
tags: [code-review, agent-native]
dependencies: []
---

## Problem Statement

Worktree workflows have 4 separate "ask user" gates. Changelog requires approval before writing. When invoked by sub-agents, these prompts cannot be answered.

## Findings

- `worktree.md` reference contains multiple confirmation steps in the workflow
- `workflows.md` changelog generation requires human approval before writing the file
- Per project memory: "NEVER use AskUserQuestion inside skills -- not compatible with Codex, headless agents, or sub-agent callers"
- These workflows break when called programmatically by other agents

## Proposed Solutions

When arguments are fully specified, skip confirmation steps. Only prompt when arguments are ambiguous or missing.

For example:
- If worktree name and base branch are both provided, create without asking
- If changelog output path and commit range are specified, generate without approval
- Keep prompts only for cases where required information is missing

## Technical Details

- **Files**: `plugins/git/skills/workflow/references/worktree.md`, `plugins/git/skills/workflow/references/workflows.md`
- Skills should present numbered options only when disambiguation is needed
- Fully specified invocations should execute without gates

## Acceptance Criteria

- Worktree and changelog workflows complete without human prompts when all arguments are provided
- Confirmation prompts only appear when required information is missing or ambiguous
