---
status: complete
priority: p3
issue_id: "051"
tags: [code-review, simplicity, tokens]
dependencies: []
---

# SKILL.md duplicates commit type table from conventions.md

## Problem Statement

SKILL.md has a "Commit Format" section (lines 87-98) that repeats the commit type table already in references/conventions.md. Since SKILL.md is always loaded (~2000 tokens), this wastes ~15 lines of context budget.

## Findings

- **Source:** Simplicity reviewer (2026-03-03)
- **File:** `plugins/git/skills/workflow/SKILL.md` lines 87-98

## Proposed Solutions

Remove the duplicate table from SKILL.md. The routing table already points to conventions.md for commit-related queries.

## Acceptance Criteria

- [ ] No duplicate commit type table in SKILL.md
- [ ] Conventions.md reference still works for commit formatting
