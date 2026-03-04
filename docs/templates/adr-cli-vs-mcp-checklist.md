---
title: CLI vs MCP Decision Checklist (ADR/Plan Template)
created: 2026-03-04
type: template
tags: [adr, planning, cli, mcp, decision-framework, architecture]
---

# CLI vs MCP Decision Checklist

Use this checklist in ADRs and planning docs when selecting an agent-tool integration pattern.

## Decision Summary
- Decision owner:
- Date:
- Workflow/capability:
- Decision: `CLI/Skills` | `MCP` | `Hybrid`

## Baseline Rule
- [ ] We started from `CLI/skills by default` for local, stateless, single-client workflows.

## MCP Trigger Check
Mark each trigger as `Yes`/`No`.

- [ ] Cross-client interoperability required (Claude + ChatGPT/Cursor/Gemini/etc)
- [ ] Stateful sessions/connections required
- [ ] Typed contracts/schema validation required (reliability/compliance)
- [ ] Strategic shared capability reused across teams

## Crossover Rule
- [ ] If 2 or more MCP triggers are `Yes`, MCP is recommended.
- [ ] If fewer than 2 triggers are `Yes`, CLI/skills remains recommended.

## Cost & Quality Validation
- [ ] Token overhead estimated and compared (`CLI` vs `MCP`)
- [ ] Latency impact estimated and acceptable
- [ ] Failure modes documented (fallback behavior, retries, degraded mode)
- [ ] Observability defined (logs, metrics, traces, error taxonomy)

## Security & Governance
- [ ] Auth model documented (least privilege, secret handling)
- [ ] Contract ownership documented (who maintains schemas/tools)
- [ ] Portability requirements explicit (single-client vs multi-client future)

## Implementation Decision
- Chosen approach:
- Why this is correct now:
- What would trigger revisiting this decision:

## 90-Day Reassessment
- [ ] Review date scheduled
- [ ] Re-check MCP maturity (`outputSchema`, dynamic toolsets, transport improvements)
- [ ] Re-run token/latency comparison with latest measurements

## References
- `docs/research/2026-03-04-cli-skills-vs-mcp-tools-agentic-coding.md`
- `docs/solutions/logic-errors/cli-vs-mcp-open-questions-decision-framework-20260304.md`
