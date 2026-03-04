---
created: 2026-03-04
title: CLI skills vs MCP tools for agentic coding
type: research
tags: [mcp, cli, skills, claude-code, token-efficiency, agentic-coding, developer-tooling, ecosystem]
project: side-quest-marketplace
status: final
sources: [reddit, x-twitter, web]
method: 2 parallel newsroom beat reporters (Team A pro-CLI, Team B pro-MCP) + staff engineer judge synthesis
---

# CLI Skills vs MCP Tools for Agentic Coding

Adversarial research pitting CLI/skills advocates against MCP-only advocates, then synthesizing an impartial verdict. Each team was given a biased beat reporter who searched Reddit, X/Twitter, and the web for the strongest evidence supporting their position.

## Summary

Neither approach dominates. CLI/skills win decisively on token efficiency (90-99% savings in benchmarks) and simplicity. MCP wins on structured contracts, ecosystem portability, stateful operations, and governance trajectory (Linux Foundation standard). The pragmatic answer: **CLI first as default, MCP when you need what only MCP provides** -- structured I/O, schema validation, cross-client portability, or stateful connections.

## Key Findings

- CLI-to-MCP conversion benchmarks consistently show 90-99% token savings across multiple independent sources
- MCP token bloat is being actively addressed (outputSchema, dynamic toolsets showing 96% reduction, streamable HTTP)
- MCP has achieved institutional lock-in: Linux Foundation governance, backed by Anthropic, OpenAI, Google, Microsoft, Docker
- 10,000+ MCP servers, 97M monthly SDK downloads, 28% Fortune 500 adoption
- CLI wrappers have no equivalent governance, discoverability, or interoperability story
- The "CLI is for humans, MCP is for machines" framing is architecturally sound but overly reductive
- Progressive disclosure (load skills on demand) is independently converging as the correct pattern for both approaches

## Details

### Team A: The Case for CLI / Skills

#### Hard token benchmarks

| Source | Measurement | Type |
|--------|------------|------|
| Reddit r/mcp (168pts) | 94% token reduction converting MCP to CLI | Community benchmark |
| windybank.net | 98.7% fewer tokens with CLI vs MCP | Independent benchmark |
| @Cloudflare (official) | 2,500 endpoints -> 2 tools, 99.9% reduction | Production proof |
| dev.to/@dimwiddle | 63% more input tokens, 47% slower with MCP | Controlled experiment |
| r/LangChain | 50K tokens burned on MCP preloading alone | Practitioner report |

The token argument is Team A's strongest weapon. It's not vibes -- it's reproducible, quantified, and consistent across multiple independent sources. The windybank.net analysis calculates that 5 MCP servers consume ~55,000 tokens before any work begins; enterprise setups reach 100,000-134,000 tokens (half of Claude's context window).

#### Simplicity and reliability

- A markdown skill file with a bash command is easier to debug than a running server process
- No server crashes, no transport failures, no connection management
- Wrapping an existing CLI takes minutes; building an MCP server takes hours
- When MCP server errors mid-chain, the model has no fallback strategy (@saen_dev)
- Even MCP defenders acknowledge complexity: "MCP is an absolute monstrosity of complexity" (@zeeg, 61 likes)

#### Community sentiment

The @chrysb "MCP is dead in the water" tweet (1,601 likes, 91 reposts, 275 replies) represents a loud but contested position. The 275 replies indicate significant pushback -- this is a debate, not consensus. YouTube content titled "The end of MCP for AI agents?" (108K views) amplifies the narrative.

#### Recommended priority hierarchy (windybank.net)

1. Native CLI first
2. Skills second
3. MCP last -- only when no alternative exists

### Team B: The Case for MCP

#### Institutional momentum

MCP's governance story is unmatched. Key milestones:
- December 2025: Anthropic donated MCP to the Linux Foundation
- Agentic AI Foundation (AAIF) launched with co-founders Anthropic, OpenAI, Block
- Supporting members: AWS, Google, Bloomberg, Cloudflare
- First-class client support: Claude, ChatGPT, Cursor, Gemini, VS Code, Copilot, Windsurf, Goose
- 10,000+ active servers, 97M monthly SDK downloads

This is the same institutional backing as Linux, Kubernetes, and Node.js. CLI wrappers have no governance equivalent.

#### The M x N problem

Before MCP: connecting 10 AI applications to 100 tools = potentially 1,000 custom integrations. MCP collapses this to: implement client protocol once, implement server protocol once, everything works. Every CLI wrapper is a bespoke one-off integration with no shared contract.

#### Token bloat -- the rebuttal

Team B argues the token criticism is being technically addressed:

| Solution | Source | Claimed reduction |
|----------|--------|-------------------|
| outputSchema (FastMCP 2.10+) | FastMCP, Elastic Labs | Structured output, fewer tokens |
| Dynamic toolsets | Speakeasy | 96% input token reduction |
| Streamable HTTP transport | MCP spec 2025-03-26 | Replaces SSE, enables cloud deployment |
| Code execution approach | Anthropic guide | 150K -> ~2K tokens |

#### What CLI structurally cannot do

From async-let.com's deep analysis (production Xcode tooling):
- **Structured I/O**: MCP returns typed objects; CLI returns raw text requiring fragile parsing
- **Stateful operations**: MCP maintains running process state, captures logs in memory, preserves context between calls
- **Safety guardrails**: Schema enforcement prevents malformed commands; OAuth 2.1 in the spec
- **Workflow encapsulation**: One MCP call can wrap five CLI calls with piped output

#### Enterprise adoption

- 28% of Fortune 500 implemented MCP in AI stacks (Q1 2025, up from 12% in 2024)
- Fintech sector leads at 45% adoption
- Block cut 40% of workforce while posting record profit using MCP-powered Goose agent

### The Verdict: Scorecard

#### CLI/Skills wins on

- **Token efficiency today** -- benchmarks are real and brutal (90-99% savings)
- **Simplicity** -- markdown + bash is easier to debug than a server process
- **Reliability** -- no server crashes, no transport failures
- **Speed to build** -- wrapping a CLI takes minutes vs hours for MCP
- **Progressive disclosure** -- skills load only when relevant

#### MCP wins on

- **Structured contracts** -- typed inputs/outputs, schema validation
- **Ecosystem portability** -- write once, works across Claude, ChatGPT, Cursor, Gemini
- **Stateful operations** -- maintaining process state, connections, sessions
- **Governance trajectory** -- Linux Foundation standard, universal vendor buy-in
- **Multi-agent interop** -- shared protocol for tool discovery and invocation

#### The pragmatic answer

**Use CLI/skills as default. Reach for MCP when you need what only MCP provides.**

1. **CLI first** for dev tools you already have (git, gh, bun, biome, tsc) -- token savings too large to ignore
2. **MCP when** the tool needs structured I/O with schema validation, stateful connections, cross-client portability, or you're building for an ecosystem beyond Claude Code
3. **Never MCP for wrapping a CLI** -- worst of both worlds (MCP overhead + parsing overhead)
4. **Watch dynamic toolsets** -- if MCP solves the token problem at the protocol level, the calculus shifts toward MCP for everything

## Sources

### Team A (pro-CLI) sources

- [I generated CLIs from MCP servers and cut token usage by 94%](https://www.reddit.com/r/mcp/comments/1rembfo/i_generated_clis_from_mcp_servers_and_cut_token/) (168 pts, 40 comments) -- r/mcp
- [I Made MCPs 94% Cheaper by Generating CLIs from MCP Servers](https://www.reddit.com/r/AI_Agents/comments/1rei6km/i_made_mcps_94_cheaper_by_generating_clis_from/) (38 pts, 27 comments) -- r/AI_Agents
- [Preloading MCP tools cost me ~50k tokens per run](https://www.reddit.com/r/LangChain/comments/1qukgay/preloading_mcp_tools_cost_me_50k_tokens_per_run/) (14 pts, 14 comments) -- r/LangChain
- [Have we overcomplicated the need for MCP?](https://www.reddit.com/r/mcp/comments/1mj61xj/have_we_overcomplicated_the_need_for_mcp/) (38 pts, 40 comments) -- r/mcp
- [MCP tool discovery problem at scale](https://www.reddit.com/r/mcp/comments/1r262kx/mcp_tool_discovery_problem_at_scale_how_we_handle/) (44 pts, 8 comments) -- r/mcp
- ["MCP is dead in the water"](https://x.com/chrysb/status/2025701861031121331) (1,601 likes, 91 reposts) -- @chrysb on X
- [Cloudflare: 2,500 endpoints -> 1,000 tokens](https://x.com/Cloudflare/status/2024847784914882945) -- @Cloudflare on X
- [Why CLI Tools Beat MCP for AI Coding Assistants](https://www.windybank.net/blog/cli-tools-over-mcp) -- windybank.net
- [The MCP I built for AI agents backfired](https://dev.to/dimwiddle/the-mcp-i-built-for-ai-agents-backfired-4c8j) -- dev.to
- [Claude Skills vs MCP: A Technical Comparison](https://intuitionlabs.ai/articles/claude-skills-vs-mcp) -- intuitionlabs.ai
- [Why Top Engineers Are Ditching MCP Servers](https://www.flowhunt.io/blog/why-top-engineers-are-ditching-mcp-servers/) -- flowhunt.io
- [Claude Code: Best practices for agentic coding](https://www.anthropic.com/engineering/claude-code-best-practices) -- anthropic.com
- [The end of MCP for AI agents?](https://www.youtube.com/watch?v=D4ImbDGFgIM) (108,890 views) -- Arseny Shatokhin (YouTube)
- [Most devs don't understand how context windows work](https://www.youtube.com/watch?v=-uW5-TaVXu4) (183,839 views) -- Matt Pocock (YouTube)
- [How I use Claude Code for real engineering](https://www.youtube.com/watch?v=kZ-zzHVUrO4) (197,905 views) -- Matt Pocock (YouTube)

### Team B (pro-MCP) sources

- [Anthropic donates MCP to the Linux Foundation](https://www.reddit.com/r/ClaudeAI/comments/1pid584/breaking_anthropic_donates_model_context_protocol/) (4,336 pts, 116 comments) -- r/ClaudeAI
- [Karpathy thesis: agents are the new distribution channel](https://x.com/aakashgupta/status/2026367615602667784) (2,972 likes, 291 reposts) -- @aakashgupta on X
- [MCP vs API: who is the consumer?](https://x.com/pvergadia/status/2024318030306496670) (480 likes) -- @pvergadia on X
- [freeCodeCamp MCP server explainer](https://x.com/freeCodeCamp/status/2027670371915215316) (558 likes, 85 reposts) -- @freeCodeCamp on X
- [One Year of MCP: From Experiment to Industry Standard](https://dev.to/ajeetraina/one-year-of-model-context-protocol-from-experiment-to-industry-standard-5hj8) -- dev.to
- [Linux Foundation: Agentic AI Foundation](https://www.linuxfoundation.org/press/linux-foundation-announces-the-formation-of-the-agentic-ai-foundation) -- linuxfoundation.org
- [TechCrunch: OpenAI, Anthropic, Block join Linux Foundation](https://techcrunch.com/2025/12/09/openai-anthropic-and-block-join-new-linux-foundation-effort-to-standardize-the-ai-agent-era/) -- techcrunch.com
- [GitHub Blog: MCP joins the Linux Foundation](https://github.blog/open-source/maintainers/mcp-joins-the-linux-foundation-what-this-means-for-developers-building-the-next-era-of-ai-tools-and-agents/) -- github.blog
- [Speakeasy: Reducing MCP token usage by 100x](https://www.speakeasy.com/blog/how-we-reduced-token-usage-by-100x-dynamic-toolsets-v2) -- speakeasy.com
- [Streamable HTTP for MCP](https://thenewstack.io/how-mcp-uses-streamable-http-for-real-time-ai-tool-interaction/) -- thenewstack.io
- [My Take on the MCP vs CLI Debate](https://www.async-let.com/posts/my-take-on-the-mcp-verses-cli-debate/) -- async-let.com
- [MCP Adoption Statistics 2025](https://mcpmanager.ai/blog/mcp-adoption-statistics/) -- mcpmanager.ai
- [2026: The Year for Enterprise-Ready MCP Adoption](https://www.cdata.com/blog/2026-year-enterprise-ready-mcp-adoption) -- cdata.com
- [MCP: Model Context Protocol Explained -- USB-C for AI Agents](https://www.youtube.com/watch?v=Js5-yKkysIo) (226 views) -- Fatima Sheikh (YouTube)

## Open Questions: Staff Engineer Answers

Related solution: `docs/solutions/logic-errors/cli-vs-mcp-open-questions-decision-framework-20260304.md`

### 1) Will MCP dynamic toolsets close the token gap enough to make CLI negligible?
**Answer:** They will narrow the gap substantially but not erase it in most local coding workflows.

**Reasoning:** Dynamic loading directly attacks the biggest MCP cost center (tool preloading/context bloat), but protocol overhead and schema payloads still exist. CLI remains the lowest-overhead path for simple, stateless tasks.

### 2) As `outputSchema` matures, will MCP become genuinely competitive with CLI on token efficiency?
**Answer:** More competitive, yes. Universally equal, unlikely.

**Reasoning:** `outputSchema` improves output compactness and reliability, especially for verbose tools. It does not remove all input-side/tool-contract overhead. Net effect: strong improvement, still use-case dependent.

### 3) Will Claude Code skills remain Claude-only, or become an open standard?
**Answer:** Assume Claude-specific in planning; treat openness as upside, not dependency.

**Reasoning:** MCP has explicit multi-vendor governance momentum. Skills are excellent local productivity primitives, but currently lack equivalent cross-client standardization guarantees.

### 4) With 1M+ context windows, does CLI advantage matter less?
**Answer:** Somewhat less for hard context limits, but still material for latency, cost, and attention quality.

**Reasoning:** Bigger windows reduce overflow risk but do not eliminate compute cost, response latency, or context quality degradation from unnecessary tokens.

### 5) What is the crossover point where MCP benefits outweigh CLI efficiency?
**Answer:** Promote to MCP when at least two of these are true:
- Cross-client interoperability is required
- Stateful connections/sessions are required
- Typed contracts/schemas are required for reliability or compliance
- Capability is strategic and reused across teams

If fewer than two apply, default to CLI/skills.

## Research Closeout

**Final decision policy:** `CLI/skills by default; MCP when protocol-level capabilities are required.`

**Operational rule (adopted):**
1. Start with CLI/skills for local, stateless, single-client workflows.
2. Evaluate MCP if any trigger appears (interop, state, schema, strategic reuse).
3. Standardize on MCP when two or more triggers are present.
4. Reassess quarterly as MCP token optimizations mature.

This research is closed as of **2026-03-04** with a pragmatic hybrid strategy rather than a binary winner.
