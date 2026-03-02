---
created: 2026-03-02
title: Git Plugin V2 - Marketplace Port and Uplift
type: brainstorm
tags: [git, plugin, marketplace, hooks, safety, commits, worktrees, conventional-commits]
project: git-plugin
status: complete
---

# Git Plugin V2 - Marketplace Port and Uplift

## Context

The git plugin has been running in production at `~/code/side-quest-plugins/plugins/git/` (v1.0.0) for ~3 weeks. It works exceptionally well -- the hook-based safety guards block destructive commands reliably, fire-and-forget event bus is invisible, auto-commit on stop creates WIP checkpoints, and the SessionStart context loader keeps Claude oriented after compaction.

The goal is to port it into `side-quest-marketplace` and uplift it to V2, matching the quality and conventions of the cortex-engineering plugin -- the gold standard in this marketplace.

## What Exists (V1)

- **1 skill** (workflow) with 4 reference files (CONVENTIONS, WORKFLOWS, WORKTREE, EXAMPLES)
- **10 slash commands** (commit, checkpoint, squash, create-pr, review-pr, changelog, compare, history, session-log, worktree)
- **5 lifecycle hooks** (SessionStart, PreToolUse, PostToolUse, PreCompact, Stop)
- **Shared modules** (event-bus-client.ts, git-status-parser.ts)
- **3 test files** (safety, parser, event-bus)
- **Research** from Feb 11 covering 5 topics (166 X posts, 150 web pages)

## Fresh Research (March 2, 2026)

Three parallel research agents ran across git safety, commit automation, and worktree management. Key findings since Feb 11:

### Git Safety -- What Changed

1. **CVE-2025-59536 / CVE-2026-21852** -- Critical hook RCE vulnerability in Claude Code. Hooks in repo-controlled `.claude/settings.json` executed automatically before trust dialog. Patched in v2.0.65. Lesson: never trust repo-controlled configurations as safe metadata.

2. **claude-code-safety-net** -- Major new entrant. PreToolUse hook with semantic analysis (not just regex), recursive shell wrapper detection (5 levels deep), three modes (default/strict/paranoid), cross-platform support. Created after someone lost work from `rm -rf ~/`.

3. **DCG stable at v0.1.0** -- No new releases since Jan 7. Still the most comprehensive single-binary (Rust, 49+ security packs, SIMD filtering, AST-based heredoc scanning).

4. **Blake Crosley's 95 hooks** -- Definitive practitioner guide. Key insight: "The best hooks come from incidents, not planning." Start with 3 hooks (safety, context, quality gate), add more from real failures.

5. **Anthropic sandboxing shipped** -- macOS seatbelt + Linux bubblewrap. 84% reduction in permission prompts. Git push restricted to current branch only.

6. **Asymmetric governance codified** -- AI agents get stricter constraints than humans. Now in EU AI Act enforcement. block-no-verify is the clearest example.

### Commit Automation -- What Changed

1. **Git AI v3.0.0 spec** -- Full provenance via git notes (`refs/notes/ai`). Line-level attribution, session hashes, prompt metadata. Survives rebase/squash/cherry-pick. Now at v1.0.38+.

2. **Official Anthropic commit-commands plugin** -- `/commit`, `/commit-push-pr`, `/clean_gone`. Ships with Claude Code.

3. **Co-Authored-By debate** -- Counter-proposal for `AI-assistant:` trailer (supports multi-model workflows). Not mutually exclusive. Recommendation: layered approach (Co-Authored-By for GitHub visibility + AI-assistant trailer for specificity).

4. **Dual-audience paradigm** -- Commit messages now serve both humans AND future AI agents. Vague commits force agents to "guess intent from raw diffs." Subject + why + scope matters more than ever.

5. **Subagent pattern for commits** -- Isolates commit message generation from conversation context. Produces cleaner messages because the subagent only sees the diff, not the debugging history.

6. **AI-POLICY.txt proposed** -- robots.txt-style file for repos declaring AI usage policy. Filed on VS Code, Claude Code, Cursor.

7. **Anti-slop patterns** -- Good: what changed + why + what it affects. Bad: echoing conversation, over-verbose subjects, missing scope, implementation narration.

### Worktree Management -- What Changed

1. **Claude Code shipped native worktree support** (v2.1.49) -- `--worktree` flag, `--tmux` flag, auto-cleanup, subagent isolation via `isolation: worktree`.

2. **Every major platform has worktrees now** -- Codex (detached HEAD, auto-cleanup after 4 days), Windsurf (Wave 13 parallel Cascades), Roo Code (`.worktreeinclude` convention).

3. **Session managers as new tool category** -- ccmanager, muxtree, agtx, agent-deck, agent-of-empires. All combine worktrees + tmux + AI tool orchestration.

4. **Worktrunk matured** -- 8 lifecycle hooks, TOML config, `.worktreeinclude` patterns, `hash_port` for unique dev server ports.

5. **`.worktreeinclude` emerging as convention** -- Both Roo Code and Worktrunk use it. Declarative, committed to repo, `.gitignore` syntax.

6. **Session state persistence still unsolved** -- Claude Code issue #15776 open. Session keyed by path, not repo identity. 50-100+ messages of context lost on worktree delete.

7. **incident.io published concrete metrics** -- 4-5 agents running simultaneously, JavaScript editor UI in "30 seconds of prompting, 10 minutes of processing, ~$8."

## Quality Gap Analysis

Compared against cortex-engineering conventions:

| Area | V1 | Marketplace Standard | Action |
|------|-----|---------------------|--------|
| SKILL.md description | Routing focus | WHAT+WHEN+WHEN-NOT pattern | Polish |
| Progressive disclosure | 4 flat reference files | references/ subdirectory | Restructure |
| Hook self-destruct | Missing | MUST be first executable line | Add to all hooks |
| Hook imports | Cross-file (event-bus, parser) | Self-contained preferred | Decision: keep shared (DRY wins) |
| Command frontmatter | Good | Add model routing per command | Already done |
| Tests | 3 files | Keep and port | Port as-is |
| Event bus | HTTP fire-and-forget | Unique to git | Keep |
| Description quality | Decent | "Pushy" with negative scope | Polish |
| Naming | workflow | Convention-compliant | Good |

## Key Decisions

### 1. Skill Architecture

**Options explored:**
- (a) Keep 1 skill (workflow) with references/ restructure
- (b) Split into multiple skills (git-commit, git-safety, git-worktree, git-history)
- (c) Keep 1 main skill + background knowledge skills

**Decision: (a)** -- The routing table in SKILL.md works well. Splitting into multiple skills would fragment the context and force Claude to load multiple skills for common operations. Move CONVENTIONS, WORKFLOWS, WORKTREE, EXAMPLES into `references/` subdirectory.

### 2. Hook Self-Destruct Timers

Add self-destruct as first executable line to all 5 hooks. Use `.unref()` for graceful exit. Match cortex-engineering's bootstrap.ts pattern.

### 3. Shared vs Self-Contained Hooks

**Keep shared modules.** The event-bus-client and git-status-parser are used across 3+ hooks each. Inlining would create 500+ lines of duplication with sync risk. The plugin is distributed as a unit, not individual hooks.

### 4. Worktree CLI Dependency

**Keep `bunx @side-quest/git`** for worktree management. It handles config copying, lifecycle hooks, and status enrichment that raw git commands can't replicate. The CLI is the right abstraction.

### 5. V2 Features

**Include in V2:**
- Self-destruct timers on all hooks
- Progressive disclosure restructure (references/)
- WHAT+WHEN+WHEN-NOT descriptions
- Dual-audience commit messages (optimize for humans + future AI agents)
- Anti-slop guardrails in commit workflow (detect over-verbose subjects, missing scope)

**Consider for V2.1:**
- AI-assistant trailer support alongside Co-Authored-By
- Git AI notes integration (optional, team-level adoption)
- `.worktreeinclude` convention alignment
- Recursive shell wrapper detection in safety hook (claude-code-safety-net pattern)
- Session identity keying by repo remote URL (workaround for #15776)

**Defer to V3:**
- AI-POLICY.txt enforcement
- Prompt injection defense (Lasso Security pattern -- different concern than git safety)
- Multi-agent review stacks

## Open Questions (resolved)

1. ~~Should the plugin include the research document?~~ **No.** Research stays at `docs/research/` at the marketplace level, not inside the plugin. Plugin ships skill + commands + hooks only.

2. ~~Should we keep the event bus architecture or simplify?~~ **Keep it.** Update discovery path to global observability server with fallback. Decided in the feature evaluation (Section 5b).

3. **Unresolved: Should cortex extraction be its own plugin?** The PreCompact hook (`session-summary.ts`) extracts decisions/errors/learnings via regex. This overlaps with cortex-engineering's domain. Carry forward -- needs a decision during Plan 1 (port) or Plan 2 (compliance).

## Next Steps

1. Create the plugin directory structure in marketplace
2. Port and restructure files to marketplace conventions
3. Add self-destruct timers to all hooks
4. Polish descriptions and frontmatter
5. Run `bun run validate` to confirm structure
6. Create PR
