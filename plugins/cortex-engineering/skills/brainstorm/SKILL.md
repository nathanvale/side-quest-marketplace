---
name: brainstorming-with-cortex
description: Runs brainstorming sessions that build on existing Cortex knowledge. Checks for prior research and brainstorms before exploring. Delegates to cortex-engineering-frontmatter skill for doc structure. Use when the user wants to brainstorm, explore ideas, or think through an approach.
allowed-tools:
  - Bash(cortex *:*)
  - Read
  - Glob
  - Grep
  - Write
  - Task
---

# Brainstorm Skill

You run brainstorming sessions that build on existing Cortex knowledge. The key insight: every brainstorm starts with what's already known, so ideas compound over time.

## Workflow

### 1. Confirm the idea

Ask the user to confirm:
- **Topic/idea**: What are we brainstorming about?
- **Goal**: What decision or direction are we trying to reach?
- **Project context**: Is this for a specific project or general?

### 2. Check cortex first (the compounding step)

Before brainstorming, check what cortex already knows:

```bash
cortex search "<topic>" --json
```

Or grep directly:

```bash
grep -rl "<topic>" ~/code/my-agent-cortex/docs/ 2>/dev/null
```

If in a project repo, also check:

```bash
grep -rl "<topic>" ./docs/ 2>/dev/null
```

**If related docs found:**
- Read them thoroughly
- Present a summary: "Found N research docs and M prior brainstorms on this. Here's what we already know..."
- Highlight key findings, prior decisions, and open questions
- Use these as the foundation for brainstorming

**If nothing found:**
- Note it: "No prior cortex knowledge on this. We're starting from scratch."
- Consider suggesting `/cortex-engineering:research` first if the topic is complex

### 3. Run the brainstorm

Structure the brainstorm around:

1. **Context framing** -- state what we know (from cortex + user input)
2. **Key questions** -- what are we trying to answer?
3. **Approach generation** -- explore 2-4 distinct approaches
4. **Trade-off analysis** -- pros, cons, effort for each
5. **Decision or next steps** -- land on a direction or identify what research is still needed

**Brainstorming style:**
- Ask the user probing questions -- don't just present options
- Challenge assumptions from prior research
- Look for creative combinations of approaches
- Be concrete: include rough effort estimates, tech choices, architecture sketches
- If the user seems stuck, offer provocative "what if" questions

### 4. Synthesize and write

Delegate to the **cortex-engineering-frontmatter** skill for correct doc structure:

- Use the `brainstorm` doc type
- Fill in all sections: Context, Questions, Approaches, Decision, Next Steps
- Reference prior cortex docs by filename in the Context section

**File location:**
- If in a project repo: `./docs/brainstorms/YYYY-MM-DD-<slug>.md`
- If no project context: `~/code/my-agent-cortex/docs/brainstorms/YYYY-MM-DD-<slug>.md`

### 5. Confirm

Tell the user:
- Where the brainstorm was saved
- Summary of the decision/direction (or "no decision yet")
- Suggest next step: "When you're ready to plan implementation, run `/cortex-engineering:plan`" (future) or "Need more data? Run `/cortex-engineering:research <specific-gap>`"
- Suggest: "Want a diagram of this? Run `/cortex-engineering:visualize <saved-path>`"

## Example Frontmatter

```yaml
---
created: 2026-02-27
title: "CLI Tool Architecture Brainstorm"
type: brainstorm
tags: [cli, architecture, bun, typescript]
project: my-agent-cortex
status: draft
---
```

## Key Principles

- **Knowledge compounds** -- always start from what cortex already knows
- **Brainstorms are collaborative** -- ask questions, don't just present
- **Approaches need trade-offs** -- never present options without pros/cons
- **Decisions are optional** -- it's OK to end with "needs more research"
- **Reference prior work** -- link to research docs that informed the brainstorm
