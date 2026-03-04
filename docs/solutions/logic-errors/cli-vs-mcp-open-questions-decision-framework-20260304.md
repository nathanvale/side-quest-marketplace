---
module: Research
date: 2026-03-04
problem_type: logic_error
component: agentic_tooling_strategy
symptoms:
  - "Research produced strong evidence on both sides (CLI/skills vs MCP) but left unresolved open questions at decision time"
  - "Discussion risked collapsing into binary framing ('CLI or MCP') without operational triggers"
  - "No explicit crossover criteria existed for when to promote a workflow from CLI to MCP"
root_cause: decision_framework_gap
resolution_type: strategy_standardization
severity: medium
tags: [cli, mcp, skills, token-efficiency, architecture, decision-framework, agentic-coding]
---

# Troubleshooting: Resolving CLI vs MCP Open Questions With A Staff-Engineer Decision Framework

## Problem
The research synthesis in `docs/research/2026-03-04-cli-skills-vs-mcp-tools-agentic-coding.md` had solid evidence, but the open questions were still ambiguous for implementation decisions. Teams could read the report and still disagree on what to do next in production.

## Environment
- Module: Research / Architecture
- Affected Component: agentic tooling selection policy
- Date: 2026-03-04

## Symptoms
- Open questions remained directional rather than operational (for example, "will dynamic toolsets close the gap?").
- Teams lacked a repeatable rule for selecting CLI vs MCP per workflow.
- Risk of overcorrecting to one approach and missing tradeoffs around cost, portability, and reliability.

## What Didn't Work

**Attempted Solution 1:** Treat CLI and MCP as mutually exclusive architectural choices.
- **Why it failed:** Evidence supports a conditional strategy, not a winner-take-all decision.

**Attempted Solution 2:** Use token benchmarks alone as the primary decision criterion.
- **Why it failed:** Token cost is critical, but does not cover interoperability, typed contracts, or stateful session needs.

**Attempted Solution 3:** Use ecosystem momentum alone as the primary decision criterion.
- **Why it failed:** Governance/adoption strength does not automatically justify overhead for simple local workflows.

## Solution

Converted open questions into a practical policy:

1. **Default to CLI/skills** for local developer workflows and straightforward command orchestration.
2. **Promote to MCP only when at least two conditions are true**:
   - Multi-client interoperability is required (for example, Claude + ChatGPT + IDE clients).
   - Stateful sessions/connections are required.
   - Typed schemas/contracts are required for reliability or compliance.
   - Capability is strategic and reused across teams.
3. **Track protocol maturity quarterly** (dynamic toolsets, `outputSchema`) and re-evaluate threshold decisions.

**Decision rubric (adopted):**
```text
If workflow is local + stateless + single-client => CLI/skills
If workflow is cross-client OR stateful OR schema-critical => evaluate MCP
If 2+ MCP triggers apply => MCP recommended
Else => stay on CLI/skills
```

## Why This Works
1. Preserves immediate token and simplicity benefits where they matter most (daily coding loops).
2. Avoids under-investing in interoperability for shared/enterprise agent capabilities.
3. Replaces opinion-driven debates with explicit triggers and review cadence.

## Prevention
- Add a lightweight architecture check in planning docs: "CLI default / MCP triggers satisfied?"
- Record MCP adoption decisions with explicit trigger evidence (which two triggers were met).
- Reassess quarterly as MCP token optimizations mature.
- Avoid "MCP wrapper around existing CLI" unless it clearly removes complexity rather than adding it.

## Testing / Validation
- Verify each new tooling proposal can be classified by the rubric with no ambiguity.
- Run a pilot on one representative workflow in each class:
  - Local stateless task (should remain CLI).
  - Cross-client stateful task (should recommend MCP).
- Confirm decision outcomes align with expected latency/cost/reliability goals.

## Related Documentation
- `docs/research/2026-03-04-cli-skills-vs-mcp-tools-agentic-coding.md`
- `docs/research/2026-03-04-mcp-community-intelligence.md`
- `docs/research/2026-02-27-context-engineering-guide.md`
