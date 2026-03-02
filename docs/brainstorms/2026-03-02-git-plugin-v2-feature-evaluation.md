---
created: 2026-03-02
title: Git Plugin V2 - Feature Evaluation and Uplift Decisions
type: brainstorm
tags: [git, plugin, commits, safety, provenance, clean-gone, commit-push-pr, dual-audience, git-ai]
project: git-plugin
status: complete
builds-on:
  - docs/brainstorms/2026-03-02-git-plugin-v2-marketplace-port.md
  - docs/research/2026-03-02-git-plugin-landscape-update.md
  - docs/research/2026-03-02-safety-hook-architecture.md
  - docs/research/2026-02-11-git-plugin-landscape.md
produces:
  - docs/brainstorms/2026-03-02-git-plugin-v2-worktree-strategy.md
  - docs/brainstorms/2026-03-02-git-plugin-v2-git-intelligence-migration.md
  - docs/brainstorms/2026-03-02-git-plugin-v2-advanced-safety.md
---

# Git Plugin V2 - Feature Evaluation and Uplift Decisions

Going through every idea from the research to evaluate what to bring into V2, what to defer, and what to skip. This document captures the evaluation. Concrete implementation plans and items needing further brainstorming are separated at the end.

**V1 source:** `~/code/side-quest-plugins/plugins/git/` (production for ~3 weeks, v1.0.0)

---

## 1. Commit Automation

### 1a. Current State -- What We Already Do Well

The V1 `/commit` workflow is comprehensive:
- 7-step process: check branch, review diff, stage specific files, review recent commits for style, compose message, commit, handle hook failures
- Conventional Commits enforced via SKILL.md + CONVENTIONS.md + EXAMPLES.md
- Model routing: `sonnet` for commits, `haiku` for checkpoints
- Safety: branch check (blocks main/master), no `--no-verify` on non-WIP, no `git add .`
- `/checkpoint` for quick WIP saves with `--no-verify`, `/squash` to clean up WIP into proper commits

The Anthropic `commit-commands` plugin is a toy by comparison -- 3 commands, no skills, no hooks, no safety, no conventional commits enforcement. Their `/commit` does everything in "a single message" with no review step. Not worth adopting wholesale.

### 1b. `/commit-push-pr` -- ADOPT as new command

**Nathan's reaction:** "I'd love that -- I've been doing commit then push then create PR."

This is the right instinct. But NOT the Anthropic way (single-shot, no review). Instead:

**Proposed `/commit-push-pr` workflow:**
1. Run the full `/commit` workflow (with branch check, staging, conventional commit)
2. If commit succeeds, run the `/create-pr` workflow (push + `gh pr create`)
3. Squash WIP commits first if any exist (detect `chore(wip):` in log)

This is a **thin orchestration command** that chains existing procedures. The skill already knows how to do both -- we just need a command that says "do both."

**Implementation:** New `commands/commit-push-pr.md` that delegates to workflow skill with both procedures. Model: `sonnet`.

**Decision: V2 -- include.**

### 1c. `/clean-gone` -- ADOPT as new command

**Nathan's reaction:** "I love that, because I've owned that with Styleship."

Anthropic's implementation is actually decent here -- finds `[gone]` branches (remote tracking branch deleted after merge), finds associated worktrees, force-removes worktrees, then deletes branches. Single bash pipeline.

**Proposed approach:** Port the concept but route through our worktree management. The `bunx @side-quest/git worktree clean` already handles worktree cleanup, but `clean-gone` is specifically about branches whose upstream is deleted (after PR merge). Different use case.

**Implementation:** New `commands/clean-gone.md`. The command should:
1. `git fetch --prune` to update remote tracking
2. `git branch -v` to find `[gone]` branches
3. For each: check if worktree exists, remove worktree first, then delete branch
4. Report what was cleaned

**Decision: V2 -- include.**

### 1d. Git AI v3.0.0 Standard -- DEFER (fascinating but premature for us)

**What it is:** An open standard for tracking AI-generated code via git notes at `refs/notes/ai`. Line-level attribution with 16-char session hashes. Metadata includes agent ID, model, prompts, accepted/overridden lines. Survives rebase, squash, cherry-pick via a "working state" mechanism. Apache 2.0.

**What's impressive:**
- The spec is RFC 2119 compliant and handles every edge case of history rewriting (rebase, merge --squash, reset, cherry-pick, stash/pop, amend)
- Uses git notes -- a legitimate, underused Git primitive
- `git-ai blame` overlays AI authorship on standard blame
- Performance: <100ms common commands, note sync under 15ms even with 100K notes
- Supports Claude Code, Cursor, Copilot, Codex, Gemini CLI, and 5+ others
- Per-machine install, zero per-repo setup, 100% offline

**Why not V2:**
- The project is new (1.0 blog post early 2026) -- needs more traction
- `refs/notes/ai` not auto-fetched/pushed -- requires explicit refspec config for teams
- The `messages` array includes full transcripts -- privacy implications if notes hit shared remotes
- No signing/verification -- anyone could forge an authorship log
- Adding a binary dependency (`git-ai`) to the plugin increases surface area
- The value proposition is strongest for teams tracking AI usage metrics -- solo developer benefit is limited to "who wrote this line, me or Claude?" which git blame + Co-Authored-By already answer at the commit level

**What we could do in V2.1 without the full dependency:**
- Add a reference doc explaining the Git AI standard for users who want it
- Support a `--git-ai` flag on `/commit` that runs `git-ai checkpoint` if installed
- The workflow skill could detect if git-ai is installed and suggest using `git-ai blame`

**Decision: V2.1 consideration -- add awareness, not dependency.**

### 1e. Dual-Audience Commit Messages -- ADOPT as guidance, not enforcement

**What it is:** Cline's insight that commit messages now serve both humans AND future AI agents. "Vague commits force agents to guess intent from raw diffs." Three-element framework: what changed + why + what it affects.

**Nathan's reaction:** "I don't know about that."

**Assessment:** The principle is sound but shouldn't change the workflow mechanically. Our commit format already produces good messages because the CONVENTIONS.md and EXAMPLES.md enforce:
- Subject: what changed (`feat(auth): add OAuth2 login flow`)
- Body: why it changed
- Footer: references, breaking changes

The "what it affects" dimension is the new part -- telling future agents "this commit touches the auth module and the session store, so if you're modifying either, read this diff."

**Proposed approach:** Update the CONVENTIONS.md reference to include a note about dual-audience writing. Don't add a mechanical step or validation -- just make the skill aware that commit messages are read by both humans and agents.

**Decision: V2 -- update CONVENTIONS.md with a dual-audience note.**

### 1f. Co-Authored-By vs AI-assistant Trailer -- KEEP Co-Authored-By, note the alternative

**Current state:** Our `/commit` workflow adds `Co-Authored-By: Claude <noreply@anthropic.com>` when Claude generates code.

**The debate:** Bence Ferdinandy argues `Co-Authored-By` was designed for human collaborators. Proposes `AI-assistant:` trailer supporting multi-model workflows: `AI-assistant: OpenCode v1.0.203 (plan: Claude Opus 4.5, edit: Claude Sonnet 4.5)`.

**Assessment:** Co-Authored-By gives GitHub visibility (avatar in commit list). The AI-assistant trailer is more precise but has zero tooling support. They're not mutually exclusive -- you can use both.

**Decision: V2 -- keep Co-Authored-By as default. Add a note in CONVENTIONS.md about AI-assistant trailer as optional addition. Don't enforce both.**

### 1g. Anti-Slop Guardrails -- ADOPT in commit workflow

From the research: good commits have "what changed + why + what it affects." Bad commits echo conversation context, have over-verbose subjects, miss scope, narrate implementation.

**What this means practically:**
- The SKILL.md commit section should explicitly say: "Do not echo the debugging conversation into the commit message. The commit describes the outcome, not the journey."
- Subject line should be under 72 characters (we already enforce this)
- Scope should never be omitted on non-trivial changes

**Decision: V2 -- add anti-slop guidance to CONVENTIONS.md.**

### 1h. Subagent Commit Pattern -- ALREADY DOING THIS

The research highlighted isolating commit message generation from conversation context via a subagent. Our commands already delegate to the workflow skill, which acts as a focused context -- the model reads the diff and recent log, not the debugging transcript. This is functionally the same pattern.

**Decision: No action needed -- V1 already does this via skill routing.**

---

## 2. Safety Hook Architecture

### 2a. Current State -- Where We're Aligned With Industry

The V1 `git-safety.ts` hook is well-aligned with every implementation in the ecosystem:

| Our Feature | Industry Equivalent |
|-------------|-------------------|
| `permissionDecision: "deny"` | Standard PreToolUse deny pattern |
| Block force push, hard reset, clean -f | Trail of Bits, dcg, Matt Pocock, safety-net all block these |
| Block commits on main/master | Trail of Bits blocks pushes to main; we go further and block commits |
| Block --no-verify on non-WIP | block-no-verify plugin does exactly this |
| Block Write/Edit to .env, credentials, .git/ | Trail of Bits uses permission rules for credential files |
| Deny with guidance (reason string) | Universal pattern -- Claude reads the reason and self-corrects |
| Fail-open for unknown commands | dcg philosophy: "never blocks your workflow due to timeouts or parse errors" |
| Event bus reporting on blocks | Unique to us -- observability on safety events |

**Assessment:** We're ahead of most community implementations. The gaps are documented below.

### 2b. Safety Gap Analysis -- claude-code-safety-net Deep Dive

Deep research into `claude-code-safety-net` (kenryu42, 1,099 stars, MIT) revealed significant gaps in our hook. This tool uses **proper shell tokenization** via the `shell-quote` library -- it parses commands into tokens first, then analyzes tokens. Our hook does regex on raw strings. That's a fundamental architectural difference.

**Origin story:** Created Christmas Day 2025 after someone lost their entire home directory to `rm -rf ~/`. Author's philosophy: "CLAUDE.md instructions are soft guardrails that the LLM can ignore. PreToolUse hooks are hard guardrails at the execution layer."

**Architecture:** Multi-stage pipeline -- shell tokenization, wrapper stripping (sudo/env/command up to 20 iterations), recursive shell unwrapping (bash -c, sh -c, up to 10 levels deep), flag-order-independent analysis, CWD-aware path resolution, interpreter one-liner scanning.

**Three modes confirmed:**
- **Default:** Block known dangerous, pass through unparseable (fail-open)
- **Strict:** (`SAFETY_NET_STRICT=1`) Fail-closed -- blocks commands that can't be safely parsed
- **Paranoid:** (`SAFETY_NET_PARANOID=1`) Blocks ALL rm -rf within cwd and ALL interpreter one-liners

**Our hook's blind spots (what safety-net catches that we don't):**

| Gap | Risk | Example |
|-----|------|---------|
| Shell wrapper bypass | **HIGH** | `bash -c "git reset --hard"` walks past our regex |
| `git stash drop/clear` | Medium | Permanently deletes stashed work |
| `git reset --merge` | Medium | Can lose uncommitted changes |
| `git checkout <ref> -- <path>` | Medium | We catch `checkout .` but not `checkout HEAD -- file.txt` |
| `find ... -delete` | Medium | Recursive file deletion |
| `xargs rm -rf` / `xargs bash -c` | Medium | Piped destruction |
| Interpreter bypass | Medium | `python -c 'os.system("rm -rf /")'` |
| `sudo`/`env` wrapper stripping | Low | `sudo git reset --hard` |
| Flag reordering | Low | `rm -r -f /` bypasses literal `-rf` match |

**Defense in depth -- sandboxing is not enough:**

Anthropic's sandboxing (macOS seatbelt + Linux bubblewrap) provides the outer wall -- OS-level filesystem/network isolation at the kernel level, 84% prompt reduction, git push restricted to configured branch via validation proxy. But sandboxing and hooks serve different threat models:

| Layer | What It Catches | Example |
|-------|----------------|---------|
| Sandboxing (OS-level) | Adversarial -- prompt injection trying to escape | Exfiltrate SSH keys, phone home to attacker |
| Hooks (behavioral) | Honest mistakes -- Claude doing something destructive | `git reset --hard` when it meant `--soft` |
| Both together | Defense in depth | Neither alone is sufficient |

Trail of Bits codified this: sandboxing + permission rules + hooks + devcontainers. Hooks are one layer in a stack.

**Complementary, not competing:** Safety-net only watches Bash commands. Our hook also blocks Write/Edit to .env/credentials/.git/, enforces branch policy, and blocks `--no-verify`. Running both is safe -- PreToolUse hooks stack.

### 2b-i. Safety Improvements -- Split into V2 (simple) and separate brainstorm (complex)

The safety improvements split cleanly into two categories:

**V2 -- Low-complexity, high-value additions to git-safety.ts (concrete, plannable now):**
1. Add `git stash drop` and `git stash clear` to BLOCKED_PATTERNS
2. Add `git reset --merge` to BLOCKED_PATTERNS
3. Add `git checkout <ref> -- <path>` detection (not just `checkout .`)
4. Add `find ... -delete` and `find ... -exec rm` to BLOCKED_PATTERNS
5. Improve flag parsing -- check for `-r` and `-f` independently, not just `-rf` literal

**Separate brainstorm needed -- shell tokenization architecture:**
The higher-complexity items (shell wrapper unwrapping, interpreter scanning, xargs analysis, CWD tracking, sudo stripping) require an architectural decision: build our own shell tokenization layer vs recommend `claude-code-safety-net` as companion. This is explored in `docs/brainstorms/2026-03-02-git-plugin-v2-advanced-safety.md`.

### 2c. Self-Destruct Timers -- V2 MUST

Every hook in the marketplace must have a self-destruct timer as the first executable line. This is a marketplace convention, not a safety architecture decision. V1 hooks don't have them.

**Implementation:** Add `setTimeout(() => process.exit(0), TIMEOUT_MS).unref()` as the first line of every hook. Timeout values:
- SessionStart (context loader): 5000ms
- PreToolUse (safety): 3000ms
- PostToolUse (logger): 3000ms
- PreCompact (summary): 5000ms
- Stop (auto-commit): 10000ms

**Decision: V2 -- required for marketplace compliance.**

### 2d. Incident Documentation -- ADOPT

Blake Crosley's insight: "The best hooks come from incidents, not planning." Each deny rule should trace to a specific failure.

**Proposed approach:** Add JSDoc comments to each `BLOCKED_PATTERNS` entry documenting what incident motivated it. For our existing patterns, the incident was "Claude Code was observed doing X in production." For `--no-verify`, the incident is documented (block-no-verify blog: "Claude Code was using --no-verify on almost every commit").

**Decision: V2 -- add incident documentation to git-safety.ts comments.**

### 2e. Four Defensive Layers -- ALREADY IMPLEMENTED

Blake Crosley's framework:
1. Prevention (PreToolUse) -- we have `git-safety.ts`
2. Context (SessionStart) -- we have `git-context-loader.ts`
3. Validation (PostToolUse) -- we have `command-logger.ts`
4. Quality (Stop) -- we have `auto-commit-on-stop.ts`

Plus we have a 5th layer (PreCompact: `session-summary.ts`) that extracts learnings before context compaction.

**Decision: No action needed -- V1 architecture matches the industry framework.**

---

## 3. Worktree Management -- SEPARATE BRAINSTORM

**Nathan's decision:** "Work tree management's not something I've settled on yet. I'm going to do that in some separate research."

This needs its own brainstorm session. The research collected extensive data, but the decisions are interconnected and non-trivial. See `docs/brainstorms/2026-03-02-git-plugin-v2-worktree-strategy.md`.

**For V2 port:** Keep existing `/worktree` command as-is. No changes.

---

## 4. Provenance and Attribution

### 4a. SSW Narrative Commit Strategy -- ADOPT as guidance

"Request AI to commit changes in logical order that tells a story -- data models, then business logic, then UI, then tests." Enhances review clarity.

This is already implicit in our "SPLIT large changes into atomic commits" safety rule. Making it explicit in CONVENTIONS.md as a recommended ordering pattern costs nothing.

**Decision: V2 -- add narrative ordering note to CONVENTIONS.md.**

### 4b. AI-POLICY.txt -- DEFER to V3

Proposed robots.txt-style file declaring repo AI usage policy. Filed on VS Code, Claude Code, Cursor. No implementations yet.

**Decision: V3 -- wait for adoption.**

---

## 5. Event Bus Architecture

### 5a. Current State

The V1 `event-bus-client.ts` posts to per-repo paths at `~/.cache/side-quest-git/{repo}/events.port`. The observability server has migrated to a global path at `~/.cache/side-quest-observability/events.port` with legacy fallback.

### 5b. Update for V2

The event bus client should support the global observability server path with fallback to the per-repo path. This matches the `discoverEventServer()` pattern in the observability server's `emit.ts`.

**Decision: V2 -- update event-bus-client.ts discovery path. (Addressed in Plan 2: Marketplace Compliance.)**

---

## 6. Git Intelligence -- SEPARATE BRAINSTORM

The Git Intelligence MCP-to-skill migration needs its own brainstorm. The auto-invoke behavior replication, SessionStart hook enhancement, and reference design are interconnected decisions. See `docs/brainstorms/2026-03-02-git-plugin-v2-git-intelligence-migration.md`.

**For V2 port:** No MCP, no new git-reads reference. Port the existing SessionStart hook as-is.

---

## Summary -- What's Concrete vs What Needs Brainstorming

### Open Question (carried from marketplace-port brainstorm)

**Should the PreCompact cortex extraction hook be its own plugin?** The `session-summary.ts` hook extracts decisions/errors/learnings via regex -- this overlaps with cortex-engineering's domain. Decide during Plan 1 (port as-is and evaluate) or Plan 2 (compliance review).

### Concrete -- Ready for Implementation Plans

These items have clear scope, clear implementation, and no blocking open questions:

| Plan | Goal | Key Items |
|------|------|-----------|
| **Plan 1: Port V1** | Get existing plugin into marketplace, zero changes | Directory structure, all files, validate passes |
| **Plan 2: Marketplace Compliance** | Match cortex-engineering conventions | Self-destruct timers, references/ restructure, SKILL.md polish, event bus global path |
| **Plan 3: Safety Fixes** | Close low-complexity gaps from safety-net analysis | stash drop/clear, reset --merge, checkout path, find -delete, flag parsing, incident docs, tests |
| **Plan 4: New Commands** | Two new commands from research | `/commit-push-pr`, `/clean-gone`, routing table update |
| **Plan 5: Reference Updates** | Research-backed content improvements | CONVENTIONS.md updates (dual-audience, anti-slop, AI-assistant trailer, narrative ordering) |

### Needs Separate Brainstorming

These items have open questions, interconnected decisions, or need more exploration before they can be planned:

| Brainstorm | Why It's Not Ready | Key Questions |
|------------|-------------------|---------------|
| **Worktree Strategy** | Nathan hasn't settled on direction | Native Claude Code worktrees vs our CLI? Session managers? .worktreeinclude? Session persistence workaround? |
| **Git Intelligence Migration** | Auto-invoke behavior replication is non-trivial | SessionStart hook scope? Reference design? How to trigger proactive git reads without MCP tool palette? |
| **Advanced Safety (Shell Tokenization)** | Architectural decision: build vs recommend | Build shell tokenization into our hook vs recommend safety-net as companion? What's the right boundary between our hook and theirs? |

### Deferred (no brainstorming needed, just waiting)

| Feature | Version | Why Wait |
|---------|---------|----------|
| Git AI v3.0.0 integration | V2.1 | Needs more traction; add awareness not dependency |
| `.worktreeinclude` convention | V2.1 | Part of worktree brainstorm |
| Session identity keying | V2.1 | Part of worktree brainstorm |
| AI-POLICY.txt enforcement | V3 | No implementations yet |
| Prompt injection defense | V3 | Different concern than git safety |
| Multi-agent review stacks | V3 | Requires orchestration beyond plugin |

### Skip

| Feature | Reason |
|---------|--------|
| Anthropic `/commit` command | Our version is strictly better |
| Anthropic `/commit-push-pr` approach | Single-shot is a footgun; our chained approach is safer |
| Full Git AI dependency in plugin | Too early; per-machine install, not per-plugin |
