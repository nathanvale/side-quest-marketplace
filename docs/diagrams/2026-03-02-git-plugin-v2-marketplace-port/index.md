---
created: 2026-03-02
title: "Git Plugin V2 - Marketplace Port and Uplift"
type: diagram
engine: markmap
tags: [git, plugin, marketplace, mindmap, architecture]
project: git-plugin
status: draft
source:
  - docs/brainstorms/2026-03-02-git-plugin-v2-marketplace-port.md
---

## Mind Map

```markmap
# Git Plugin V2

## V1 Baseline
### 1 Skill (workflow)
- 4 reference files
### 10 Slash Commands
- commit, checkpoint, squash
- create-pr, review-pr
- changelog, compare, history
- session-log, worktree
### 5 Lifecycle Hooks
- SessionStart (context loader)
- PreToolUse (safety guard)
- PostToolUse (event bus)
- PreCompact (session summary)
- Stop (WIP checkpoint)
### Shared Modules
- event-bus-client.ts
- git-status-parser.ts

## Quality Gaps
### SKILL.md Description
- Add WHAT+WHEN+WHEN-NOT pattern
### Progressive Disclosure
- Restructure to references/ subdirectory
### Hook Self-Destruct
- Add as first executable line
### Description Quality
- Polish with negative scope

## V2 Features
### Self-Destruct Timers
- All 5 hooks, .unref() pattern
### Progressive Disclosure
- references/ subdirectory structure
### Dual-Audience Commits
- Optimize for humans + AI agents
### Anti-Slop Guardrails
- Detect over-verbose subjects
- Missing scope detection

## V2.1 Candidates
### AI-Assistant Trailer
- Alongside Co-Authored-By
### Git AI Notes
- refs/notes/ai provenance
### .worktreeinclude Convention
- Roo Code + Worktrunk pattern
### Shell Wrapper Detection
- Recursive 5-level deep analysis

## V3 Deferred
### AI-POLICY.txt Enforcement
### Prompt Injection Defense
### Multi-Agent Review Stacks
```

**Export:** Markmap engine, A3 landscape.
