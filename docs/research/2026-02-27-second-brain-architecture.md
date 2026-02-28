---
created: 2026-02-27
title: "Context Engineering for Knowledge Workers: The Second Brain Architecture"
type: research
tags: [second-brain, context-engineering, mcp, hooks, skills]
project: my-agent-dojo
status: final
source_url: "https://www.iwoszapar.com/context-engineering"
author: "Iwo Szapar"
published_date: 2026-02-01
---

## Summary

The landing page for Szapar's Second Brain product, but contains substantial technical content about context engineering architecture. Describes the 5 layers of context engineering (CLAUDE.md, persistent memory, MCP tool connections, skills/workflows, hooks), provides hook configuration examples, a static vs engineered context comparison table, a context dashboard concept, and a 7-step guided setup flow. Built from analysis of 81 real client setups.

## Key Findings

### What Is a Second Brain?

A system that gives AI the right context about you, automatically, every time. Four components:

1. **Persistent Context** - Your preferences, voice, frameworks, and client history -- structured so AI knows about you before you say anything
2. **AI Agents** - Specialized helpers (Chief of Staff, Content Pipeline, Sales Outreach) pre-configured with your context
3. **Skills & Workflows** - Reusable commands like `/daily-briefing` or `/draft-proposal` that combine multiple assistants into one action
4. **Connected Tools** - Links to Gmail, Calendar, LinkedIn, CRM -- so your AI can read and act on real data from your actual tools

**Flow:** You talk to Claude -> Guide builds + maintains -> Second Brain structures your context -> Claude works with full context -> Better output every time.

### The 5 Layers of Context Engineering

#### Layer 01: Project Instructions (CLAUDE.md)

A file at the root of your workspace that Claude reads on every conversation.

```
# CLAUDE.md
## Voice: Direct, no fluff. Never use "leverage" or "synergy."
## Clients: Enterprise SaaS, 50-200 employees
## When writing proposals: Use the 3-part framework from /templates
```

#### Layer 02: Persistent Memory

AI learns from every conversation and stores patterns, client details, and decisions in structured memory files. Month 1: knows your name. Month 6: knows your client's pricing objections and how you handle them.

#### Layer 03: Tool Connections (MCP)

The Model Context Protocol lets AI read and act on your real tools. Instead of telling AI about your schedule, it reads your calendar directly. Instead of copying client data, it queries your CRM.

Connected tools: Gmail, Calendar, LinkedIn, Stripe, CRM, WhatsApp, Google Drive, Notion.

#### Layer 04: Skills & Workflows

Reusable commands like `/daily-briefing` or `/draft-proposal` that combine multiple tools and context sources into one action. Type one command, get a complete output that would've taken 30 minutes manually.

#### Layer 05: Hooks - Deterministic Automation

Shell commands that fire automatically at specific points. They don't rely on AI judgment. They always execute.

| Hook Type | Example Use | Behavior |
|---|---|---|
| PreToolUse | Block edits on protected files | Fires before any tool runs -- can prevent the action |
| PostToolUse | Auto-update CRM after outreach | Fires after a tool succeeds -- sync external systems |
| SessionStart | Load today's priorities | Fires when you open Claude -- inject daily context |
| Stop | Verify tests pass before finishing | Fires when Claude finishes -- enforce quality gates |

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

**Key insight:** Most "AI setups" only use Layer 1. A Second Brain uses all 5 layers working together. That's why the output quality is fundamentally different.

### Static Context vs Engineered Context

| Dimension | Static Context | Engineered Context |
|---|---|---|
| Context | Dumps everything into the conversation | Retrieves only the relevant context per query |
| Memory | Resets every session | Accumulates how you work over time |
| Day 30 | Same as Day 1 | Knows your clients by name |
| Maintenance | You maintain it (or it decays) | Maintains itself, tells you what needs attention |
| Visibility | No insight into what's working | Dashboard: assistant health, quality trends, gaps |
| Updates | One-time snapshot -- creator moves on | Creator keeps improving, you get updates automatically |

### Context Dashboard Concept

A locally-generated HTML dashboard (no app, no login, no server -- self-contained HTML on your computer) that tracks:

- **Per-workflow health cards** - Each card is an AI workflow with its own context. Green = fresh, reliable. Red = stale, quality declining.
- **Quality scores** - Per-workflow quality out of 100, with recency tracking
- **Quality trend** - 30-day graph showing improvement over time
- **Recommendations** - Actionable suggestions (e.g., "Update Sales Outreach -- 3 new clients added since last update", "Research Brief unused for 28 days. Archive or rebuild?")

Example workflow cards with quality scores:
- Chief of Staff: 94/100 (updated today)
- Content Pipeline: 88/100 (updated yesterday)
- Sales Outreach: 72/100 (3 days ago -- attention needed)
- Client Proposals: 91/100 (updated today)
- Research Brief: 45/100 (28 days ago -- stale)
- Meeting Prep: 86/100 (2 days ago)

### Client Demographics

- 54% never opened a terminal
- 56% non-technical roles
- 87% disorganized files
- Setup friction = #1 blocker (8 out of 8 friction categories)

### 7-Step Guided Setup Flow (~77 minutes total)

1. **Profile Extraction & Pattern Detection** (5 min) - 5 questions extract 20+ data points. Detects 1 of 7 patterns: Hub Persona, Input>Output Problem, Editor-in-Chief, Visual Output, Non-Technical+Friction, Perfectionist Paralysis, or Builder/Technical. Based on analysis of 81 real client setups.

2. **Import & Analyze Your AI History** (15 min) - Import from ChatGPT, Claude, Drive, Notion history.

3. **MCP Recommendation Engine** (10 min) - Analyzes questionnaire data and generates prioritized MCP recommendations from 33-server catalog.

4. **Workflow Template Generation** (15 min) - Creates workflow templates based on detected pattern and priorities.

5. **Voice & Style Encoding** (12 min) - Captures writing voice and style patterns.

6. **Context Architecture Optimization** (15 min) - Optimizes the overall context structure.

7. **First Workflow Setup & Validation** (5 min) - Run first real workflow to validate the system works.

### Context Compounding Over Time

- **Context Propagation** - Add a new client brief, the Guide pushes that context to every workflow that needs it (proposal assistant, briefing, content voice) automatically.
- **Month 1:** Basic context. **Month 3:** Knows your client patterns. **Month 6:** Claude knows your business as well as your best employee.
- **Problem detection** - "Your prospecting assistant hasn't been updated since you added 3 new clients." Flags stale workflows, unused assistants, knowledge gaps.
- **Data stays local** - Guide is a remote plugin that reads local brain structure. Content, client data, and personal information never leave the machine. Only tool call frequency data shared for product improvement.

## Sources

- [Context Engineering for Knowledge Workers (Landing Page)](https://www.iwoszapar.com/context-engineering)
- AI Maturity Index research - Co-founded with Harvard researchers, validated by analyzing 420,000 data points on AI adoption, acquired by ISG in January 2026

## Open Questions

- The 7 behavioral patterns (Hub Persona, Input>Output Problem, Editor-in-Chief, Visual Output, Non-Technical+Friction, Perfectionist Paralysis, Builder/Technical) -- how were these derived? Were they emergent from 81 client interviews or pre-defined?
- The context dashboard quality scores (e.g., "94/100") -- what's the scoring methodology? Is it based on recency, usage frequency, or some measure of output quality?
- "Guide is a remote plugin that reads your local brain structure" -- what protocol does this use? Is it an MCP server itself? What's the trust model for a remote plugin reading local files?
- The claim that context compounds such that "Month 6: Claude knows your business as well as your best employee" -- what does this mean in practice for a stateless LLM? Is it just that the persistent context files have accumulated enough detail?
