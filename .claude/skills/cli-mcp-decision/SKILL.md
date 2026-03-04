---
name: cli-mcp-decision
description: Decide whether a workflow should use CLI skills, MCP, or a hybrid approach. Use when planning agentic tooling, writing ADRs, or evaluating migrations between CLI and MCP.
argument-hint: [workflow context]
---

# CLI MCP Decision

Use this skill to make repeatable, evidence-based integration decisions for agent tooling.

## Quick Start
1. Capture the workflow context and constraints.
2. Apply MCP trigger scoring.
3. Produce a recommendation with rationale, risks, and review cadence.

## Inputs To Collect
- Workflow name and owner
- Clients that must be supported (Claude-only or multi-client)
- State requirements (stateless vs session/connection lifecycle)
- Contract requirements (typed schema, compliance constraints)
- Reuse scope (single team vs multi-team platform capability)
- Cost constraints (token budget, latency budget)

## Decision Process

### Step 1: Start From Default
Assume `CLI/skills` first for local, stateless, single-client workflows.

### Step 2: Evaluate MCP Triggers
Count each trigger that applies:
- Cross-client interoperability is required
- Stateful sessions/connections are required
- Typed contracts/schema validation are required
- Capability is strategic and reused across teams

### Step 3: Apply Crossover Rule
- If 2+ triggers apply: recommend `MCP`
- If <2 triggers apply: recommend `CLI/skills`
- If requirements split by workflow phase: recommend `Hybrid`

### Step 4: Validate Non-Functional Constraints
- Compare expected token overhead and latency
- Document reliability/fallback behavior
- Document security and ownership boundaries

### Step 5: Output Decision Record
Return a concise decision block:
- Recommendation (`CLI/skills`, `MCP`, or `Hybrid`)
- Trigger score (`N/4`)
- Top 3 reasons
- Key risks and mitigations
- Reassessment date (default: 90 days)

## Output Template
```md
Decision: <CLI/skills|MCP|Hybrid>
Trigger score: <N>/4
Reasons:
1. ...
2. ...
3. ...
Risks:
- ...
Mitigations:
- ...
Reassess on: <YYYY-MM-DD>
```

## Done When
- [ ] Recommendation is explicit and trigger-scored
- [ ] Tradeoffs are documented (token, latency, reliability, portability)
- [ ] Reassessment date is set
