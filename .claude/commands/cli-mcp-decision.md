---
name: cli-mcp-decision
description: Choose CLI skills vs MCP using a trigger-scored staff-engineer framework. Use when writing ADRs/plans or evaluating migrations.
argument-hint: "[workflow context]"
---

# CLI MCP Decision

Use the `cli-mcp-decision` skill to produce a decision record for this workflow:

`$ARGUMENTS`

## Required Output
Return this exact structure:

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

## MCP Trigger Scoring
Count each trigger that applies:
- Cross-client interoperability required
- Stateful sessions/connections required
- Typed contracts/schema validation required
- Strategic shared capability reused across teams

## Decision Rule
- 2+ triggers: prefer `MCP`
- <2 triggers: prefer `CLI/skills`
- Mixed phases/requirements: `Hybrid`

## Constraints
- Be concise and decision-ready.
- Make tradeoffs explicit (token cost, latency, reliability, portability).
- If any key input is missing, state the assumption explicitly.
