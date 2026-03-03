---
created: 2026-03-02
title: Git Plugin Landscape Update - March 2026
type: research
tags: [git, safety, commits, worktrees, hooks, conventional-commits, provenance]
project: git-plugin
status: complete
prior-research: docs/research/2026-02-11-git-plugin-landscape.md
---

# Git Plugin Landscape Update - March 2026

Delta from the February 11 research. Three parallel research agents covered git safety, commit automation, and worktree management.

## What Changed Since February 11

| Area | Feb 11 State | March 2 State |
|------|-------------|---------------|
| DCG | Leading tool, 49+ packs | Stable v0.1.0, no new releases |
| Safety Net | Not on radar | Major new entrant, cross-platform, semantic analysis |
| Hook CVEs | Not disclosed | CVE-2025-59536 + CVE-2026-21852 exposed hook RCE |
| Sandboxing | Announced | Deployed: macOS seatbelt + Linux bubblewrap, 84% prompt reduction |
| Git AI spec | Emerging, pre-1.0 | v3.0.0 standard, tool at v1.0.38+ |
| Claude Code commits | Community-built | Official commit-commands plugin from Anthropic |
| Co-Authored-By | Default, unquestioned | Active debate; AI-assistant trailer proposed |
| Commit audience | Humans only | Dual-audience paradigm (humans + AI agents) |
| Enterprise policy | Ad-hoc | AI-POLICY.txt proposed across VS Code, Claude Code, Cursor |
| Claude Code worktrees | Not shipped | Native --worktree flag (v2.1.49) |
| Platform worktrees | Partial | Every major platform now ships worktrees |
| Session managers | Not a category | ccmanager, muxtree, agtx, agent-deck emerged |
| Worktrunk | Early | Matured: 8 lifecycle hooks, TOML config |
| Session persistence | Known problem | Still unsolved (#15776), ccmanager workaround |
| Asymmetric governance | Informal concept | Codified in EU AI Act, multiple frameworks |

---

## 1. Git Safety

### CVE-2025-59536 / CVE-2026-21852 (Critical)

Check Point Research discovered hook-based RCE in Claude Code. Hooks in `.claude/settings.json` (repo-controlled) executed before trust dialog. ANTHROPIC_BASE_URL redirect exfiltrated API keys in plaintext. Patched in v2.0.65. Lessons: repo-controlled configs are untrusted executable surfaces; no execution before consent; hooks are guardrails not walls.

**Sources:** [Check Point Research](https://research.checkpoint.com/2026/rce-and-api-token-exfiltration-through-claude-code-project-files-cve-2025-59536/), [The Hacker News](https://thehackernews.com/2026/02/claude-code-flaws-allow-remote-code.html)

### claude-code-safety-net (New)

PreToolUse hook with semantic command analysis (not just regex). Recursive shell wrapper detection 5 levels deep. Three modes: default, strict (fail-closed), paranoid. Cross-platform (Claude Code, OpenCode, Gemini CLI, GitHub Copilot CLI). Custom YAML rule system.

**Source:** [kenryu42/claude-code-safety-net](https://github.com/kenryu42/claude-code-safety-net)

### Anthropic Sandboxing (Shipped)

macOS seatbelt + Linux bubblewrap. Filesystem restricted to cwd, network through proxy with domain restrictions. Git push restricted to current branch. Auth through scoped credential proxy. 84% reduction in permission prompts.

**Source:** [Anthropic Engineering](https://www.anthropic.com/engineering/claude-code-sandboxing)

### Blake Crosley's 95 Hooks

Definitive practitioner guide. Four defensive layers: prevention (PreToolUse), context injection (SessionStart), validation (PostToolUse), quality gates (Stop). "Best hooks come from incidents, not planning." Start with 3 hooks. Hard deny for irreversible operations; warn for recoverable ones.

**Source:** [blakecrosley.com](https://blakecrosley.com/blog/claude-code-hooks)

### Lasso Security Prompt Injection Defense

PostToolUse hook detecting instruction override, role-playing, encoding/obfuscation, context manipulation, instruction smuggling. Warns but does not block. Complementary to git safety, different concern.

**Source:** [lasso-security/claude-hooks](https://github.com/lasso-security/claude-hooks)

---

## 2. Commit Automation

### Git AI v3.0.0 Standard

Full provenance via git notes (`refs/notes/ai`). Line-level attribution with session hashes (16 chars for collision resistance). Metadata includes agent ID, model, prompts, accepted/overridden lines. Survives rebase, squash, cherry-pick. 800-1000x performance. Offline-first. Supported: Claude Code, Cursor, GitHub Copilot.

**Sources:** [git-ai-project/git-ai](https://github.com/git-ai-project/git-ai), [usegitai.com](https://usegitai.com/blog/introducing-git-ai)

### Official Anthropic Commit Plugin

`commit-commands` plugin (v1.0.0): `/commit` (analyzes changes, matches repo style), `/commit-push-pr` (full workflow), `/clean_gone` (prune merged branches including worktrees).

**Source:** [anthropics/claude-plugins-official](https://github.com/anthropics/claude-plugins-official/tree/main/plugins/commit-commands)

### Co-Authored-By Counter-Proposal

Bence Ferdinandy argues `Co-Authored-By` was designed for human collaborators. Proposes `AI-assistant:` trailer that supports multi-model workflows: `AI-assistant: OpenCode v1.0.203 (plan: Claude Opus 4.5, edit: Claude Sonnet 4.5)`. Not mutually exclusive -- layered approach recommended.

**Source:** [bence.ferdinandy.com](https://bence.ferdinandy.com/2025/12/29/dont-abuse-co-authored-by-for-marking-ai-assistance/)

### Dual-Audience Commit Messages

Cline blog: commit messages now serve both humans AND future AI agents. Vague commits force agents to "guess intent from raw diffs." Three-element quality framework: what changed + why + what it affects.

**Source:** [Cline blog](https://cline.ghost.io/commit-messages-arent-just-for-humans/)

### Subagent Commit Pattern

Isolate commit message generation from conversation context. Subagent reads CLAUDE.md conventions, git diff, recent log. Proposes but never executes. Solves the "debugging conversation bleeding into commit message" problem.

**Source:** [dev.to/shibayu36](https://dev.to/shibayu36/creating-project-specific-commit-messages-with-claude-code-subagents-514f)

### SSW Narrative Commit Strategy

Request AI to "commit changes in logical order that tells a story" -- data models, then business logic, then UI, then tests. Enhances review clarity.

**Source:** [SSW Rules](https://www.ssw.com.au/rules/attribute-ai-assisted-commits-with-co-authors)

---

## 3. Worktree Management

### Claude Code Native Support (v2.1.49)

`--worktree name`, `--tmux`, auto-cleanup on exit, subagent isolation via `isolation: worktree`, session picker across worktrees. Creates at `.claude/worktrees/`. Does NOT copy .env, install deps, or run post-create hooks.

**Known issues:** #15776 (session state lost on delete), #16600 (CLAUDE.md traversal), #27616 (no default worktree mode), #28958 (branches from local not remote), #27590 (multi-repo collaboration).

**Source:** [Claude Code docs](https://code.claude.com/docs/en/common-workflows)

### Codex App Worktrees

Detached HEAD by default. Auto-cleanup after 4 days or 10+ worktrees. Pre-cleanup snapshots. Two sync modes: Overwrite and Apply (patch-based). `spawn_agents_on_csv` for fan-out.

**Source:** [Codex docs](https://developers.openai.com/codex/app/worktrees/)

### Session Manager Category (New)

| Tool | Supports |
|------|----------|
| ccmanager | Claude Code, Gemini, Codex, Cursor, Copilot, Cline, OpenCode, Kimi |
| muxtree | Lightweight worktree + tmux pairing |
| agtx | Spec-driven orchestration, task-per-worktree |
| agent-deck | TUI with tmux status bar integration |
| agent-of-empires | Multi-tool via tmux + worktrees |

### Worktrunk Maturation

8 lifecycle hooks (pre-switch through pre-remove). TOML config at `.config/wt.toml`. `.worktreeinclude` patterns. `hash_port` for unique dev server ports. LLM-generated commit messages. Most mature third-party tool.

**Source:** [worktrunk.dev](https://worktrunk.dev/)

### .worktreeinclude Convention

Emerging standard used by Roo Code and Worktrunk. `.gitignore` syntax declaring which gitignored files to copy to worktrees. Declarative, committed to repo. Alternative to post-create hook scripts.

### incident.io Concrete Metrics

4-5 agents simultaneously. Custom `w` bash function for worktree creation. Username-prefixed branches. Plan Mode for confidence. Voice-driven prompting via SuperWhisper. JS editor UI: 30 seconds prompting, 10 minutes processing, ~$8.

**Source:** [incident.io blog](https://incident.io/blog/shipping-faster-with-claude-code-and-git-worktrees)

---

## Cross-Topic Patterns (Updated)

### 1. Safety shifted from instructions to enforcement

February: "asymmetric governance" was informal. March: codified in EU AI Act, implemented in Anthropic sandboxing, demonstrated by CVE remediation. The git plugin's hook-based `permissionDecision: "deny"` pattern is now the industry standard.

### 2. Provenance tracking is real infrastructure now

February: annotation spec emerging. March: Git AI v3.0.0 with line-level attribution, Co-Authored-By debate producing better alternatives, dual-audience paradigm changing how we think about commit quality.

### 3. Worktrees are infrastructure, not workflow

February: "biggest productivity unlock" (enthusiasm). March: every platform ships it, session managers emerged as a category, concrete incident.io metrics replace vague claims. The question is no longer "should we use worktrees" but "how do we manage worktree lifecycle."

### 4. Session state persistence is the next frontier

The unsolved #15776 problem (session identity keyed by path, not repo) is the most impactful gap. ccmanager works around it, Claude Code hasn't fixed it, and the git plugin's worktree-aware keying via `getMainWorktreeRoot()` is an early solution to this class of problem.
