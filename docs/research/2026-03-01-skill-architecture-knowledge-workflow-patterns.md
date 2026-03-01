---
created: 2026-03-01
title: "Skill Architecture: Knowledge + Workflow Patterns in Claude Code"
type: research
updated: 2026-03-01
tags: [claude-code, skills, architecture, workflows, knowledge, progressive-disclosure, cross-skill, templates, router, dispatch, XML, markdown, auto-loading, invocation-control]
project: cortex-engineering
status: complete
---

## Summary

Comprehensive research into how Claude Code skills should organize knowledge (reference content, best practices, conventions) alongside workflows (step-by-step procedures, guided creation). Investigated whether to split them into separate skills or keep them unified. The core finding: **keep knowledge and workflows in one skill, use progressive disclosure via subdirectories, and add a thin command for manual invocation.** Cross-skill dependencies are unsupported, auto-loading is probabilistic, and every production example (including compound-engineering and Anthropic's own skills) keeps them together.

## Key Findings

### 1. The Split vs Unified Debate

**The community is NOT cleanly in favour of separation.** There's genuine tension:

**For unified (one skill):**
- No cross-skill dependency mechanism exists in Claude Code
- Anthropic docs warn "Claude may partially read files referenced from other referenced files" -- cross-skill workflows violate the one-level-deep recommendation
- compound-engineering keeps knowledge + workflows in one skill (`create-agent-skills`) and it works in production
- Reddit (90 pts, 39 comments): "stick with as lean as you can" -- splitting adds complexity
- Token economics: each auto-invocable skill costs 50-200 tokens/turn for relevance evaluation
- A single self-contained skill is portable across agent frameworks

**For separation:**
- Invocation conflict: knowledge needs `user-invocable: false`, orchestrator needs `disable-model-invocation: true`
- oneaway.io: splitting "sales-automation" into 5 focused skills improved activation
- Context budget: loading orchestration when only naming conventions are needed wastes tokens

**Resolution:** The invocation conflict is real but solvable with a thin command. Use `user-invocable: false` on the skill for auto-loading. Add a `/create-skill` command (separate file) for manual invocation. One skill, two entry points.

### 2. Knowledge Skill Auto-Loading Mechanics

Claude Code's skill loading is a three-level system:

| Level | What loads | When | Tokens |
|-------|-----------|------|--------|
| L1: Metadata | name + description | Always in context | ~50 |
| L2: SKILL.md body | Full markdown content | When Claude judges description matches task | ~3,000 |
| L3: References | Supporting files | When Claude uses Read tool | Varies |

For `user-invocable: false`:
- Description is ALWAYS in context (L1)
- Full body loads when Claude decides it's relevant (L2) -- "pure LLM reasoning", not deterministic
- Scott Spence's research: skill activation is only 50-84% reliable depending on hooks/phrasing

**Critical: `user-invocable: false` does NOT prevent auto-invocation.** GitHub Issue #19141 clarified this confusion. It just hides the skill from the `/` menu. Claude can still invoke it.

### 3. Cross-Skill References Are Unsupported

After exhaustive research:
- Zero Anthropic documentation for one skill depending on another's content
- Zero production examples of cross-skill dependency in community repos
- The only documented skill composition mechanism is the subagent `skills:` frontmatter field (requires `context: fork`, loses conversation history)
- `@path/to/file` syntax only works in CLAUDE.md and interactive prompts -- NOT in SKILL.md or workflow markdown
- Relative markdown links in SKILL.md are "suggestions to Claude" -- Claude must actively decide to Read them

### 4. Router Dispatch Patterns ($ARGUMENTS)

No production skill uses algorithmic dispatch. The mechanism is pure LLM reasoning over markdown instructions.

**Best pattern: Markdown table with keyword synonym groups.**

```markdown
| Keywords | Workflow |
|----------|----------|
| create, new, build, scaffold | Read [create-new.md](workflows/create-new.md) and follow its instructions |
| audit, check, review, validate | Read [audit.md](workflows/audit.md) and follow its instructions |
```

Key design decisions:
- Table, not if/else -- more token-efficient, Claude handles fuzzy matching natively
- "Read [file] and follow its instructions" inline in table -- strongest file-following pattern
- `$ARGUMENTS` placed at bottom of SKILL.md so Claude has access after routing
- Always use `$ARGUMENTS` (full string), never `$0`/`$1` -- positional args split on spaces, quotes not respected
- Unrecognized arguments fall through to numbered menu

### 5. Required Context Pattern for Workflows

When workflows need to load reference files within the same skill:

```markdown
## Required Context

Read these files before proceeding:

1. [Core principles](references/core-principles.md) -- design philosophy
2. [Best practices](references/best-practices.md) -- quality criteria

Do not begin Step 1 until all files are loaded.
```

Key findings:
- 1-3 files reliably read, 4-6 mostly read, 7+ risk being skimmed
- Imperative phrasing ("Read these files before proceeding") outperforms passive ("see also")
- Within-skill relative links (level 2) are reliable. Cross-skill links (level 3) are risky.
- Adding "STOP. Use the Read tool" is the strongest phrasing but may be unnecessarily heavy for within-skill references

### 6. Template Best Practices

**Placeholder syntax: `[square brackets]`, not `{{double-curly}}`.**
- Anthropic's official template, planning-with-files (14.8k stars), and all production skills use `[brackets]`
- `{{curly}}` triggers template-engine associations (Mustache/Handlebars/Jinja2) in Claude's training data
- Claude may try to "render" double-curly templates rather than fill them

**HTML comments for guidance:**
- Use `<!-- WHAT: / WHY: / EXAMPLE: -->` pattern (from planning-with-files)
- Invisible at runtime, guides human skill creators
- Optional sections should be commented out, not included with placeholder text

**Template length:**
- Simple skill: ~25 lines of content
- Router skill: ~45 lines of content
- Anthropic's official template is literally 5 lines -- minimal scaffold is better than comprehensive

### 7. XML vs Markdown in Skills

**Anthropic's official convention: markdown headings for skill structure.**
- Every production skill in Anthropic's skills repo uses markdown headings
- XML is reserved for data injection (`<example>`, `<documents>`) and example wrapping
- ~15% token overhead for XML tags vs markdown headings
- compound-engineering uses XML throughout their workflows -- this contradicts official convention

### 8. Existing File Inventory (skill-authoring)

10 workflow files (1,803 lines total), all use XML tags:
- 9 distinct XML tag types: `<required_reading>`, `<process>`, `<success_criteria>`, `<objective>`, `<critical_distinction>`, `<audit_anti_patterns>`, `<purpose>`, `<decision_framework>`, `<verification_shortcuts>`
- 2 files use AskUserQuestion (contradicting our conventions)
- 3 files reference non-existent `use-xml-tags.md`
- `create-domain-expertise-skill.md` (605 lines) references non-existent `create-plans` skill

2 template files (106 lines total), both use XML + `{{double-curly}}`:
- `simple-skill.md` (33 lines): `<objective>`, `<quick_start>`, `<process>`, `<success_criteria>`
- `router-skill.md` (73 lines): `<essential_principles>`, `<intake>`, `<routing>`, `<quick_reference>`, `<reference_index>`, `<workflows_index>`, `<success_criteria>`

`common-patterns.md` (598 lines) actively recommends XML over markdown at lines 222-252 -- needs flipping.

## Architecture Decision

**Chosen: Unified skill with thin command entry point.**

```
skill-authoring/                    # user-invocable: false
├── SKILL.md                       # Brain + $ARGUMENTS router
├── references/                    # Knowledge (on-demand)
├── workflows/                     # Procedures (on-demand)
└── templates/                     # Output structures (on-demand)

commands/
└── create-skill.md                # Thin pass-through
```

**Why not two skills:**
1. No cross-skill dependency mechanism
2. Reference depth violation (level 3)
3. Auto-loading is probabilistic (50-84% reliable)
4. Zero production examples of the pattern
5. `@` syntax doesn't work in SKILL.md

## Sources

### Official Documentation
- [Skill authoring best practices - Anthropic](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices)
- [Agent Skills Overview - Anthropic](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview)
- [Extend Claude with Skills - Claude Code Docs](https://code.claude.com/docs/en/skills)
- [Create custom subagents - Claude Code Docs](https://code.claude.com/docs/en/sub-agents)
- [Equipping Agents for the Real World - Anthropic Engineering Blog](https://claude.com/blog/equipping-agents-for-the-real-world-with-agent-skills)
- [Don't Build Agents, Build Skills Instead - Anthropic @ AI Engineer](https://www.youtube.com/watch?v=CEvIs9y1uog) (754K views)
- [Anthropic's official skills repo](https://github.com/anthropics/skills)
- [GitHub Issue #19141: Clarify user-invocable vs disable-model-invocation](https://github.com/anthropics/claude-code/issues/19141)

### Deep Dives & Guides
- [Claude Skills: A First Principles Deep Dive - Lee Han Chung](https://leehanchung.github.io/blogs/2025/10/26/claude-skills-deep-dive/)
- [Inside Claude Code Skills - Mikhail Shilkov](https://mikhail.io/2025/10/claude-code-skills/)
- [How to Make Claude Code Skills Activate Reliably - Scott Spence](https://scottspence.com/posts/how-to-make-claude-code-skills-activate-reliably)
- [Claude Skill vs Command: 2026 Best Practices - OneAway](https://oneaway.io/blog/claude-skill-vs-command)
- [Claude Skills Structure and Usage Guide - mellanon](https://gist.github.com/mellanon/50816550ecb5f3b239aa77eef7b8ed8d)
- [Claude's Modular Mind - ikangai](https://www.ikangai.com/claudes-modular-mind-how-anthropics-agent-skills-redefine-context-in-ai-systems/)
- [Implementing Claude Code Skills from Scratch - Victor Dibia](https://newsletter.victordibia.com/p/implementing-claude-code-skills-from)
- [planning-with-files template](https://github.com/OthmanAdi/planning-with-files) (14.8k stars)
- [Agent Skills Specification](https://agentskills.io/specification)

### Context Engineering
- [Effective Context Engineering for AI Agents - Anthropic](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents)
- [Context Engineering for Coding Agents - Martin Fowler](https://martinfowler.com/articles/exploring-gen-ai/context-engineering-coding-agents.html)
- [Prompt routers and flow engineering - PromptLayer](https://blog.promptlayer.com/prompt-routers-and-flow-engineering-building-modular-self-correcting-agent-systems/)
- [Agentic Engineering Patterns - Simon Willison](https://simonw.substack.com/p/agentic-engineering-patterns)
- [Context Engineering 103: Agent Skills - Chromatic Labs](https://www.chromaticlabs.co/blog/context-engineering-series-agent-skills)

### Community Discussions
- [Reddit: I split my CLAUDE.md into 27 files](https://www.reddit.com/r/ClaudeCode/comments/1rhe89z/) (90 pts, 39 comments)
- [Reddit: How I structure Claude Code projects](https://www.reddit.com/r/ClaudeAI/comments/1r66oo0/) (195 pts, 28 comments)
- [Reddit: Claude Code is brilliant at code but terrible at architecture](https://www.reddit.com/r/ClaudeAI/comments/1qgouxz/) (51 pts, 64 comments)
- [Reddit: A skill that gives Claude instant codebase orientation](https://www.reddit.com/r/ClaudeCode/comments/1qzz099/) (74 pts, 32 comments)
- [GitHub Discussion #182117: Skill activation is extremely unstable](https://github.com/orgs/community/discussions/182117)
- [SFEIR Institute - Custom Commands Examples](https://institute.sfeir.com/en/claude-code/claude-code-custom-commands-and-skills/examples/)
- [wshobson/commands](https://github.com/wshobson/commands) -- production command examples
