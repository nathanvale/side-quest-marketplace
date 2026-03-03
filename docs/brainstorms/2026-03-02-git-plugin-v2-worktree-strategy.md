---
created: 2026-03-02
title: Git Plugin V2 - Worktree Strategy
type: brainstorm
tags: [git, worktrees, session-managers, worktreeinclude, session-persistence, tmux]
project: git-plugin
status: draft
builds-on:
  - docs/brainstorms/2026-03-02-git-plugin-v2-feature-evaluation.md
  - docs/research/2026-03-02-git-plugin-landscape-update.md
  - docs/research/2026-02-11-git-plugin-landscape.md
---

# Git Plugin V2 - Worktree Strategy

Nathan hasn't settled on worktree management direction yet. This brainstorm collects the open questions and research findings to explore in a dedicated session.

---

## What We Have (V1)

The existing `/worktree` command wraps `bunx @side-quest/git worktree` CLI, which provides:
- `create` -- new worktree with config copying (.env, editor configs)
- `list` -- status-enriched worktree listing
- `delete` -- safe removal with status check
- `sync` -- pull changes into worktree
- `clean` -- remove stale worktrees
- `status` -- detailed per-worktree status

This works. The question isn't "do we need worktree support" -- it's "what's the right relationship between our worktree management and Claude Code's native support?"

---

## Key Questions to Explore

### 1. Our CLI vs Claude Code Native Worktrees

Claude Code shipped native `--worktree` flag (v2.1.49):
- Creates at `.claude/worktrees/`
- Auto-cleanup on exit
- `--tmux` flag for multiplexing
- Subagent isolation via `isolation: worktree`
- Session picker across worktrees

**But it does NOT:**
- Copy .env files
- Install dependencies
- Run post-create hooks
- Support `.worktreeinclude` patterns

Our CLI does all of those. Also note: Claude Code creates at `.claude/worktrees/` while our CLI uses `.worktrees/` -- different locations, potential for confusion if both are used.

Should we:
- (a) Keep our CLI as the primary worktree tool (richer but separate from Claude Code)
- (b) Lean into Claude Code native and add post-create hooks to fill gaps
- (c) Hybrid -- use Claude Code native for creation, our CLI for lifecycle management

### 2. .worktreeinclude Convention

Emerging standard used by Roo Code and Worktrunk. `.gitignore` syntax declaring which gitignored files to copy to worktrees. Committed to repo, declarative.

Should our CLI support this? Should we adopt it as a recommendation in the plugin?

### 3. Session State Persistence (#15776)

Claude Code issue #15776 -- session identity keyed by path, not repo. Deleting a worktree loses 50-100+ messages of context.

- ccmanager works around this
- Our CLI's `getMainWorktreeRoot()` is an early solution
- Should we invest in a workaround or wait for Claude Code to fix it?

### 4. Session Managers

A whole category emerged: ccmanager, muxtree, agtx, agent-deck. All combine worktrees + tmux + AI tool orchestration.

- Is this a problem the plugin should solve?
- Or should we recommend one of these tools and integrate?
- incident.io's approach: 4-5 agents simultaneously, custom `w` bash function, ~$8 per task

### 5. Worktrunk Integration

Worktrunk is the most mature third-party tool: 8 lifecycle hooks, TOML config, `.worktreeinclude`, `hash_port` for dev server ports, LLM-generated commit messages.

Compete or recommend?

---

## What Doesn't Need Brainstorming

The V1 `/worktree` command ports as-is into V2. No changes needed for the initial port. This brainstorm is about what to add in V2.1+.

---

## Research Available

All findings are captured in:
- `docs/research/2026-03-02-git-plugin-landscape-update.md` (Section 3: Worktree Management)
- `docs/research/2026-02-11-git-plugin-landscape.md` (Section 5: Git Worktree Workflow Automation)
