---
status: pending
priority: p3
issue_id: "053"
tags: [code-review, agent-native]
dependencies: []
---

# SKILL.md safety language implies bypass path that doesn't exist

## Problem Statement

SKILL.md says "NEVER git reset --hard without explicit user confirmation" which implies there is a path through "with confirmation". The safety hook hard-denies these commands unconditionally with no override. This wastes agent tokens attempting impossible flows.

## Findings

- **Source:** Agent-native reviewer (2026-03-03)
- **File:** `plugins/git/skills/git-expert/SKILL.md` lines 52-54, 61

## Proposed Solutions

Change language to: "These commands are blocked by the safety hook. Do not attempt them." Remove "without user confirmation" phrasing.

## Acceptance Criteria

- [ ] SKILL.md safety language matches hook reality (hard deny, no bypass)
