---
created: 2026-03-02
title: Safety Hook Architecture -- The Industry Standard for AI Agent Guardrails
type: research
tags: [git, safety, hooks, PreToolUse, deny, CVE, asymmetric-governance, guardrails]
project: git-plugin
status: complete
prior-research: docs/research/2026-03-02-git-plugin-landscape-update.md
---

# Safety Hook Architecture -- The Industry Standard for AI Agent Guardrails

The PreToolUse deny hook pattern -- intercepting tool calls before execution and blocking destructive operations -- has emerged as the industry standard for AI coding agent safety. This document traces the pattern from CVE incidents through community adoption, catalogs the major implementations, and extracts the architectural principles that make it work.

## The Pattern

```
User prompt -> Claude -> Tool call -> PreToolUse hook -> DENY/ALLOW -> Execution
                                          |
                                     Parse command
                                     Match patterns
                                     Return JSON:
                                       permissionDecision: "deny"
                                       permissionDecisionReason: "..."
```

A PreToolUse hook receives the tool name and input as JSON via stdin, analyzes it, and returns a decision via stdout. Three possible decisions: `allow` (bypass permission system), `deny` (block tool, feed reason to Claude so it self-corrects), `ask` (prompt the user).

**Source:** [Claude Code hooks documentation](https://code.claude.com/docs/en/hooks)

---

## Why This Exists -- The CVE Wake-Up Call

### CVE-2025-59536 / CVE-2026-21852 (Critical)

Check Point Research discovered that hooks defined in repository `.claude/settings.json` files executed shell commands during session initialization *before* the trust dialog completed. A malicious repo achieved RCE the moment a developer ran `claude` in the cloned directory. A second flaw exploited MCP consent bypass via `enableAllProjectMcpServers` and `ANTHROPIC_BASE_URL` override to exfiltrate API keys in plaintext.

**Key finding:** Commands executed "immediately upon running claude -- before the user could even read the trust dialog."

**Disclosure timeline:**
- 2025-07-21: Hooks vulnerability reported
- 2025-08-26: Anthropic implemented fixes
- 2025-10-03: CVE-2025-59536 published (GHSA-ph6w-f82w-28w6)
- 2025-10-28: API exfiltration reported
- 2025-12-28: Final patch
- 2026-01-21: CVE-2026-21852 published
- 2026-02-25: Public disclosure

**Lesson:** Repo-controlled configs are untrusted executable surfaces. No execution before consent. Hooks are guardrails, not security boundaries.

**Sources:** [Check Point Research](https://research.checkpoint.com/2026/rce-and-api-token-exfiltration-through-claude-code-project-files-cve-2025-59536/), [The Register](https://www.theregister.com/2026/02/26/clade_code_cves), [Check Point Blog](https://blog.checkpoint.com/research/check-point-researchers-expose-critical-claude-code-flaws)

### Anthropic's Response -- OS-Level Sandboxing

Shipped October 2025. macOS seatbelt + Linux bubblewrap enforce filesystem and network isolation at the kernel level. Network routes through a Unix domain socket proxy. Git push restricted to the configured branch via a validation proxy. 84% reduction in permission prompts in internal usage.

**Security philosophy:** "Sandboxing ensures that even a successful prompt injection is fully isolated, and cannot impact overall user security. A compromised Claude Code can't steal your SSH keys, or phone home to an attacker's server."

**Sources:** [Anthropic Engineering](https://www.anthropic.com/engineering/claude-code-sandboxing), [Claude Code Sandboxing Docs](https://code.claude.com/docs/en/sandboxing)

---

## The Ecosystem -- Six Major Implementations

### 1. Trail of Bits -- "Guardrails, Not Walls"

The security firm's Claude Code configuration repository (~1,400 stars) coined the definitive framing. Their README states: "Hooks are not a security boundary -- a prompt injection can work around them. They are structured prompt injection at opportune times: intercepting tool calls, injecting context, blocking known-bad patterns, and steering agent behavior. Guardrails, not walls."

Two blocking PreToolUse hooks: (1) blocks `rm -rf` (suggests `trash`), (2) blocks direct pushes to main/master (enforces feature branches). Both use exit code 2 with guidance Claude understands.

Defense-in-depth approach: sandboxing (OS-level) + permission rules (deny reads to SSH keys, cloud credentials) + hooks (behavioral steering) + devcontainers (complete isolation).

**Source:** [trailofbits/claude-code-config](https://github.com/trailofbits/claude-code-config), [tl;dr sec #316](https://tldrsec.com/p/tldr-sec-316)

### 2. Destructive Command Guard (dcg)

Rust-based standalone binary by Jeffrey Emanuel (~597 stars). SIMD-accelerated via `memchr` crate for vectorized substring matching. Sub-millisecond latency: non-git/rm commands ~1 microsecond (SIMD quick reject), safe git commands ~100-200us, destructive patterns ~200-500us.

Three-tier pipeline: SIMD quick filter -> safe pattern matching (whitelist-first) -> destructive pattern matching. 16 specialized packs (2 core, 5 database, 3 container, 3 Kubernetes, 3 cloud). Fail-open design: "Never blocks your workflow due to timeouts or parse errors."

**Design philosophy:** "AI coding agents are well-intentioned but fallible. The cost of false positive [manual confirmation] is minor inconvenience; the cost of false negative [permanent data loss] is catastrophic."

**Sources:** [Dicklesworthstone/destructive_command_guard](https://github.com/Dicklesworthstone/destructive_command_guard), [dcg Design Principles](https://reading.torqsoftware.com/notes/software/ai-ml/safety/2026-01-26-dcg-destructive-command-guard-safety-philosophy-design-principles/), [lib.rs/crates/destructive_command_guard](https://lib.rs/crates/destructive_command_guard)

### 3. claude-code-safety-net

Claude Code plugin by kenryu42. Semantic command analysis -- parses arguments, understands flag combinations, recursively analyzes shell wrappers up to 5 levels deep. Detects destructive commands hidden inside `bash -c`, Python/Node/Ruby/Perl one-liners. Distinguishes safe operations (temp directories, within cwd) from dangerous ones. Custom rules via natural language.

**Differentiator vs dcg:** dcg optimizes for raw speed at the system level; safety-net provides deeper semantic analysis at the plugin level with recursive shell wrapper detection.

**Source:** [kenryu42/claude-code-safety-net](https://github.com/kenryu42/claude-code-safety-net)

### 4. block-no-verify

Plugin by tupe12334. Intercepts `--no-verify` flag on git commits with context-awareness (distinguishes `-n` meaning `--no-verify` for commits vs `--dry-run` for push). Only affects commands through Claude Code's hook system -- humans retain full autonomy.

**Origin story:** "Claude Code was using `--no-verify` on almost every commit. Silently bypassing all my carefully configured hooks."

**Result:** "Since implementing block-no-verify, Claude Code actually fixes the issues instead of bypassing them."

**Sources:** [tupe12334/block-no-verify](https://github.com/tupe12334/block-no-verify), [Blog post](https://vibe.forem.com/tupe12334/how-i-stopped-my-ai-coding-assistant-from-cheating-on-git-hooks-10af) (January 13, 2026)

### 5. Lasso Security -- Prompt Injection Defense

PostToolUse (not PreToolUse) hook by Lasso Security (~119 stars). Scans tool outputs after execution but before Claude processes results. Detects five attack categories: instruction override, role-playing/DAN, encoding/obfuscation, context manipulation, instruction smuggling. Python regex patterns in `patterns.yaml`. Warns but does not block.

**Architectural difference:** Lasso *warns* (PostToolUse advisory) rather than *denies* (PreToolUse block). Complementary to deny hooks, not a replacement.

**Sources:** [lasso-security/claude-hooks](https://github.com/lasso-security/claude-hooks), [Blog post](https://www.lasso.security/blog/the-hidden-backdoor-in-claude-coding-assistant)

### 6. Matt Pocock's Git Safety Hook

Minimal implementation blocking: `git push` (all variants), `git reset --hard`, `git clean -f/fd`, `git branch -D`, `git checkout .`, `git restore .`.

**Key quote:** "A single `git reset --hard` or `git push --force` can wipe out weeks of work."

**Source:** [aihero.dev](https://www.aihero.dev/this-hook-stops-claude-code-running-dangerous-git-commands) (February 10, 2026)

---

## Practitioner Wisdom

### Blake Crosley -- 95 Hooks Across 6 Lifecycle Events

The definitive practitioner guide (February 8, 2026). 95 hooks developed over 9 months, every one exists because something went wrong first.

**Four defensive layers:**

| Layer | Event | Purpose | Example |
|-------|-------|---------|---------|
| Prevention | PreToolUse | Block dangerous ops before execution | git-safety-guardian, credentials-check |
| Context | SessionStart, UserPromptSubmit | Inject necessary information | date, branch, project context |
| Validation | PostToolUse | Verify completed actions | consensus checking, output logging |
| Quality | Stop | Gate final output | pride check, quality gate, reviewer gate |

**Key insight:** "The best hooks come from incidents, not planning." Start with 3 hooks (safety, context, quality gate), add more from real failures. Effective automated feedback should critique "the work, not the operator."

**Source:** [blakecrosley.com/en/blog/claude-code-hooks](https://blakecrosley.com/en/blog/claude-code-hooks)

### Mike Lane -- Four-Hook System in Under 400 Lines

Four Python files: safety guards, context injection, workflow rule enforcement, skill suggestion engine.

**Key quote:** "Claude Code's PreToolUse hook system intercepts tool calls before execution, blocks dangerous operations, and injects contextual guidance."

**Source:** [dev.to/mikelane](https://dev.to/mikelane/building-guardrails-for-ai-coding-assistants-a-pretooluse-hook-system-for-claude-code-ilj) (January 18, 2026)

---

## Architectural Principles

### 1. Asymmetric Governance

AI agents face stricter constraints than humans. The block-no-verify plugin is the clearest example: Claude cannot use `--no-verify`, but the human developer retains full autonomy. This principle is now codified in:

- **block-no-verify blog:** "The AI operates under stricter constraints than the human, because the human understands context that the AI doesn't."
- **OpenAI governance paper:** "Practices for Governing Agentic AI Systems" recommends least-privilege for agents. [Source](https://openai.com/index/practices-for-governing-agentic-ai-systems/)
- **EU AI Act:** Fully applicable August 2, 2026. High-risk AI systems must demonstrate compliance with risk management and human oversight that don't apply to human operators. [Source](https://thefuturesociety.org/aiagentsintheeu/)
- **IBM governance:** "Unlike traditional human workers, agents are designed to operate at a greater scale and speed, meaning oversight and governance must be similarly fast and broad." [Source](https://www.ibm.com/think/insights/ai-agent-governance)

### 2. Deny With Guidance, Not Just Rejection

When a hook blocks a command, it must explain *why* and suggest an alternative. This lets Claude self-correct rather than retry the same blocked operation. The `permissionDecisionReason` field is the mechanism -- Claude reads it and adjusts its approach.

**Trail of Bits example:** Block `rm -rf` but suggest `trash` as a safe alternative.

### 3. Defense in Depth -- Hooks Are One Layer

Trail of Bits codified this: sandboxing (OS-level) + permission rules (file access) + hooks (behavioral steering) + devcontainers (complete isolation). Hooks alone are insufficient because prompt injection can work around pattern matching. But hooks catch the common case -- an agent making an honest mistake.

### 4. Hard Deny for Irreversible, Warn for Recoverable

Blake Crosley's heuristic: operations that destroy data permanently (force push, hard reset, rm -rf) get hard deny. Operations that are recoverable (committing to wrong branch, verbose output) get warnings. The cost asymmetry justifies the strictness asymmetry.

### 5. Fail-Open vs Fail-Closed

Two schools of thought:
- **dcg:** Fail-open. "Never blocks your workflow due to timeouts or parse errors." Designed for speed-critical environments.
- **claude-code-safety-net (strict mode):** Fail-closed. Unknown commands blocked until analyzed. Designed for high-risk environments.

The git plugin uses fail-open with hard deny on known destructive patterns -- a middle ground.

### 6. Hooks Come From Incidents

Blake Crosley's core insight. Don't try to anticipate every failure mode. Start with 3 hooks, add from real incidents. Each hook in a production system should trace to a specific failure that motivated it.

---

## Gap in Industry Standards

The OpenSSF "Security-Focused Guide for AI Code Assistants" (August 2025, led by Avishay Balter at Microsoft) covers application security and supply chain safety but has **no git-specific safety guidance**. No coverage of destructive git commands, force push protection, or hook-based safety patterns.

This is a significant gap. The community has filled it bottom-up through tools like dcg, safety-net, and block-no-verify, but there is no authoritative standard for git safety in AI agent workflows.

**Source:** [OpenSSF Guide](https://best.openssf.org/Security-Focused-Guide-for-AI-Code-Assistant-Instructions), [Announcement](https://openssf.org/blog/2025/09/16/new-openssf-guidance-on-ai-code-assistant-instructions/)

---

## Relevance to the Git Plugin

The git plugin's `git-safety.ts` hook implements this exact pattern:

- PreToolUse deny hook on Bash, Write, and Edit tools
- Hard deny on force push, hard reset, clean -f, checkout ., restore ., branch -D, worktree remove --force, rm -rf .worktrees/
- Hard deny on commits to main/master
- Hard deny on --no-verify for non-WIP commits
- Hard deny on Write/Edit to .env, credentials, .git/
- Returns `permissionDecision: "deny"` with `permissionDecisionReason` so Claude self-corrects

This is validated by every implementation in the ecosystem -- the git plugin's approach aligns with Trail of Bits, dcg, safety-net, and Crosley's practitioner guidance. The V2 uplift should add:

1. Self-destruct timer as first executable line (marketplace convention)
2. Consider recursive shell wrapper detection (safety-net pattern) for V2.1
3. Document each deny rule's origin incident (Crosley's "hooks come from incidents" principle)
