---
created: 2026-02-27
title: "Context Engineering with MCP: A Practitioner's Guide to the Model Context Protocol"
type: research
tags: [context-engineering, mcp, agents]
project: my-agent-dojo
status: final
---

## Summary

Distills five production MCP patterns from running 12 MCP servers daily across 72 client deployments. Frames context engineering as four sub-problems (composition, ranking, optimization, orchestration) and positions MCP as the implementation layer that makes context engineering systematic rather than artisanal. Includes three common failure modes and practical implementation steps.

## Key Findings

### What Context Engineering Actually Means

Context engineering is the discipline of deciding what information an AI model receives, in what order, at what level of detail, and from which sources. Anthropic's engineering team defines it as finding "the smallest set of high-signal tokens that maximize the likelihood of your desired outcome."

Four distinct problems compressed into that definition:

1. **Composition** - Selecting which raw materials belong in the context window. Every token you include displaces another. The question is always what to include, not how much you can fit.

2. **Ranking** - Once you've selected your materials, which ones matter most? The model treats information at the top of its context differently than information buried 80,000 tokens deep. Position is signal.

3. **Optimization** - Compressing, truncating, summarizing, and formatting to maximize signal density within finite token budgets. A 200-page client document cannot enter the context window raw.

4. **Orchestration** - Dynamically assembling context at runtime based on the task, the user, the conversation state, and the tools available. Static context works for chatbots. Production AI agents need context that adapts.

### Why MCP Is the Implementation Layer

MCP (released by Anthropic in November 2024) is an open standard for connecting AI applications to external data sources and tools through a universal interface.

**Adoption timeline:**
- November 2024: Anthropic releases MCP
- March 2025: OpenAI adds MCP support
- April 2025: Google DeepMind follows
- December 2025: Anthropic donates MCP to the Linux Foundation's Agentic AI Foundation

**Current scale:** 10,000+ active public MCP servers, 97 million monthly SDK downloads.

Context engineering requires three capabilities MCP provides:
- **Standardized tool definitions** - so the model understands what each tool does
- **Structured data retrieval** - so information enters the context in a consistent format
- **Composable connections** - so you can combine multiple sources without bespoke glue code

### Five Production MCP Patterns

#### Pattern 1: Layered Context Assembly

The most common CE mistake is treating every query the same way. Different queries need different MCP servers activated.

- "Summarize my week" needs calendar + email + task lists
- "Draft a proposal for Acme Corp" needs CRM + past proposals + LinkedIn activity

Each layer activates based on intent classification. The model determines what the user needs, then calls only the MCP tools required for that specific task.

#### Pattern 2: Progressive Disclosure Over Front-Loading

Early mistake: loading everything into the system prompt. System prompts grew to thousands of tokens and performance degraded. Too much information competing for attention at every turn.

Solution: Client context lives in structured files accessible through the filesystem MCP server. The system prompt contains only identity-level information plus pointers to where deeper context lives. When the model needs client history, it retrieves it through MCP at the moment of need. This "just-in-time" pattern keeps the base context lean.

#### Pattern 3: Cross-Source Verification

One MCP server can lie -- data sources go stale, APIs return partial results, cached information drifts. When a client asks about a prospect's status:
- CRM MCP server provides the structured record
- Email MCP server shows recent correspondence
- LinkedIn MCP server reveals their latest activity

If the CRM says "last contact: 3 weeks ago" but email shows a reply from yesterday, the model flags the discrepancy. Multiple servers provide overlapping views, and the model synthesizes them into a more accurate picture.

#### Pattern 4: Context Scoping by Client Archetype

72 clients cluster into five archetypes:
- Solo Consultants (35%) - Google Workspace + LinkedIn
- Agency Owners (20%) - CRM + project management
- Corporate Knowledge Workers (20%) - Notion (~30% of all clients)
- AI-Native Builders (15%) - Code repos + documentation
- Career Reinventors (10%) - LinkedIn + content creation

Scope context engineering by archetype first, then customize. The archetype determines which MCP servers activate by default, what information gets priority ranking, and how responses get formatted.

#### Pattern 5: Error Context Preservation

When an MCP tool call fails, don't suppress the error and retry. Failed tool calls contain diagnostic information the model can use to self-correct.

If Google Calendar MCP returns an authentication error, keep that in context so the model can inform the user. If a LinkedIn lookup returns no data, the model adjusts its approach rather than hallucinating profile information. Preserving error traces turns failures into adaptation signals.

### Context Engineering Failure Modes

1. **Context Bloat** - System accumulates information without pruning. MCP prevents this through structured, scoped retrieval with bounded responses.

2. **Context Staleness** - Retrieved information is outdated. MCP servers connect to live data sources -- each tool call retrieves current information, not cached snapshots.

3. **Context Fragmentation** - Information from different sources doesn't connect. MCP's standardized response format makes cross-source synthesis possible.

### Practical Implementation Steps

1. **Start with an information audit.** Map what information your AI system needs for its core tasks. Most clients use 4-8 MCP servers from a vetted catalog of 33.

2. **Design your context layers.** Separate always-present context (identity, core instructions) from on-demand context (retrieved via MCP). System prompt = skeleton. MCP = flesh, but only when needed.

3. **Instrument your context quality.** Track which MCP tools get called most frequently, which return useful results, and which produce data the model ignores.

4. **Iterate on orchestration logic.** The sequence in which MCP tools get called matters. Calendar data before email context produces different results than the reverse, because earlier context shapes how the model interprets later information.

5. **Scope aggressively.** Every MCP server you connect expands the tool surface the model must reason about. Unused tools in the context window are a tax on every interaction.

## Sources

- [Iwo Szapar](https://www.iwoszapar.com/p/context-engineering-mcp) -- published 2026-02-11
- [Context Engineering with MCP (Original Article)](https://www.iwoszapar.com/p/context-engineering-mcp)
- Anthropic engineering team definition of context engineering (cited, not directly linked)
- Robomotion team MCP description (cited as "interface contract between an AI model and the external world")
- Manus team documentation on file system as extended memory and error recovery (cited)
- Gartner prediction: 40% of enterprise applications will include AI agents by end of 2026 (cited)

## Open Questions

- How does orchestration ordering (step 4) interact with Claude's context window attention patterns? Is there quantitative data on position-based signal degradation?
- The 33-server catalog is referenced but not fully enumerated. The Second Brain MCP article provides the 8-tier breakdown.
- What specific metrics does the author use to "instrument context quality" (step 3)? Tool call frequency vs. influence on response quality seems hard to measure.
