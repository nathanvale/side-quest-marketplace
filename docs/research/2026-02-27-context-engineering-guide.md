---
created: 2026-02-27
title: "The Context Engineering Guide"
type: research
tags: [context-engineering, progressive-disclosure, hooks, memory, mcp]
project: my-agent-dojo
status: final
source_url: "https://www.iwoszapar.com/resources/context-engineering/access"
author: "Iwo Szapar"
published_date: 2026-02-01
---

## Summary

A 7-section guide arguing that prompt engineering is a dead end because prompts are stateless -- they don't compound across sessions. Context engineering inverts the model: instead of you providing context to AI on demand, you build a system that provides context automatically before you type a single word. The guide covers the 5 layers of context, 9 CE patterns, progressive disclosure architecture, context resilience, static vs dynamic context, and a setup audit framework.

## Key Findings

### 01 - Why Prompt Engineering Plateaus

Prompt engineering is a dead end -- not because it doesn't work, but because it doesn't compound. Every new chat starts from zero. You re-explain your role, preferences, and context. The AI does something useful. You close the tab. Tomorrow you do it again.

**The core insight:** A prompt tells AI what to do in this moment. Context tells AI who it's working with, what it already knows, what rules it enforces, and what it's learned from previous work. The prompt is 5% of what determines usefulness. Context is the other 95%.

The ceiling on prompt engineering is that you're always the one doing the work of providing context. You're the memory. You're the rulebook. You're the continuity.

Context engineering inverts this. Instead of you providing context to AI on demand, you build a system that provides context automatically -- before you type a single word.

**Prompt engineering vs Context engineering:**

| Prompt Engineering | Context Engineering |
|---|---|
| Stateless -- resets every session | Stateful -- builds across sessions |
| You are the memory | System is the memory |
| Quality depends on your prompt craft | Quality improves as system learns |
| Effort stays constant (or grows) | Effort decreases over time |
| Model-dependent -- breaks on updates | Model-agnostic -- survives updates |

### CE as an Engineering Discipline - Four Sub-Problems

1. **Composition** - What context to include and from which sources. The answer is never "everything." It's the minimum set that makes the AI effective for this task.

2. **Ranking** - Which context gets loaded first when budget is constrained. Not all context is equal -- critical rules and recent activity outrank general background.

3. **Optimization** - Pruning irrelevant content before it reaches the model. Active removal, not passive accumulation. Smaller and relevant beats larger and comprehensive.

4. **Orchestration** - Sequencing context assembly across tools and agents. Which agent reads what, when, in what order. The plumbing of a multi-agent setup.

### Critical Warning on AI-Generated Context

Don't generate your CLAUDE.md or AGENTS.md with AI. Gloaguen et al. found that AI-generated context files reduce task performance by ~3% and increase cost by 20% or more compared to human-written files. Write your own. Keep them minimal. The AI optimizes for completeness, not for signal-to-noise ratio.

### 02 - The 5 Layers

1. **Project Instructions (CLAUDE.md)** - A file at the root of your workspace that Claude reads on every conversation. Your preferences, rules, writing style, tool conventions -- loaded automatically every time.
2. **Persistent Memory** - AI learns from every conversation and stores patterns, client details, and decisions in structured memory files.
3. **Tool Connections (MCP)** - The Model Context Protocol lets AI read and act on your real tools -- Gmail, Calendar, LinkedIn, CRM, Stripe.
4. **Skills & Workflows** - Reusable commands like `/daily-briefing` or `/draft-proposal` that combine multiple tools and context sources into one action.
5. **Hooks - Deterministic Automation** - Shell commands that fire automatically at specific points -- before a tool runs, after a file is saved, when a session starts. They don't rely on AI judgment. They always execute.

Hook types:
- **PreToolUse** - Block edits on protected files. Fires before any tool runs -- can prevent the action.
- **PostToolUse** - Auto-update CRM after outreach. Fires after a tool succeeds -- sync external systems.
- **SessionStart** - Load today's priorities. Fires when you open Claude -- inject daily context.
- **Stop** - Verify tests pass before finishing. Fires when Claude finishes -- enforce quality gates.

Example hook (auto-track every email send in CRM):

```json
{
  "hooks": {
    "PostToolUse": [{
      "matcher": "Bash",
      "hooks": [{
        "type": "command",
        "command": "./track-outreach.sh"
      }]
    }]
  }
}
```

### 03 - The 9 Context Engineering Patterns

(Section content gated behind interactive accordion on source page -- pattern names not fully enumerated in the scraped content.)

### 04 - Progressive Disclosure Architecture

(Section content gated behind interactive accordion on source page.)

### 05 - Context Resilience

(Section content gated behind interactive accordion on source page.)

### 06 - Static vs Dynamic Context

| Dimension | Static Context | Engineered Context |
|---|---|---|
| Context | Dumps everything into the conversation | Retrieves only the relevant context per query |
| Memory | Resets every session | Accumulates how you work over time |
| Day 30 | Same as Day 1 | Knows your clients by name |
| Maintenance | You maintain it (or it decays) | Maintains itself, tells you what needs attention |
| Visibility | No insight into what's working | Dashboard: assistant health, quality trends, gaps |
| Updates | One-time snapshot -- creator moves on | Creator keeps improving, you get updates automatically |

### 07 - Audit Your Setup

(Section content gated behind interactive accordion on source page.)

## Sources

- [The Context Engineering Guide (Full Access)](https://www.iwoszapar.com/resources/context-engineering/access)
- [Context Engineering Landing Page](https://www.iwoszapar.com/context-engineering) (contains 5-layer detail and hook examples)
- Gloaguen et al. research on AI-generated context files (cited in article, specific paper not linked)

## Open Questions

- What are the 9 CE patterns referenced in section 03? Only 5 patterns are enumerated in the MCP companion article. The guide claims 9 but sections 03-05, 07 were gated behind JS accordions.
- How does "context rot" (mentioned in the Context Architect article) interact with the progressive disclosure architecture described in section 04?
- The "Context Dashboard" concept (local HTML file tracking assistant health scores) -- is this a real product feature or a conceptual illustration?
