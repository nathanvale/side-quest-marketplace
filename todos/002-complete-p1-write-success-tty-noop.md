---
status: pending
priority: p1
issue_id: "002"
tags: [code-review, agent-native, output]
dependencies: []
---

# writeSuccess is a no-op in TTY mode

## Problem Statement

`writeSuccess()` in `output.ts` only emits JSON when `options.json` is true OR `!process.stdout.isTTY`. When an agent calls cortex from a TTY (e.g., Claude Code's Bash tool), the success envelope is silently swallowed. The agent gets no structured response.

**Why it matters:** This breaks the agent-native contract. Agents running in TTY contexts receive empty stdout for successful operations, making it impossible to parse results programmatically.

## Findings

- **Source:** kieran-typescript-reviewer (high), agent-native-reviewer (critical)
- **Both agents independently identified this as a fundamental agent-native contract violation**
- **Location:** `src/output.ts:46-58` -- `writeSuccess` function
- **Evidence:** The `if (options.json || !process.stdout.isTTY)` guard means TTY + no `--json` flag = no output

## Proposed Solutions

### Option A: Always emit JSON on stdout

Remove the TTY guard entirely. Always write the JSON envelope to stdout. Human-readable output goes to stderr (already the case for errors).

- **Pros:** Simplest fix, agents always get structured data
- **Cons:** Humans see JSON on stdout (but they see the table on stderr anyway)
- **Effort:** Small
- **Risk:** Low -- this is the Unix convention (data on stdout, messages on stderr)

### Option B: Emit JSON when --json flag is set, table otherwise

Keep TTY detection but always emit _something_ on stdout -- either JSON (with --json) or a table. This means stdout always has parseable output.

- **Pros:** Better human experience in TTY
- **Cons:** Agents without --json get unparseable table output
- **Effort:** Small
- **Risk:** Medium -- agents must remember to pass --json

## Recommended Action

_(To be filled during triage)_

## Technical Details

- **Affected files:** `src/output.ts`
- **Components:** writeSuccess, all command handlers that call it

## Acceptance Criteria

- [ ] `cortex list` produces JSON on stdout when called from TTY without --json
- [ ] OR `cortex list --json` always produces JSON regardless of TTY
- [ ] Agent-native contract: every successful operation returns parseable structured data
- [ ] `bun run validate` passes

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-28 | Created from multi-agent review | Flagged by both TS reviewer and agent-native reviewer |

## Resources

- Branch: `feat/add-cortex`
