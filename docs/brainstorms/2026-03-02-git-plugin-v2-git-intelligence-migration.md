---
created: 2026-03-02
title: Git Plugin V2 - Git Intelligence MCP to Skill Migration
type: brainstorm
tags: [git, mcp, skill, auto-invoke, SessionStart, progressive-disclosure, git-reads]
project: git-plugin
status: draft
builds-on:
  - docs/brainstorms/2026-03-02-git-plugin-v2-feature-evaluation.md
---

# Git Plugin V2 - Git Intelligence MCP to Skill Migration

The old Git Intelligence MCP provided 7 read-only git tools that Claude auto-invoked. The MCP is being retired (20-30% token overhead, process spawn, schema bloat). This brainstorm explores how to replicate the auto-invoke behavior as a skill.

---

## What the MCP Did

| Tool | What It Does |
|------|-------------|
| `git_get_status` | Porcelain v2 status: branch, upstream, ahead/behind, staged, modified, untracked |
| `git_get_recent_commits` | Commit history with hash, subject, author, relative time, refs |
| `git_get_diff_summary` | Numstat diff: files changed, lines added/deleted per file |
| `git_search_commits` | Grep search (messages) or -S search (code changes) |
| `git_get_file_history` | File history with `--follow` (tracks renames) |
| `git_get_branch_info` | Current branch, tracking, ahead/behind, local/remote branches |
| `git_get_stash_list` | Stash entries with ref, message, date |

All tools used `spawnSync` arrays (injection-safe), supported `response_format: "json" | "markdown"`, and had `readOnlyHint: true` MCP annotations.

**Source code reference:** `plugins/git/mcp/index.ts` (1,343 lines) and `mcp/index.test.ts` (691 lines) in the main `side-quest-marketplace` repo (not the V2 plugin being built -- this is the older MCP-based version).

---

## The Core Problem -- Auto-Invoke Behavior

The real value was Claude proactively calling these tools because:
1. They were in the **tool palette** (always visible to Claude)
2. They had **readOnlyHint: true** (safe to call anytime)
3. They were **pre-approved** in Nathan's settings (no permission prompt)

A skill doesn't appear in the tool palette. How do we make Claude proactively gather git context without MCP?

---

## Options to Explore

### Option A: Reference-based context loading

Add `references/git-reads.md` to workflow skill teaching Claude the structured git commands. When the skill activates, Claude learns how to proactively run:

```
| Need | Command |
|------|---------|
| Current state | `git status --porcelain=v2 --branch` |
| Recent history | `git log --oneline -10 --format='%H%x00%h%x00%s%x00%an%x00%ar%x00%d'` |
| Changes summary | `git diff --numstat HEAD` |
| File history | `git log --follow -10 -- <file>` |
| Search commits | `git log -20 --grep='<query>'` |
| Search code | `git log -20 -S '<query>'` |
| Branch info | `git branch --show-current` + `git rev-list --count @{u}..HEAD` |
| Stash list | `git stash list --format='%gd\|%gs\|%ci'` |
```

**Pro:** Zero overhead, teaches Claude the right patterns
**Con:** Only triggers when workflow skill activates, not on general coding tasks

### Option B: SessionStart hook enhancement

Enhance `git-context-loader.ts` to output richer structured context matching what the MCP provided. Auto-dumps at session start.

**Pro:** Automatic at session start, no skill activation needed
**Con:** Only runs once, stale mid-session

### Option C: Both A + B

SessionStart for initial context, reference for mid-session refreshes.

**Pro:** Best coverage
**Con:** More moving parts

---

## Key Questions

1. **Scope of SessionStart enhancement** -- How much context is too much? The current hook loads branch + status + recent commits (~10 lines). Should it add stash, ahead/behind, diff summary? Where's the token budget ceiling?

2. **Reference loading trigger** -- The reference only loads when workflow skill activates. But general coding tasks (editing files, running tests) would also benefit from proactive git status. Is there a way to make the reference available more broadly?

3. **Token cost** -- The MCP tools were on-demand (only called when needed). A reference is always loaded when the skill is active. Is the always-loaded cost justified?

4. **Command injection safety** -- The MCP used `spawnSync` arrays. Bash commands via skill use string interpolation. How do we keep user-provided paths (file history, commit search) injection-safe in bash?

---

## What Doesn't Need Brainstorming

- The MCP itself is NOT being ported (decision made)
- The V1 SessionStart hook ports as-is
- The MCP source is reference-only for implementation patterns
