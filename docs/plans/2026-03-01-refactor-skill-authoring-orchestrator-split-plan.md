---
title: "refactor: Unify skill-authoring with workflows + thin command entry point"
type: refactor
status: active
date: 2026-03-01
origin: docs/research/2026-03-01-skill-architecture-knowledge-workflow-patterns.md
---

# refactor: Unify skill-authoring with workflows + thin command entry point

## Enhancement Summary

**Deepened on:** 2026-03-01 (3 rounds, 15 agents total)
**Agents used:** architecture-strategist, pattern-recognition-specialist, code-simplicity-reviewer, agent-native-reviewer, naming-conventions (skill audit), skill-authoring (self-audit), compound-engineering comparison, best-practices-researcher, repo-research-analyst, menu-routing researcher, $ARGUMENTS flow researcher, template converter, common-patterns auditor, workflow files auditor, template drafter

### Key Improvements
1. **Dropped keyword dispatch table** -- compound-engineering proves plain numbered menus work. Claude's LLM reasoning handles intent matching without explicit keyword lookup. (4 agents agreed)
2. **Added `disable-model-invocation: true` to command** -- create-skill writes files, which is a side effect. Self-audit flagged this as the only hard FAIL. (2 agents agreed)
3. **Deleted off-menu workflows** -- verify-skill.md (generic auditor, wrong scope) and upgrade-to-router.md (teaches eliminated XML pattern) provide zero value. (2 agents agreed)
4. **Kept add-* workflows separate** -- consolidating 4 small files into a "secondary router" adds abstraction without saving lines. Fix their XML and leave them as-is. (simplicity reviewer)
5. **Fixed command description** -- added WHEN clause, third person, trigger keywords per WHAT+WHEN pattern. (2 agents agreed)
6. **Scoped common-patterns.md fix** -- needs thorough pass, not just lines 222-252. XML examples throughout. (architecture strategist)
7. **Added $ARGUMENTS pass-through to workflows** -- audit-skill should accept a skill name to skip discovery step. (agent-native reviewer)

### New Considerations Discovered
- `$ARGUMENTS` should be placed at bottom of SKILL.md for routing context (research contradicted original plan)
- Command-skill name mismatch (`create-skill` -> `skill-authoring`) documented as intentional exception to Rule 2
- `Bash(mkdir *)` needed in allowed-tools, not just `Bash(ls *)`
- Workflow validation rules (create-new-skill Step 8, audit-skill line 57) explicitly say "XML good, markdown bad" -- must be flipped
- Templates are the critical path -- they determine output format of every created skill

## Overview

Consolidate the `skill-authoring` skill into a unified knowledge + workflow skill following compound-engineering's proven pattern and Anthropic's progressive disclosure architecture. Convert existing XML-tagged workflow and template files to markdown. Add a thin `/create-skill` command for manual invocation.

## Problem Statement / Motivation

The current `skill-authoring` skill has workflow files from compound-engineering that use XML tags, AskUserQuestion, and reference non-existent files. The SKILL.md itself is well-structured but its workflows contradict its own conventions. Additionally, there's no `/create-skill` command for manual invocation.

**What's broken:**
- 10 workflow files use XML tags (`<required_reading>`, `<process>`, `<success_criteria>`) while SKILL.md teaches markdown headings
- 2 template files use `{{double-curly}}` placeholders and XML structure
- `create-domain-expertise-skill.md` (605 lines) references non-existent `create-plans` skill
- `references/use-xml-tags.md` referenced by 3 workflows but doesn't exist on disk
- `add-workflow.md` contradicts itself on AskUserQuestion (line 12 says don't, line 37 uses it)
- `references/common-patterns.md` recommends XML over markdown (lines 222-252) -- opposite of our conventions
- No `/create-skill` command exists for manual invocation

**What's NOT broken:**
- The skill-authoring SKILL.md knowledge content (frontmatter spec, naming, audit checklist) is solid
- The workflow structure from compound-engineering is production-proven
- Progressive disclosure via `references/` works well

## Proposed Solution

### Architecture

```
skill-authoring/                    # Unified skill (user-invocable: false)
├── SKILL.md                       # Brain + numbered menu (knowledge + workflow dispatch)
├── references/
│   ├── official-spec.md           # (existing) Official skill specification
│   ├── best-practices.md          # (existing, already updated) Authoring best practices
│   ├── common-patterns.md         # (existing, needs thorough XML->markdown fix)
│   ├── core-principles.md         # (existing) Core design principles
│   ├── skill-structure.md         # (existing) SKILL.md body format
│   ├── recommended-structure.md   # (existing) Directory layout (uses XML -- needs fix)
│   └── ... (other existing refs)
├── workflows/
│   ├── create-new-skill.md        # (existing, needs XML->markdown conversion)
│   ├── audit-skill.md             # (existing, needs XML->markdown conversion)
│   ├── add-reference.md           # (existing, needs XML->markdown conversion)
│   ├── add-script.md              # (existing, needs XML->markdown conversion)
│   ├── add-template.md            # (existing, needs XML->markdown conversion)
│   ├── add-workflow.md            # (existing, needs XML->markdown conversion)
│   └── get-guidance.md            # (existing, needs XML->markdown conversion)
└── templates/
    ├── simple-skill.md            # (existing, needs XML->markdown + placeholder conversion)
    └── router-skill.md            # (existing, needs XML->markdown + placeholder conversion)

commands/
└── create-skill.md                # Thin pass-through command (NEW)
```

### Design Principles

1. **One skill, two entry points.** `user-invocable: false` for auto-loading knowledge. `/create-skill` command (`disable-model-invocation: true`) for manual workflow entry. Follows compound-engineering's `create-agent-skills` pattern.

2. **Workflows are one level deep.** `SKILL.md -> workflows/create-new-skill.md` is level 2. Workflows reference sibling directories (`references/`, `templates/`) within the same skill. No cross-skill hops.

3. **Markdown headings, not XML tags.** Matches Anthropic's official convention and our plugin's existing skills (research, brainstorm, visualize).

4. **No AskUserQuestion in workflows.** Plain text numbered lists for compatibility with Codex, headless agents, and agent-to-agent contexts.

5. **LLM reasoning for dispatch, not keyword tables.** Numbered menu with descriptive labels. Claude matches intent to workflow -- no explicit keyword lookup needed. This is how compound-engineering does it in production.

6. **`[square brackets]` for template placeholders.** Matches Anthropic's official template and community standard. No `{{double-curly}}`.

7. **Workflows check conversation context for pre-specified targets.** `$ARGUMENTS` is substitution-time only -- it does NOT flow from command through SKILL.md to workflow files. Instead, workflows should check if a target (e.g., skill name) was already provided in the conversation and skip discovery if so.

## Technical Considerations

### What changes in skill-authoring SKILL.md

- **Update frontmatter**: Add `user-invocable: false`
- **Update menu section**: Replace current "What Would You Like To Do?" menu (lines 211-218) with numbered menu linking to workflows
- **Keep**: All knowledge content (frontmatter reference, invocation control, dynamic features, progressive disclosure, naming & descriptions, argument hints, audit checklist, anti-patterns)
- **Remove**: "Creating a New Skill or Command" step-by-step workflow (Steps 1-5, lines 219-293) -- this is replaced by `workflows/create-new-skill.md`

### SKILL.md Menu Section

Replace the existing menu and creation workflow with:

```markdown
## What Would You Like To Do?

1. **[Create new skill](workflows/create-new-skill.md)** -- Build a skill or command from scratch
2. **[Audit existing skill](workflows/audit-skill.md)** -- Check against best practices with scored report
3. **Add component** -- Add to an existing skill:
   - a. **[Reference](workflows/add-reference.md)** -- Conditional context file
   - b. **[Workflow](workflows/add-workflow.md)** -- Step-by-step procedure
   - c. **[Template](workflows/add-template.md)** -- Reusable boilerplate
   - d. **[Script](workflows/add-script.md)** -- Executable hook or helper
4. **[Get guidance](workflows/get-guidance.md)** -- Understand whether/how to build something

If arguments match one of these, read the corresponding workflow and begin.
Otherwise, reply with a number or describe what you need.

$ARGUMENTS
```

**Design notes:**
- Explicit markdown links because SKILL.md is a thin router (no inline workflow content to fall back on)
- Lettered sub-items (a-d) for "Add component" avoid a separate router file while keeping each component's workflow focused
- `$ARGUMENTS` at bottom so Claude has routing context before seeing user input
- No keyword dispatch table -- Claude's LLM reasoning handles intent matching from the descriptive labels
- `$ARGUMENTS` is substitution-time only -- it does NOT flow from command to SKILL.md to workflows. Arguments propagate via **conversation context**

### Command Pass-Through

Following the plugin's established pattern (research.md, brainstorm.md, visualize.md):

```markdown
<!-- commands/create-skill.md -->
---
name: create-skill
description: Creates, audits, or improves Claude Code skills and commands. Use when scaffolding a new skill, reviewing an existing skill against best practices, or adding components like references, workflows, or templates.
argument-hint: [action]
disable-model-invocation: true
allowed-tools: Read, Write, Edit, Glob, Bash(mkdir *), Bash(ls *)
---

Use the **skill-authoring** skill to guide skill creation, auditing, or improvement.
Valid modes: create, audit, add, guidance. Pass a mode followed by details.
$ARGUMENTS
```

**Naming exception (Rule 2):** The command is named `create-skill` (verb-noun, optimized for human typing) while the skill is `skill-authoring` (noun-compound, background knowledge). This violates the "match command to skill name" convention, but is intentional -- the skill serves dual purposes (auto-loaded knowledge AND manual workflow entry), so the command name reflects the action while the skill name reflects the domain.

### Workflow Conversions

Each workflow needs these changes:
1. Replace XML tags with markdown headings
2. Remove AskUserQuestion -- use plain text numbered lists
3. Replace `<required_reading>` with markdown "Context" section using relative file links
4. Remove references to non-existent `use-xml-tags.md`
5. Update any `{{placeholder}}` syntax to `[placeholder]`
6. Flip any validation rules that say "XML good, markdown bad"
7. Add "Step 0: Check for pre-specified target" to audit-skill
8. Convert instructional XML examples inside workflows to markdown equivalents

**Context pattern for workflows** (within the same skill, one level deep):

```markdown
## Context

Read before proceeding:
- [Core principles](references/core-principles.md) -- design philosophy
- [Best practices](references/best-practices.md) -- quality criteria
```

Note: Relative links within the same skill directory. Imperative phrasing. No blocking gate instruction -- Claude reads files when told to read them.

**Universal XML tag -> markdown heading map:**

| XML Tag | Markdown Heading | Used In |
|---------|-----------------|---------|
| `<required_reading>` | `## Context` | All 7 kept workflows |
| `<process>` | `## Process` | All 7 kept workflows |
| `<success_criteria>` | `## Success Criteria` | All 7 kept workflows |
| `<audit_anti_patterns>` | `## Audit Anti-Patterns` | audit-skill.md |
| `<decision_framework>` | `## Decision Framework` | get-guidance.md |

All closing tags (`</tag>`) must also be removed.

### Per-File Conversion Details

**`create-new-skill.md`** (191 lines):
- Remove `use-xml-tags.md` reference (L8)
- Remove AskUserQuestion heading + guidance (L21-23) and usage (L46) -- replace with numbered lists
- Flip Step 8 validation rules:
  - L148: "No markdown headings (#) in body - use XML tags" -> "Uses markdown headings for structure (not XML tags)"
  - L149: "Required tags present: objective, quick_start, success_criteria" -> "Required sections present: Quick Start, Success Criteria"
  - L152: "XML tags properly closed" -> remove entirely
- Convert instructional XML templates (L106-133) to markdown equivalents
- 3 XML structural tags to convert

**`audit-skill.md`** (138 lines):
- Remove `use-xml-tags.md` reference (L7)
- Add Step 0: check conversation context for pre-specified skill name
- Flip validation checklist:
  - L57: "Pure XML structure (no markdown headings # in body)" -> "Markdown headings for structure (no XML structural tags)"
  - L58: "All XML tags properly closed" -> remove entirely
  - L59: "Has required tags: objective OR essential_principles" -> "Has required sections: Quick Start, Success Criteria"
  - L125: Remove "Markdown headings in body" from anti-patterns list (it's now correct behavior)
- 4 XML structural tags to convert

**`add-reference.md`** (96 lines):
- No AskUserQuestion, no `use-xml-tags.md` references
- L45-64: Instructional XML template for reference files -- convert to markdown example
- L69: "Add to `<reference_index>`" -> "Add to the Reference Files section"
- L79: "Add to `<required_reading>`" -> "Add to the Context section"
- 3 XML structural tags to convert

**`add-script.md`** (93 lines):
- No AskUserQuestion, no `use-xml-tags.md` references
- L67-73: Instructional XML `<process>` template -- convert to markdown
- 3 XML structural tags to convert

**`add-template.md`** (74 lines):
- No AskUserQuestion, no `use-xml-tags.md` references
- L40: `{{PLACEHOLDER}}` -- this documents the placeholder convention, change to `[placeholder]`
- L48-55: Instructional XML `<process>` template -- convert to markdown
- 3 XML structural tags to convert

**`add-workflow.md`** (120 lines):
- Fix contradiction: L36 uses AskUserQuestion (violates L12 and project convention) -- replace with numbered list
- L60-83: Full XML workflow template example -- convert to markdown equivalent
- 3 XML structural tags to convert

**`get-guidance.md`** (121 lines):
- No AskUserQuestion, no `use-xml-tags.md` references
- L80: "become `<essential_principles>` in SKILL.md" -> "become the Core Principles section in SKILL.md"
- Include upgrade-to-router guidance as a recommendation (since that workflow is being deleted)
- 4 XML structural tags to convert (`<decision_framework>` is unique to this file)

### Files to Delete

| File | Lines | Reason |
|------|-------|--------|
| `create-domain-expertise-skill.md` | 605 | References non-existent `create-plans` skill, out of scope |
| `verify-skill.md` | 205 | Generic content auditor, wrong scope for skill-authoring |
| `upgrade-to-router.md` | 161 | Teaches the XML pattern being eliminated |
| **Total deleted** | **971** | |

### Template Conversions

Both templates converted from XML + `{{curly}}` to markdown + `[brackets]` with HTML comment guidance.

**Conversion mapping:**

| Before | After |
|--------|-------|
| `{{SKILL_NAME}}` | `[skill-name]` |
| `<objective>` | Inline paragraph under `# [Skill Name]` |
| `<quick_start>` | `## Quick Start` |
| `<process>` | `## Process` (inner steps demoted from `##` to `###`) |
| `<success_criteria>` | `## Done When` (simple) / `## Quality Criteria` (router) |
| `<essential_principles>` | `## Core Principles` |
| `<intake>` | `## Intake` (numbered menu, no "Ask the user:" preamble) |
| `<routing>` | `## Routing` (table with markdown links, not backtick paths) |
| `<quick_reference>` | `## Quick Reference` |
| `<reference_index>` | `## Domain Knowledge` (items as markdown links) |
| `<workflows_index>` | `## Workflows` |

**Target sizes:** Simple skill ~30 lines, Router skill ~51 lines. Both include `<!-- WHAT: / WHY: / EXAMPLE: -->` comment block at top (invisible at runtime, guides skill authors). Templates are the critical path -- they determine the output format of every skill created by this system.

<details>
<summary>Complete simple-skill.md template (ready to write)</summary>

```markdown
<!--
  WHAT: [one-sentence purpose]
  WHY:  [when Claude should load this skill]
  EXAMPLE: /[skill-name] [typical usage]
-->
---
name: [skill-name]
description: [What it does] Use when [trigger conditions].
---

# [Skill Name]

[Clear statement of what this skill accomplishes]

## Quick Start

[Immediate actionable guidance - what Claude should do first]

## Process

### Step 1: [First action]

[Instructions for step 1]

### Step 2: [Second action]

[Instructions for step 2]

### Step 3: [Third action]

[Instructions for step 3]

## Done When

- [ ] [First success criterion]
- [ ] [Second success criterion]
- [ ] [Third success criterion]
```

</details>

<details>
<summary>Complete router-skill.md template (ready to write)</summary>

```markdown
<!--
  WHAT: [one-sentence purpose]
  WHY:  [when Claude should load this skill]
  EXAMPLE: /[skill-name] [typical usage]
-->
---
name: [skill-name]
description: [What it does] Use when [trigger conditions].
---

# [Skill Name]

## Core Principles

### [Core Concept]

[Principles that ALWAYS apply, regardless of which workflow runs]

1. **[First principle]** - [Explanation]
2. **[Second principle]** - [Explanation]
3. **[Third principle]** - [Explanation]

## Intake

What would you like to do?

1. [First option]
2. [Second option]
3. [Third option]

**Wait for response before proceeding.**

## Routing

| Response | Workflow |
|----------|----------|
| 1, "[keywords]" | [workflows/[first-workflow].md](workflows/[first-workflow].md) |
| 2, "[keywords]" | [workflows/[second-workflow].md](workflows/[second-workflow].md) |
| 3, "[keywords]" | [workflows/[third-workflow].md](workflows/[third-workflow].md) |

**After reading the workflow, follow it exactly.**

## Quick Reference

[Brief reference information always useful to have visible]

## Domain Knowledge

All in `references/`:
- [reference-1.md](references/reference-1.md) - [purpose]
- [reference-2.md](references/reference-2.md) - [purpose]

## Workflows

All in `workflows/`:

| Workflow | Purpose |
|----------|---------|
| [first-workflow].md | [purpose] |
| [second-workflow].md | [purpose] |
| [third-workflow].md | [purpose] |

## Quality Criteria

A well-executed [skill name]:
- [First criterion]
- [Second criterion]
- [Third criterion]
```

</details>

### Reference File Fixes

**`common-patterns.md`** (598 lines) -- Full edit manifest from deep audit:

| # | Section | Lines | Category | Key Change |
|---|---------|-------|----------|------------|
| 1 | overview | 1-3 | FLIP+CONVERT | Remove `<overview>` tags, flip "All patterns use pure XML structure" to "All patterns use markdown structure" |
| 2 | template_pattern | 5-36 | CONVERT | `<template_pattern>` -> `## Template pattern`, `<strict_requirements>` -> `### Strict requirements` |
| 3 | flexible_guidance | 38-64 | CONVERT | `<flexible_guidance>` -> `### Flexible guidance` |
| 4 | examples_pattern | 66-113 | CONVERT | `<examples_pattern>` -> `## Examples pattern`, `<when_to_use>` -> `### When to use` |
| 5 | consistent_terminology | 115-163 | CONVERT | Tags to headings; L159 fix "`<objective>` or `<context>`" -> "the objective or context section" |
| 6 | provide_default | 165-215 | CONVERT | Tags to headings |
| 7 | anti_patterns wrapper | 217-220, 469 | CONVERT | `<anti_patterns>` -> `## Anti-patterns` |
| 8 | **markdown_headings_in_body** | **222-252** | **FLIP** | Swap BAD/GOOD: markdown headings = GOOD, XML structure = BAD. Rewrite rationale. |
| 9 | vague_descriptions | 254-266 | KEEP | Strip `<pitfall>` tag only |
| 10 | inconsistent_pov | 268-280 | KEEP | Strip `<pitfall>` tag only |
| 11 | wrong_naming_convention | 282-294 | KEEP | Strip `<pitfall>` tag only |
| 12 | too_many_options | 296-318 | CONVERT | Strip `<pitfall>` tag (inner XML examples acceptable) |
| 13 | deeply_nested_references | 320-334 | KEEP | Strip `<pitfall>` tag only |
| 14 | windows_paths | 336-352 | CONVERT | Strip tag + convert inner XML examples to markdown |
| 15 | dynamic_context_execution | 354-381 | CONVERT | Strip tag + convert inner `<examples>` to markdown |
| 16 | **missing_required_tags** | **383-409** | **FLIP** | Flip from "required XML tags" to "required markdown sections". Rewrite examples. |
| 17 | **hybrid_xml_markdown** | **411-443** | **FLIP** | Flip from "prefer XML" to "prefer markdown headings, reserve XML for inner semantics" |
| 18 | unclosed_xml_tags | 445-468 | **DELETE** | Remove entirely (irrelevant in markdown world) |
| 19 | progressive_disclosure | 471-502 | CONVERT | Tags to headings |
| 20 | validation_pattern | 504-533 | CONVERT | Tags to headings |
| 21 | checklist_pattern | 535-597 | CONVERT | Tags to headings |

**Totals: 3 FLIP, 14 CONVERT, 4 KEEP (tag-strip only), 1 DELETE.**

**`recommended-structure.md`**: Uses `<structure>` XML tags. Convert to markdown code blocks.

**Delete references to `use-xml-tags.md`**: Found in `create-new-skill.md` (L8), `audit-skill.md` (L7), `create-domain-expertise-skill.md` (L29 -- file being deleted anyway).

### Plugin Manifest Update

`plugins/cortex-engineering/.claude-plugin/plugin.json`:
- Add `"./commands/create-skill.md"` to commands array
- No new skill entry needed -- `skill-authoring` already registered

## Acceptance Criteria

- [ ] `skill-authoring` has `user-invocable: false` in frontmatter
- [ ] `skill-authoring/SKILL.md` has numbered menu with explicit markdown links to workflow files (no keyword dispatch table)
- [ ] SKILL.md stays under 500 lines
- [ ] All workflow files use markdown headings, not XML tags
- [ ] All workflow files use plain text numbered lists, not AskUserQuestion
- [ ] Workflows have Context sections using relative links within the skill
- [ ] `audit-skill.md` accepts skill name/path via `$ARGUMENTS` to skip interactive discovery
- [ ] Validation rules in workflows flipped from "XML good" to "markdown good" (create-new-skill Step 8, audit-skill line 57)
- [ ] `templates/simple-skill.md` and `templates/router-skill.md` converted to markdown + `[brackets]`
- [ ] `references/common-patterns.md` thoroughly updated -- all XML-as-good examples converted
- [ ] `references/recommended-structure.md` converted from XML to markdown
- [ ] `create-domain-expertise-skill.md`, `verify-skill.md`, `upgrade-to-router.md` deleted
- [ ] References to `use-xml-tags.md` removed from all workflows
- [ ] `commands/create-skill.md` exists with `disable-model-invocation: true` and description following WHAT+WHEN pattern
- [ ] Plugin manifest updated with `"./commands/create-skill.md"` in commands array
- [ ] `bun run validate` passes

## Success Metrics

- `/create-skill` presents a numbered menu and routes to the correct workflow via LLM reasoning
- `/create-skill audit naming-conventions` skips the menu and audits the named skill directly
- Claude auto-loads skill-authoring knowledge when asked about naming conventions or frontmatter (via `user-invocable: false`)
- Each workflow loads its references via one-level-deep relative links (no cross-skill hops)
- Updating a best practice in `references/best-practices.md` automatically affects all workflow outputs
- Skills created via templates have consistent markdown structure (no XML)
- An agent can invoke `/create-skill` with arguments and get the same behavior as a human

## Dependencies & Risks

**Dependencies:**
- naming-conventions skill must exist (already created)
- skill-authoring references already updated with naming-conventions cross-references (already done)
- Existing workflow files on disk need conversion (already exist from previous commit)

**Risks:**
- **SKILL.md line count**: Adding the menu section while keeping all knowledge content may approach the 500-line limit. Mitigated by moving the Step 1-5 creation workflow into `workflows/create-new-skill.md` (net reduction of ~60 lines).
- **common-patterns.md scope**: This 598-line file needs a thorough pass, not just lines 222-252. XML-as-good examples appear throughout. Budget time for this.
- **`add-workflow.md` contradiction**: Line 12 says "DO NOT use AskUserQuestion" but line 37 uses it. Fixed during XML->markdown conversion.
- **Templates are the critical path**: `simple-skill.md` and `router-skill.md` determine the output format of every created skill. Getting these right propagates correctness everywhere.

## Why Not Two Separate Skills (Original Plan)

The original plan split skill-authoring into a knowledge skill + a `create-skill` orchestrator. Research revealed this is unsupported:

1. **No cross-skill dependency mechanism.** Anthropic docs have zero documentation for one skill depending on another's content. The `skills:` frontmatter field only works for subagents (`context: fork`).
2. **Reference depth violation.** Cross-skill workflows sit at reference level 3 (SKILL.md -> workflow -> sibling skill reference). Anthropic explicitly warns "Claude may partially read files referenced from other referenced files."
3. **Auto-loading is probabilistic.** `user-invocable: false` means description is always in context, but full SKILL.md body loads only when Claude judges it relevant -- "pure LLM reasoning" with no guaranteed trigger.
4. **Community consensus.** Reddit, X, and web sources show no production examples of cross-skill dependency. compound-engineering keeps knowledge + workflows in one skill for this reason.
5. **@ syntax doesn't work in skills.** `@path/to/file` is only available in CLAUDE.md and interactive prompts, not in SKILL.md or workflow markdown.

## Sources & References

### Internal References

- Current skill-authoring SKILL.md: `plugins/cortex-engineering/skills/skill-authoring/SKILL.md`
- Naming conventions skill: `plugins/cortex-engineering/skills/naming-conventions/SKILL.md`
- Compound-engineering reference: `/Users/nathanvale/.claude/plugins/marketplaces/every-marketplace/plugins/compound-engineering/skills/create-agent-skills/`
- Naming conventions research: `docs/research/2026-03-01-naming-conventions-claude-code-plugins.md`

### External References

- [Skill authoring best practices - Anthropic](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices)
- [Agent Skills Overview - Anthropic](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview)
- [Extend Claude with Skills - Claude Code Docs](https://code.claude.com/docs/en/skills)
- [Equipping Agents for the Real World - Anthropic Engineering Blog](https://claude.com/blog/equipping-agents-for-the-real-world-with-agent-skills)
- [Don't Build Agents, Build Skills Instead - Anthropic @ AI Engineer](https://www.youtube.com/watch?v=CEvIs9y1uog) (754K views)
- [Claude Skills: A First Principles Deep Dive - Lee Han Chung](https://leehanchung.github.io/blogs/2025/10/26/claude-skills-deep-dive/)
- [Inside Claude Code Skills - Mikhail Shilkov](https://mikhail.io/2025/10/claude-code-skills/)
- [How to Make Claude Code Skills Activate Reliably - Scott Spence](https://scottspence.com/posts/how-to-make-claude-code-skills-activate-reliably)
- [Claude Skill vs Command: 2026 Best Practices - OneAway](https://oneaway.io/blog/claude-skill-vs-command)
- [Claude Skills Structure and Usage Guide - mellanon](https://gist.github.com/mellanon/50816550ecb5f3b239aa77eef7b8ed8d)
- [Claude's Modular Mind - ikangai](https://www.ikangai.com/claudes-modular-mind-how-anthropics-agent-skills-redefine-context-in-ai-systems/)
- [Anthropic's official skills repo](https://github.com/anthropics/skills)
- [planning-with-files template](https://github.com/OthmanAdi/planning-with-files) (14.8k stars)
- [SFEIR Institute - Custom Commands Examples](https://institute.sfeir.com/en/claude-code/claude-code-custom-commands-and-skills/examples/)
- [GitHub Issue #19141: Clarify user-invocable vs disable-model-invocation](https://github.com/anthropics/claude-code/issues/19141)

### New Sources (Deepening Round)
- [Command -> Agent -> Skills Pattern - DeepWiki](https://deepwiki.com/shanraisshan/claude-code-best-practice/6.1-command-agent-skills-pattern)
- [jezweb/claude-skills Architecture](https://github.com/jezweb/claude-skills)
- [shanraisshan/claude-code-best-practice](https://github.com/shanraisshan/claude-code-best-practice)
- compound-engineering `create-agent-skills` skill (direct comparison of production patterns)

### Community Sources

- [Reddit: I split my CLAUDE.md into 27 files](https://www.reddit.com/r/ClaudeCode/comments/1rhe89z/) (90 pts, 39 comments)
- [Reddit: How I structure Claude Code projects](https://www.reddit.com/r/ClaudeAI/comments/1r66oo0/) (195 pts, 28 comments)
- [Reddit: Claude Code is brilliant at churning out code but terrible at architecture](https://www.reddit.com/r/ClaudeAI/comments/1qgouxz/) (51 pts, 64 comments)
- [GitHub Discussion #182117: Skill activation is extremely unstable](https://github.com/orgs/community/discussions/182117)
