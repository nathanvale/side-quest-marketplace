---
created: 2026-03-02
title: "Git Plugin V2 - Phase 5: Reference Updates"
type: plan
tags: [git, plugin, conventions, dual-audience, anti-slop, safety-net]
project: git-plugin
status: draft
parent: docs/plans/2026-03-02-feat-git-plugin-v2-marketplace-port-plan.md
prerequisite: docs/plans/2026-03-02-feat-git-plugin-v2-phase-4-commands-plan.md
origin:
  - docs/brainstorms/2026-03-02-git-plugin-v2-feature-evaluation.md (Sections 1e, 1f, 1g, 4a)
  - docs/brainstorms/2026-03-02-git-plugin-v2-advanced-safety.md (Option B)
  - docs/research/2026-03-02-git-plugin-landscape-update.md
deepened: 2026-03-02
deepened-round-2: 2026-03-03
deepened-round-3: 2026-03-03
---

> Phase 5 of 5 from the master plan
> Prerequisite: Phase 4 (new commands) must be complete
> Scope: `references/conventions.md` and `references/workflows.md` only -- minimal code changes (one existing line update)

# Phase 5: Reference Updates

## Enhancement Summary

**Deepened:** 2026-03-02 (Round 1: 8 agents)
**Deepened:** 2026-03-03 (Round 2: 7 agents -- 3 research, 4 review)
**Deepened:** 2026-03-03 (Round 3: 3 research agents -- anti-slop, 50/72 impact, AI attribution)

**Round 1 agents (8):** architecture-strategist, code-simplicity-reviewer, agent-native-reviewer, spec-flow-analyzer, best-practices-researcher x3, safety-net-researcher

**Round 2 agents (7):** anti-slop-patterns-researcher, ai-attribution-researcher, safety-net-researcher, spec-flow-analyzer, architecture-strategist, code-simplicity-reviewer, agent-native-reviewer

### Key Improvements (Round 1)

1. **Restructured dual-audience as a Body section enhancement** -- instead of a standalone section, embed the "what it affects" guidance within the existing Body section of conventions.md (architecture review)
2. **Added before/after examples to anti-slop** -- Claude needs concrete contrast pairs to reliably change behavior, not just rule lists (agent-native review, anti-slop research)
3. **Merged AI attribution into existing Footer section** -- Co-Authored-By is already a footer concern; adding a standalone section creates redundancy (architecture review, simplicity review)
4. **Moved narrative ordering to workflows.md** -- ordering is a workflow instruction, not a convention; belongs in the commit workflow (agent-native review)
5. **Hardened safety-net section against rot** -- removed star counts and specific depth numbers that go stale (simplicity review, safety-net research)
6. **Added Step 0 preflight** -- verify Phase 4 is complete and reference files exist before editing (flow analysis)
7. **Added em dash grep verification** -- plan adds content; must verify no em dashes slipped in (flow analysis)

### Key Improvements (Round 2)

8. **Fixed all stale `plugins/git/` paths to `plugins/dx-git/`** -- plugin was renamed in Phase 3; 5 path references were wrong (all 4 reviewers converged on this)
9. **Fixed Step 2 insertion point** -- plan said "after Breaking Changes (last section)" but Full Examples is actually the last section in conventions.md; anti-slop appends at end of file after Full Examples (flow analysis)
10. **Resolved subject line length conflict** -- existing conventions.md says "Max 100 chars" but anti-slop said "under 72, prefer 50"; update existing rule to "Max 72 chars (prefer under 50)" to match community 50/72 standard (flow analysis, anti-slop research)
11. **Fixed SPLIT insertion point** -- plan said "find SPLIT step in workflows.md" but SPLIT only exists in SKILL.md; narrative ordering now adds as a new step 8 in the Commit workflow of workflows.md (architecture, flow analysis)
12. **Dropped AI-assistant trailer** -- no RFC, no tool adoption, Nathan's team doesn't use multi-model workflows; YAGNI (simplicity, agent-native, AI attribution research)
13. **Added subtler "bad" anti-slop example** -- first-person narration is too obviously bad; Claude's real slop is third-person process narration ("The investigation revealed..."); added second example pair (agent-native review, anti-slop research)
14. **Moved safety-net section to README.md** -- Claude cannot install tools; safety-net content is human-only documentation that burns tokens in an agent-facing file; 3-line mention in README instead (agent-native, simplicity)
15. **Simplified narrative ordering** -- replaced prescriptive 5-item list with one-sentence principle ("order so each builds on the previous"); avoids false precision for codebases without all 5 layers (simplicity)
16. **Trimmed anti-slop bullet list** -- redundant with before/after examples; keep only the closing one-liner "The diff shows how. The message explains what and why." (simplicity)
17. **Updated safety-net install command** -- npm package is `cc-safety-net`, standard install is via plugin marketplace or `bunx cc-safety-net` (safety-net research)
18. **Updated Final V2 Checklist** -- stale version numbers (2.0.0 -> 3.1.0) and path references (safety-net research)
19. **Added slop-table of before/after transformations** -- compact table format is low-token, concrete, and effective for few-shot steering; academic research validates 3-5 examples as the sweet spot (anti-slop research)

### Sections Changed vs Original

| Section | Original Plan | Round 1 Enhanced | Round 2 Enhanced |
|---------|--------------|------------------|------------------|
| Dual-audience | Standalone new section | Embedded in Body | Trimmed "(human and AI)" filler |
| Anti-slop | DO/DON'T lists only | Before/after pair + bullet list | Two example pairs (obvious + subtle) + slop table, no bullet list |
| AI attribution | Standalone section + AI-assistant trailer | Merged into Footer | Dropped AI-assistant trailer entirely |
| Narrative ordering | 5-item prescriptive list in conventions.md | Moved to workflows.md SPLIT | One-sentence principle as Commit step 8 |
| Safety-net | In workflows.md, star counts | In workflows.md, no stats | Moved to README.md (3 lines) |
| Validation | `bun run validate` only | Preflight + em dash grep | Added structure verification commands |
| Subject line length | No change to existing | No change | ~~Update "Max 100" to "Max 72 (prefer 50)"~~ REVERTED: Keep "Max 100" (aligned with commitlint/Angular/React) |
| Plan paths | `plugins/git/` | `plugins/git/` | Fixed to `plugins/dx-git/` |

### Key Improvements (Round 3)

20. **REVERTED subject line length change** -- Round 2 proposed changing "Max 100" to "Max 72 (prefer 50)" but deep research found this MISALIGNS with the Conventional Commits ecosystem: commitlint/config-conventional uses 100, Angular uses 100, React uses 100. The traditional 50/72 rule predates Conventional Commits and doesn't account for `type(scope): ` prefix overhead (~15 chars). Keep "Max 100 chars" as-is. Anti-slop section already encourages concise subjects without prescribing a competing number.
21. **Confirmed AI attribution content is current** -- Co-Authored-By with `Claude <noreply@anthropic.com>` remains the de facto standard (4% of public GitHub commits now have AI co-authorship). git-ai v3.0.0 uses git notes for line-level attribution but is complementary, not a replacement. No new RFCs since mid-2025. The AI-assistant trailer still has zero adoption. Plan content validated as correct.
22. **Added slop vocabulary deny-list to anti-slop** -- academic research (Max Planck Institute) and community lists (Wikipedia "Signs of AI writing") identify specific words as AI tells: ensure, comprehensive, robust, streamline, enhance, leverage, seamless, proper. Added as a compact reference table.
23. **Noted subagent pattern as V2.1 candidate** -- spawning an isolated-context agent for commit message generation (shibayu36's pattern) is the strongest anti-slop technique but is an architectural change, not documentation. Already in "What's NOT in This Phase" table.

### Considerations Discovered (Round 3)

- Traditional 50/72 rule is incompatible with Conventional Commits prefix overhead (~15 chars); all major CC tools use 100 chars -- this is a settled convention, not worth fighting
- Slop vocabulary deny-lists are effective for high-confidence detection but can over-trigger on domain-specific uses (e.g., "ensure" in security contexts); the table format with "use instead" suggestions is safer than a hard ban
- Subagent pattern (spawning isolated context for commit messages) eliminates conversation bleed as the root cause of slop, rather than treating symptoms with word lists; strongest technique but architectural, not documentation
- commit-msg hook for slop detection (regex-based) is feasible for high-confidence patterns (first-person narration, "This commit...") but would be a code change, not documentation -- deferred to V2.1

### Considerations Discovered (Round 2)

- The "Generated with [Claude Code]" line is NOT a git trailer -- it is a free-form body line that some teams strip as marketing noise; the plan does not modify this behavior
- Conventional Commits spec has an open proposal for an `agent` type (#685, Feb 2026) -- not adopted, not relevant yet
- The subagent pattern (spawning a clean-context agent for commit message generation) is the strongest anti-slop technique; out of scope for this documentation phase but worth noting for V2.1
- PreToolUse hooks run sequentially in definition order, not parallel; a deny from dx-git short-circuits before safety-net runs
- 94.5% of popular NPM projects use Conventional Commits (2025 study) -- the standard is well-established
- No jurisdiction mandates AI attribution in version control (EU AI Act targets consumer content, not source code)

---

## Goal

Apply research-backed content improvements to the skill reference docs. These are guidance additions -- they inform how the skill writes commit messages and what safety recommendations it makes. Append-only changes to reference files. No structural changes, no new features.

## Context from Brainstorms

Each addition traces to a specific brainstorm decision:

| Addition | Source | Nathan's Take |
|----------|--------|---------------|
| Dual-audience writing | Feature eval 1e | "I don't know about that" -- adopt as guidance only, not enforcement |
| Anti-slop guardrails | Feature eval 1g | Approved -- practical quality improvement |
| AI attribution | Feature eval 1f | Keep Co-Authored-By default |
| Narrative ordering | Feature eval 4a (SSW pattern) | Approved -- already implicit in "SPLIT" rule, make explicit |
| Safety-net companion | Advanced safety (Option B) | Approved -- recommend, don't build |

---

## Step 0: Preflight

Before editing reference files, verify prerequisites:

```bash
# Phase 4 must be complete -- reference files must exist
test -f plugins/dx-git/skills/workflow/references/conventions.md || echo "MISSING: conventions.md"
test -f plugins/dx-git/skills/workflow/references/workflows.md || echo "MISSING: workflows.md"

# Verify section structure to confirm insertion points
grep -n '^## ' plugins/dx-git/skills/workflow/references/conventions.md
grep -n '^## ' plugins/dx-git/skills/workflow/references/workflows.md
```

Both files must exist. If either is missing, Phase 4 is not complete -- stop and complete it first.

**Expected structure of `conventions.md`:**
- `## Types`
- `## Scope Guidelines`
- `## Subject Rules`
- `## Body (Optional)`
- `## Footer (Optional)`
- `## Breaking Changes`
- `## Full Examples` (this is the LAST section -- not Breaking Changes)

**Expected structure of `workflows.md`:**
- `## Commit (Conventional Commits)` (7 steps)
- `## Squash`
- `## Checkpoint`
- `## PR (Pull Request)`
- `## Session Log`
- `## Review PR`
- `## Changelog`
- `## Compare`
- `## Commit-Push-PR`
- `## Clean-Gone`

If the structure has changed since this plan was written, adjust insertion points accordingly.

---

## Step 1: Embed dual-audience guidance in the Body section of conventions.md

**embed the guidance within the existing Body section** of `references/conventions.md`. This is where developers look when writing commit bodies -- a separate section at the bottom gets skipped.

Find the Body section (after the line "Separate from subject with a blank line.") and append:

```markdown
When a commit touches multiple areas, name the affected modules or services in the body so readers know which diffs matter without reading every changed file.
```

**Do NOT:**
- Add a standalone "Dual-Audience Writing" section header
- Add bullet lists or the three-element framework (what/why/what-it-affects)
- Add enforcement language or validation requirements

---

## Step 2: Add anti-slop guardrails to conventions.md

**No subject line length change.** Round 3 research found that commitlint/config-conventional (100), Angular (100), and React (100) all use 100 chars. The traditional 50/72 rule predates Conventional Commits and doesn't account for `type(scope): ` prefix overhead. Keep "Max 100 chars" as-is.

Append at the **end of the file** (after the `## Full Examples` section, which is the last section) in `references/conventions.md`:

````markdown
## Anti-Slop Guardrails

Bad commit messages echo the debugging session. Good ones describe the outcome.

**Bad -- narrates the journey:**

```
fix(auth): fix token validation

First I checked the error logs and saw null pointer exceptions.
After investigating, I found that validateToken() didn't handle
empty OAuth payloads. I added a null guard and updated the tests.
```

**Good -- describes the outcome:**

```
fix(auth): reject null OAuth tokens before validation

Empty OAuth payloads from the provider caused a null pointer in
validateToken(). The null guard returns 401 before reaching the
JWT decoder.
```

**Bad -- subtle process narration:**

```
refactor(db): refactor query builder for better performance

The investigation revealed that the query builder was generating
suboptimal joins. Testing confirmed that rewriting the join logic
reduced query time across all endpoints.
```

**Good -- states what changed and why:**

```
perf(db): rewrite join logic in query builder

Inner joins replace left joins where nulls are impossible.
Benchmarked: 3x faster on the /users endpoint.
```

**Common slop transformations:**

| Slop | Clean |
|------|-------|
| `This commit adds JWT auth support` | `feat(auth): add JWT authentication` |
| `Updated user service to ensure proper error handling` | `fix(user): handle null response in getUser` |
| `Refactored and streamlined the database query` | `perf(db): add index on users.email` |
| `Let's fix the bug where login fails` | `fix(auth): prevent login failure on expired token` |

**Words that signal AI-generated text** (avoid in commit messages):

| Avoid | Use instead |
|-------|-------------|
| ensure | verify, check, guard |
| comprehensive | (omit -- show scope via file list) |
| robust | (omit -- tests prove robustness) |
| streamline | simplify, reduce |
| enhance | improve, add |
| leverage | use |
| seamless | (omit -- users decide) |
| proper | correct, valid |

The diff shows *how*. The message explains *what* and *why*.
````

---

## Step 3: Add AI attribution to the Footer section of conventions.md

**extend the existing Footer section** in `references/conventions.md`. Co-Authored-By is already a footer trailer -- this is where it belongs.

Find the Footer section (after the last bullet `- Co-Authored-By: for pair programming`) and append:

```markdown

### AI Attribution

Always add `Co-Authored-By: Claude <noreply@anthropic.com>` when Claude generates or substantially modifies code. GitHub renders this as a co-author avatar in the commit list.
```

**Do NOT add:**
- The `AI-assistant:` trailer (no RFC, no tool adoption, YAGNI)
- Platform rendering details (GitHub/GitLab/Bitbucket comparison)
- Privacy considerations about prompt text

---

## Step 4: Add narrative ordering to the Commit workflow in workflows.md

Add as a new **step 8** in the `## Commit (Conventional Commits)` section of `references/workflows.md`, after step 7 ("Handle hook failures"):

```markdown
8. **Split large changes**: When a commit spans multiple concerns, split into atomic commits ordered so each builds on the previous -- reviewers should be able to follow the progression without jumping between commits
```

This is a workflow instruction (how to sequence commits), not a convention (how to format a single commit). It makes the existing SPLIT safety rule from SKILL.md actionable within the commit procedure.

---

## Step 5: Add safety-net companion recommendation to README.md

Instead of adding to `workflows.md` (which is an agent-facing operational reference), add to `plugins/dx-git/README.md` (which is human documentation). Claude cannot install tools -- this content is purely for human users.

Find the "Pre-Merge Validation" section in README.md and append after it:

```markdown
### Companion: claude-code-safety-net

Our `git-safety.ts` hook uses pattern matching on raw commands. For deeper Bash analysis (wrapped commands, nested interpreters), consider [claude-code-safety-net](https://github.com/kenryu42/claude-code-safety-net) (`cc-safety-net` on npm). Both hooks coexist as sequential PreToolUse hooks.
```

---

## Step 6: Validate

```bash
# 1. Verify no em dashes slipped into the new content
grep -r '—' plugins/dx-git/skills/workflow/references/ && echo "FAIL: em dash found" || echo "OK: no em dashes"

# 2. Run full validation
bun run validate
```

Both must pass. No new tests needed -- these are documentation changes to `.md` files.

---

## Success Criteria

- [ ] `references/conventions.md` Body section has dual-audience guidance (one sentence, no "human and AI" parenthetical)
- [ ] `references/conventions.md` Subject Rules keeps "Max 100 chars" (aligned with commitlint/config-conventional)
- [ ] `references/conventions.md` has Anti-Slop Guardrails section with two before/after pairs + slop table + closing one-liner
- [ ] `references/conventions.md` Footer section has AI Attribution subsection (Co-Authored-By only, no AI-assistant trailer)
- [ ] `references/workflows.md` Commit workflow has step 8 for splitting/ordering
- [ ] `plugins/dx-git/README.md` has 3-line safety-net companion recommendation
- [ ] No standalone "Dual-Audience Writing" section (embedded in Body instead)
- [ ] No standalone "AI Attribution" section (embedded in Footer instead)
- [ ] No AI-assistant trailer documented
- [ ] No em dashes in any added content (uses `--`)
- [ ] Each section traces to a specific brainstorm decision
- [ ] `bun run validate` passes

---

## Final V2 Checklist (All 5 Phases Complete)

After this phase, all V2 work is done. Final verification:

```bash
bun run validate && bun test plugins/dx-git/
```

- [ ] `plugins/dx-git/` exists with full structure
- [ ] marketplace.json has dx-git plugin registered
- [ ] plugin.json version `3.1.0` (or later), 12 commands, description polished
- [ ] 5 hook entry points have self-destruct timers
- [ ] Event bus discovery uses global path with V1 fallback
- [ ] References in `references/` subdirectory (lowercase)
- [ ] SKILL.md has WHAT+WHEN+WHEN-NOT description, updated routing table
- [ ] 5 new safety patterns + checkout checker + rm flag helper
- [ ] All safety patterns have `@incident`/`@rationale` JSDoc
- [ ] 2 new commands (commit-push-pr, clean-gone) with workflow docs
- [ ] conventions.md has dual-audience (in Body), anti-slop (with examples), AI attribution (in Footer, Co-Authored-By only)
- [ ] workflows.md has narrative ordering (step 8 in Commit workflow)
- [ ] README.md has safety-net companion recommendation
- [ ] All tests pass
- [ ] No em dashes anywhere

---

## What's NOT in This Phase

| Deferred | Reason |
|----------|--------|
| Subagent pattern for commit message generation | Architectural change, not documentation; V2.1 candidate |
| AI-assistant trailer | No RFC, no adoption, YAGNI |
| `--json` structured output flag | Nice-to-have, not MVP |
| Commit-msg hook for slop detection | Code change, not documentation |
| `agent` commit type (CC spec #685) | Not adopted by spec maintainers |
| git-ai v3.0.0 integration | External tool, niche adoption |

---

## Appendix: Research Sources (Round 2)

### Anti-Slop Commit Patterns
- [shibayu36 - Subagent commit messages](https://dev.to/shibayu36/creating-project-specific-commit-messages-with-claude-code-subagents-514f) -- subagent pattern for context isolation
- [cuong.io - Commit message prompt](https://cuong.io/blog/2025/06/09-a-commit-message-prompt) -- explicit negative constraints
- [cbea.ms - How to write a commit message](https://cbea.ms/git-commit/) -- canonical 50/72 rule
- [thirstybear.co.uk - Git commit 50 chars](https://blog.thirstybear.co.uk/2025/05/git-commit-messages-why-keep-50.html) -- 2025 reaffirmation with typography research
- [Max Planck Institute / walterwrites.ai - Common ChatGPT words](https://walterwrites.ai/most-common-chatgpt-words-to-avoid/) -- AI vocabulary tells
- [Wikipedia - Signs of AI writing](https://en.wikipedia.org/wiki/Wikipedia:Signs_of_AI_writing) -- community-maintained slop word list
- [arxiv.org - Few-shot commit evaluation](https://arxiv.org/html/2507.10906v1) -- 3-5 example pairs is the sweet spot
- [Conventional Commits spec - Issue #685](https://github.com/conventional-commits/conventionalcommits.org/issues/685) -- proposed `agent` type
- [Smithery anti-slop skills](https://smithery.ai/skills/rand/anti-slop) -- emerging AI slop detection tools

### AI Attribution
- [Bence Ferdinandy - Don't abuse Co-authored-by](https://bence.ferdinandy.com/2025/12/29/dont-abuse-co-authored-by-for-marking-ai-assistance/) -- AI-assistant trailer proposal
- [git-ai v3.0.0 spec](https://github.com/git-ai-project/git-ai/blob/main/specs/git_ai_standard_v3.0.0.md) -- line-level attribution via git notes
- [Claude Code Attribution Issue #617](https://github.com/anthropics/claude-code/issues/617) -- includeCoAuthoredBy configuration
- [SSW Rule - Attribute AI-assisted commits](https://www.ssw.com.au/rules/attribute-ai-assisted-commits-with-co-authors) -- corporate policy example
- [OpenAI Codex CLI - Attribution PR](https://github.com/openai/codex/pull/11617) -- Codex's configurable attribution
- [Copilot Coding Agent authorship](https://github.com/orgs/community/discussions/179983) -- AI as primary author controversy

### Safety-Net Companion
- [kenryu42/claude-code-safety-net](https://github.com/kenryu42/claude-code-safety-net) -- v0.7.1, 1,103 stars, MIT
- [cc-safety-net on npm](https://www.npmjs.com/package/cc-safety-net) -- package name
- [Checkmarx - Bypassing Claude Code](https://checkmarx.com/zero-post/bypassing-claude-code-how-easy-is-it-to-trick-an-ai-security-reviewer/) -- shell wrapper bypass vectors
- [Claude Code hooks docs](https://code.claude.com/docs/en/hooks) -- PreToolUse hook lifecycle

## Appendix: Research Sources (Round 3)

### 50/72 Subject Line Impact Analysis
- commitlint/config-conventional uses `max-line-length: 100` (default)
- Angular commit conventions: 100 chars max
- React commit conventions: 100 chars max
- Tim Pope 50/72 rule (2008) predates Conventional Commits prefix overhead (~15 chars for `type(scope): `)
- Verdict: changing to 72 would BREAK alignment with the ecosystem; keep 100

### AI Attribution Validation
- Co-Authored-By remains de facto standard -- 4% of public GitHub commits now have AI co-authorship
- git-ai v3.0.0 (Jan 2026) uses git notes for line-level attribution; complementary, not replacement
- No new RFCs since mid-2025; AI-assistant trailer has zero adoption
- EU AI Act targets consumer content, not source code -- no legal mandate for VCS attribution
