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
---

> Phase 5 of 5 from the master plan
> Prerequisite: Phase 4 (new commands) must be complete
> Scope: `references/conventions.md` and `references/workflows.md` only -- no code changes

# Phase 5: Reference Updates

## Enhancement Summary

**Deepened on:** 2026-03-02
**Agents used:** 8 (architecture-strategist, code-simplicity-reviewer, agent-native-reviewer, spec-flow-analyzer, best-practices-researcher x3, safety-net-researcher)

### Key Improvements from Deepening

1. **Restructured dual-audience as a Body section enhancement** -- instead of a standalone section, embed the "what it affects" guidance within the existing Body section of conventions.md (architecture review)
2. **Added before/after examples to anti-slop** -- Claude needs concrete contrast pairs to reliably change behavior, not just rule lists (agent-native review, anti-slop research)
3. **Merged AI attribution into existing Footer section** -- Co-Authored-By is already a footer concern; adding a standalone section creates redundancy (architecture review, simplicity review)
4. **Moved narrative ordering to workflows.md** -- ordering is a workflow instruction, not a convention; belongs in the commit workflow's "SPLIT" step (agent-native review)
5. **Hardened safety-net section against rot** -- removed star counts and specific depth numbers that go stale (simplicity review, safety-net research)
6. **Added Step 0 preflight** -- verify Phase 4 is complete and reference files exist before editing (flow analysis)
7. **Added em dash grep verification** -- plan adds ~80 lines of content; must verify no em dashes slipped in (flow analysis)

### Sections Changed vs Original

| Section | Original Plan | Enhanced Plan |
|---------|--------------|---------------|
| Dual-audience | Standalone new section | Embedded in existing Body section |
| Anti-slop | DO/DON'T lists only | Added before/after example pairs |
| AI attribution | Standalone new section | Merged into existing Footer section |
| Narrative ordering | In conventions.md | Moved to workflows.md commit workflow |
| Safety-net | Star count + specific numbers | Version-pinned install, no volatile stats |
| Validation | `bun run validate` only | Preflight + em dash grep + validate |

---

## Goal

Apply research-backed content improvements to the skill reference docs. These are guidance additions -- they inform how the skill writes commit messages and what safety recommendations it makes. No code changes, no structural changes, no new features.

## Context from Brainstorms

Each addition traces to a specific brainstorm decision:

| Addition | Source | Nathan's Take |
|----------|--------|---------------|
| Dual-audience writing | Feature eval 1e | "I don't know about that" -- adopt as guidance only, not enforcement |
| Anti-slop guardrails | Feature eval 1g | Approved -- practical quality improvement |
| AI-assistant trailer | Feature eval 1f | Keep Co-Authored-By default, note trailer as optional |
| Narrative ordering | Feature eval 4a (SSW pattern) | Approved -- already implicit in "SPLIT" rule, make explicit |
| Safety-net companion | Advanced safety (Option B) | Approved -- recommend, don't build |

---

## Step 0: Preflight

Before editing reference files, verify prerequisites:

```bash
# Phase 4 must be complete -- reference files must exist
test -f plugins/git/skills/workflow/references/conventions.md || echo "MISSING: conventions.md"
test -f plugins/git/skills/workflow/references/workflows.md || echo "MISSING: workflows.md"
```

Both files must exist. If either is missing, Phase 4 is not complete -- stop and complete it first.

Also verify the current section structure of each file so edits target the right insertion points. The plan assumes:
- `conventions.md` ends with a "Breaking Changes" section
- `workflows.md` ends with a workflow section (Compare, Changelog, or similar)

If the structure has changed since this plan was written, adjust insertion points accordingly.

### Research Insight

> The spec-flow analysis identified that the original plan had no preflight step. Editing files that don't exist fails silently in markdown -- unlike code, there's no compiler to catch it. A 10-second check prevents wasted effort.

---

## Step 1: Embed dual-audience guidance in the Body section of conventions.md

Instead of appending a standalone "Dual-Audience Writing" section, **embed the guidance within the existing Body section** of `references/conventions.md`. This is where developers look when writing commit bodies -- a separate section at the bottom gets skipped.

Find the Body section and append this paragraph after the existing body guidance:

```markdown
When a commit touches multiple areas, name the affected modules or services in the body so future readers (human and AI) know which diffs matter without reading every changed file.
```

**Do NOT:**
- Add a standalone "Dual-Audience Writing" section header
- Add bullet lists or the three-element framework (what/why/what-it-affects)
- Add enforcement language or validation requirements

**Why this framing:** Nathan's reaction was skeptical ("I don't know about that"). The brainstorm resolved this as "guidance, not enforcement." A single sentence in the Body section is the minimum viable addition. It's discoverable where developers are already looking (writing the body), not buried in a separate section.

### Research Insight

> The dual-audience research confirmed the "what it affects" pattern is an emerging best practice (Cline blog, Versent blog, APCE research) but NOT a standard. No linting tool enforces it. The three-element framework (what + why + what-it-affects) is the community formulation, but our existing Conventional Commits format already handles the first two. Only the third -- naming affected modules -- is new. One sentence is the right weight for guidance-not-enforcement.

> Counter-argument worth noting: the "false precision" argument says naming modules in commit bodies creates maintenance burden when services are renamed. This is valid for long-lived codebases. The guidance deliberately says "name" rather than prescribing a format like `Affects: auth-service, session-store` -- keep it natural language, not a parseable field.

---

## Step 2: Add anti-slop guardrails to conventions.md

Append after the "Breaking Changes" section (currently the last section) in `references/conventions.md`:

```markdown
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

When writing commit messages, avoid:

- Debugging narration ("I tried...", "After investigating...")
- Implementation steps ("First I...", "Then I...")
- Filler phrases ("This commit...", "Updated the...", "Made changes to...")
- Over-verbose subjects (keep under 72 chars, prefer under 50)
- Missing scope on non-trivial changes

The diff shows *how*. The message explains *what* and *why*.
```

**Why:** The research identified specific anti-patterns in AI-generated commits. The brainstorm noted: "The SKILL.md commit section should explicitly say: 'Do not echo the debugging conversation into the commit message.'" This is the most impactful quality improvement for AI-generated commits.

### Research Insights

> **Before/after examples are critical for AI behavior change.** The agent-native review found that rule lists ("do not narrate") are less effective than concrete example pairs. Claude reads the bad example and recognizes the pattern to avoid; reads the good example and uses it as a template. The anti-slop research confirmed this with prompt engineering findings: "the most effective constraint is showing what the output should look like, not just what it shouldn't."

> **The canonical anti-patterns** (from anti-slop research, cross-referenced with Cline blog, BigGo debate, HN threads):
> 1. Passive-voice subjects ("Updated the auth module") -- use imperative ("update auth module")
> 2. Debugging diary in body ("I tried X, then Y") -- describe the outcome
> 3. Subjects exceeding 72 chars -- the 50/72 rule from Tim Pope (2008) is unchanged
> 4. "What" without "why" -- the diff already shows "what"; the body must explain "why"
> 5. Scope inflation -- batching unrelated changes into omnibus commits
> 6. Hedge language ("potentially fix the issue with...") -- state facts

> **50 vs 72 chars:** Research confirms 50 is the community ideal, 72 is the hard ceiling. The plan says "prefer under 50" to align with the canonical convention from cbea.ms/git-commit.

> **The subagent pattern** (from Cline community): isolating commit message generation from conversation context produces cleaner messages because the subagent only sees the diff, not the debugging history. This is an architectural solution to the "echoing" problem. Worth noting for future V2.1 consideration but out of scope for this documentation-only phase.

---

## Step 3: Merge AI attribution into the Footer section of conventions.md

Instead of adding a standalone "AI Attribution" section, **extend the existing Footer section** in `references/conventions.md`. Co-Authored-By is already a footer trailer -- this is where it belongs.

Find the Footer section and append:

```markdown
### AI Attribution

Always add `Co-Authored-By: Claude <noreply@anthropic.com>` when Claude generates or substantially modifies code. GitHub renders this as a co-author avatar in the commit list.

For teams tracking multi-model workflows, an additional `AI-assistant:` trailer provides model-level specificity:

```
AI-assistant: Claude Code (model: claude-sonnet-4-5)
```

The two trailers are not mutually exclusive. Use `Co-Authored-By` for GitHub visibility; add `AI-assistant:` if your team needs model-level tracking.
```

**Why:** The brainstorm evaluated Co-Authored-By (GitHub visibility) vs AI-assistant trailer (precision for multi-model teams). Decision: keep Co-Authored-By as default, note the alternative. The architecture review correctly identified that this belongs in the Footer section, not as a standalone section, since it's a footer trailer convention.

### Research Insights

> **Co-Authored-By is the de facto standard.** Every major AI tool uses it: Claude (`noreply@anthropic.com`), Copilot (`copilot@github.com`), Cursor (`cursor@cursor.sh`), Cline (`cline@cline.bot`). No verified GitHub account is needed for display.

> **AI-assistant trailer is proposed, not standardized.** Bence Ferdinandy's Dec 2025 proposal has not been submitted to the Git mailing list, has no RFC, and no major tool has adopted it. The layered approach (Co-Authored-By + AI-assistant) is what practitioners recommend, but most teams haven't implemented even that.

> **"Default" vs "Always Required":** The agent-native review suggested changing "Default" to "Always Required" for Co-Authored-By. The enhanced plan uses "Always add" -- this is stronger than "Default" while still being a convention, not enforcement.

> **Privacy consideration:** The AI attribution research found that model version in trailers is low-risk, but prompt text should NEVER be committed. The git-ai v3.0.0 spec's prompt field is identified as a privacy risk for proprietary codebases. Our guidance correctly avoids any prompt recording.

> **Platform rendering:** GitHub fully renders Co-Authored-By. GitLab parses but minimally displays it. Bitbucket support is unclear. No platform renders git notes or AI-assistant trailers. This confirms Co-Authored-By as the pragmatic choice.

---

## Step 4: Add narrative ordering to the commit workflow in workflows.md

Instead of adding to conventions.md, **embed narrative ordering guidance in the commit workflow's existing "SPLIT" instruction** in `references/workflows.md`. This is a workflow instruction (how to sequence commits), not a convention (how to format a single commit).

Find the commit workflow section and locate the SPLIT guidance. Append after it:

```markdown
When splitting, order commits to tell a story:

1. Data models / schema changes
2. Business logic
3. UI / presentation
4. Tests
5. Documentation

Each commit should build on the previous so reviewers can follow the progression.
```

**Why:** The SSW Narrative Commit Strategy from the research. The brainstorm noted this is already implicit in our "SPLIT large changes into atomic commits" safety rule. Making it explicit as a recommended ordering pattern costs nothing and improves commit story quality. The agent-native review correctly identified that ordering is a workflow concern, not a formatting convention.

### Research Insight

> The simplicity review flagged this as potential YAGNI -- the existing SPLIT rule already implies logical ordering. However, the SSW research showed that explicit ordering guidance produces measurably better commit sequences in practice. The compromise: add it as a brief list within the existing SPLIT instruction rather than a standalone section. This keeps it discoverable without inflating the document structure.

---

## Step 5: Add safety-net companion recommendation to workflows.md

Add a new section at the end of `references/workflows.md`:

```markdown
## Safety Companion: claude-code-safety-net

Our `git-safety.ts` hook catches git-specific destructive commands (force push, hard reset, clean -f, checkout ., branch -D, etc.) and blocks commits on protected branches. However, it uses regex on raw command strings, which means wrapped commands can bypass detection.

For deeper Bash analysis, consider installing [claude-code-safety-net](https://github.com/kenryu42/claude-code-safety-net) as a companion PreToolUse hook:

- **Shell wrapper unwrapping** -- catches `bash -c "git reset --hard"` and nested wrappers
- **Interpreter scanning** -- catches destructive commands inside `python -c`, `node -e`, etc.
- **Recursive command detection** -- catches `xargs bash -c ...`
- **CWD-aware path resolution** -- catches relative path tricks
- **Three modes** -- default (fail-open), strict (fail-closed), paranoid (block all rm -rf within cwd)

Both hooks run simultaneously as PreToolUse hooks -- they don't conflict. Our hook handles git-specific safety (branch policy, --no-verify, credential file protection, event bus reporting). Safety-net handles general Bash analysis.

Install: `npm install -g claude-code-safety-net`
```

**Why:** The advanced-safety brainstorm evaluated three options (build our own shell tokenization, recommend safety-net, hybrid). Decision was Option B: recommend safety-net as companion. This gives users the information to close the HIGH-risk shell wrapper bypass gap without us building and maintaining a tokenization engine.

### Research Insights

> **Rot-proofing:** The simplicity review and safety-net research both flagged that star counts ("1,099+ stars") and specific depth numbers ("5 levels deep") go stale. The enhanced version removes volatile stats and uses a GitHub link instead of a plain text reference. The install command provides immediate actionability.

> **Safety-net v0.7.1 details** (from safety-net research): TypeScript, MIT license, ~50-200ms cold start latency, parallel hooks coexist with no conflicts. The three modes map well to different risk tolerances -- default for most users, strict for production repos, paranoid for repos with sensitive data.

> **Placement:** The architecture review suggested README.md instead of workflows.md. However, the safety-net recommendation is operational guidance (how to harden your setup), not project documentation (what the plugin does). workflows.md is the right home -- it's loaded when users are working with the plugin's safety features.

---

## Step 6: Validate

```bash
# 1. Verify no em dashes slipped into the new content
grep -r '—' plugins/git/skills/workflow/references/ && echo "FAIL: em dash found" || echo "OK: no em dashes"

# 2. Run full validation
bun run validate
```

Both must pass. No tests needed -- these are documentation-only changes to `.md` files.

### Research Insight

> The flow analysis identified that ~80 lines of new content being added creates a real risk of em dashes slipping in, especially if content is copy-pasted from research sources. The explicit grep step catches this before validation.

---

## Success Criteria

- [ ] `references/conventions.md` Body section has dual-audience guidance (one sentence)
- [ ] `references/conventions.md` has Anti-Slop Guardrails section with before/after examples
- [ ] `references/conventions.md` Footer section has AI Attribution subsection
- [ ] `references/workflows.md` commit workflow has narrative ordering in SPLIT step
- [ ] `references/workflows.md` has Safety Companion section with install command
- [ ] No standalone "Dual-Audience Writing" section (embedded in Body instead)
- [ ] No standalone "AI Attribution" section (embedded in Footer instead)
- [ ] No code changes anywhere
- [ ] No em dashes in any added content (uses `--`)
- [ ] Each section traces to a specific brainstorm decision
- [ ] `bun run validate` passes

---

## Final V2 Checklist (All 5 Phases Complete)

After this phase, all V2 work is done. Final verification:

```bash
bun run validate && bun test plugins/git/
```

- [ ] `plugins/git/` exists with full structure
- [ ] marketplace.json version `0.2.0`, git plugin registered
- [ ] plugin.json version `2.0.0`, 12 commands, description polished
- [ ] 5 hook entry points have self-destruct timers
- [ ] Event bus discovery uses global path with V1 fallback
- [ ] References in `references/` subdirectory (lowercase)
- [ ] SKILL.md has WHAT+WHEN+WHEN-NOT description, updated routing table
- [ ] 5 new safety patterns + checkout checker + rm flag helper
- [ ] All safety patterns have `@incident`/`@rationale` JSDoc
- [ ] 2 new commands (commit-push-pr, clean-gone) with workflow docs
- [ ] conventions.md has dual-audience (in Body), anti-slop, AI attribution (in Footer)
- [ ] workflows.md has narrative ordering (in commit workflow) and safety-net companion
- [ ] All tests pass
- [ ] No em dashes anywhere
