# Community Sources: Research Citations

All community research organized by topic. These sources validate and extend the patterns in this skill.

## Agent-Friendly CLI Design

**joelclaw.com - "Designing CLI tools for LLM agents"**
Key ideas: JSON-first output, self-documenting root command, HATEOAS-style `next_actions` in responses. Proposes that every CLI response should tell the agent what it can do next.
Relevance: Validates our JSON envelope and self-documenting help patterns. The `next_actions` concept is a future enhancement opportunity.

**@dhh (David Heinemeier Hansson) - "AI-native dev tools"**
Key ideas: Developer tools should be designed with AI agents as first-class consumers, not afterthoughts.
Relevance: Frames the philosophical case for agent-native CLI design.

**@anitakirkovska - "CLI design for the AI era"**
Key ideas: Structured output is table stakes. CLIs that only produce human-readable text are broken for agents.
Relevance: Supports our tri-modal output approach.

**Lineark (@flipbit03) - AI-native CLI observability**
Key ideas: "13K tokens via MCP vs 1K via CLI." Field projection and selective output are essential for token economy. Built Lineark specifically for agent-friendly monitoring.
Relevance: Directly validates our `--fields` projection pattern. The 13K vs 1K comparison is the strongest argument for field projection.

**Laminar - Headless agent execution guidelines**
Key ideas: "Never block for standard input." JSON-strict mode for agents. No interactive prompts in headless contexts.
Relevance: Validates our `--non-interactive` flag and auto non-TTY JSON mode.

## Standards and Protocols

**ACP (Agent Communication Protocol)**
Key ideas: JSON-RPC 2.0 error codes for agent communication. Structured request/response over HTTP.
Relevance: Different paradigm from CLI (network vs. process), but the error taxonomy concept is similar to our typed exit codes.

**HATEOAS for AI**
Key ideas: REST-style hypermedia controls adapted for agent navigation. Responses include links to related actions.
Relevance: joelclaw.com's `next_actions` is a CLI adaptation of this pattern. Not implemented in our CLI yet.

**JSON-RPC 2.0**
Key ideas: Structured request/response with typed error codes. Standard envelope format.
Relevance: Our JSON envelope (`{"status":"data","data":{...}}`) is simpler but inspired by similar principles.

## Dual-Mode Implementations

**agent-browser (Vercel) - Browser automation CLI**
Key ideas: `{ success: true/false, error: "..." }` envelope. Dual human/agent output modes.
Relevance: Simpler error shape than ours (no error name/code). Validates the dual-mode concept.

**dbg (@Douglance) - AI-first debugger**
Key ideas: "Stateless, one command in, one response out." No persistent state between invocations.
Relevance: Validates the stateless CLI design principle.

**acal - AI calendar CLI**
Key ideas: Natural language input with structured JSON output. Bridges human intent to machine-readable results.
Relevance: Example of agent-first CLI that still serves humans.

**Corral CLI - Container orchestration**
Key ideas: Machine-readable output for all operations. Structured error codes for automation.
Relevance: Production example of agent-friendly CLI patterns in infrastructure tooling.

## Token Economy

**Lineark (@flipbit03) - "13K tokens via MCP vs 1K via CLI"**
The defining metric for agent CLI design. When an agent reads CLI output, every token counts against its context window. Field projection and minimal output modes reduce token consumption by 10-13x.

**Context window constraints**
Agents with 4K-8K context budgets cannot process verbose CLI output. Field projection, `--quiet` mode, and JSONL streaming are not nice-to-haves -- they're requirements for agent operability.

## Zero-Dependency Philosophy

**@yacineMTB (569 likes on X) - "0 dependencies. It's not hard."**
Advocates building CLI tools without framework dependencies. Manual arg parsing, manual output formatting.
Relevance: Directly validates our zero-dep arg parsing approach.

**@cramforce - Minimal dependency CLIs**
Key ideas: Every dependency is a liability. CLI tools should be self-contained.
Relevance: Supports the zero-dep philosophy.

**@ctatedev - "Ship binaries, not node_modules"**
Key ideas: CLI distribution should be a single binary, not a dependency tree.
Relevance: Our Bun-based CLI compiles to a single file with no runtime dependencies.

## Human-in-the-Loop (HITL) Patterns

**@_philschmid - Allow/deny patterns for agent actions**
Key ideas: Agents should request permission before destructive actions. CLI tools should support approval workflows.
Relevance: Our `--non-interactive` flag is the escape hatch. Future enhancement: structured approval prompts.

**@RhysSullivan - Unix-style permissions for agents**
Key ideas: File-system permission model adapted for agent capabilities.
Relevance: Conceptually related to our nonce-based server authentication.

**1Password Touch ID for agent authentication**
Key ideas: Biometric approval for sensitive agent actions.
Relevance: Future pattern for high-security CLI operations.

## Observability CLI Landscape

**@tom_doerr - OpenClaw-OPS**
Open-source observability CLI for AI agent operations. Similar problem space to our tool.
Relevance: Direct competitor/peer in the agent observability space.

**@0xDevShah - Market critique of agent observability**
Key ideas: Current observability tools don't serve AI agents well. The market needs agent-native solutions.
Relevance: Validates the problem space our CLI addresses.

**ClawMetry**
Agent-native metrics and telemetry platform.
Relevance: Adjacent tool in the agent observability ecosystem.

## Key Projects to Watch

| Project | Focus | Why It Matters |
|---------|-------|---------------|
| Lineark | AI-native CLI observability | Field projection, token economy |
| agent-browser | Browser automation for agents | Dual-mode output, error contracts |
| click-llm | CLI introspection for agents | Auto-generates agent-compatible schemas |
| Laminar | Headless agent execution | JSON-strict mode, no-stdin rules |
| ACP | Agent communication protocol | Standardizing agent-to-tool communication |
| dbg | AI-first debugger | Stateless CLI design |

## Debates and Unresolved Questions

**CLI vs. MCP**
Should agent tools be CLIs (process-based) or MCP servers (network-based)? CLIs are simpler but slower (process startup). MCP servers are persistent but require more infrastructure. Our tool supports both -- CLI for ad-hoc use, HTTP API for persistent integration.

**JSON-first vs. JSON-optional**
joelclaw.com advocates JSON as the default output. We use human prose as default with JSON on request. The community hasn't converged. Auto non-TTY detection is a pragmatic middle ground.

**HITL UX**
How should agents request human approval through a CLI? No standard exists. `--non-interactive` is the current escape hatch, but structured approval prompts (with timeouts and defaults) would be better.
