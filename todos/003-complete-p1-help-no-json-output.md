---
status: pending
priority: p1
issue_id: "003"
tags: [code-review, agent-native, cli]
dependencies: []
---

# --help produces no JSON output

## Problem Statement

The `help` command writes directly to stderr with no JSON envelope on stdout. An agent that runs `cortex --help` to discover available commands gets no parseable output -- just human-readable text on stderr.

**Why it matters:** Agent discovery depends on being able to introspect CLI capabilities. Without JSON help output, agents can't programmatically determine available commands, flags, and their semantics.

## Findings

- **Source:** agent-native-reviewer (critical)
- **Location:** `src/cli.ts` -- help handler
- **Evidence:** Help output uses `process.stderr.write()` with no corresponding JSON envelope

## Proposed Solutions

### Option A: Add --json support to help

When `--help --json` is passed, emit a JSON envelope describing commands, flags, and usage.

- **Pros:** Agents can discover capabilities, maintains human-readable default
- **Cons:** Slightly more code
- **Effort:** Small
- **Risk:** Low

### Option B: Document capabilities in SKILL.md instead

Rather than making `--help` JSON-aware, ensure all CLI capabilities are documented in the plugin's SKILL.md so agents discover via skill context rather than CLI introspection.

- **Pros:** No code change, uses existing Claude Code patterns
- **Cons:** Duplicates documentation, can drift from implementation
- **Effort:** Small
- **Risk:** Medium -- documentation drift

## Recommended Action

_(To be filled during triage)_

## Technical Details

- **Affected files:** `src/cli.ts`
- **Components:** Help handler, output formatting

## Acceptance Criteria

- [ ] `cortex --help --json` produces structured JSON describing commands and flags
- [ ] OR SKILL.md documents all CLI capabilities for agent discovery
- [ ] `bun run validate` passes

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-28 | Created from multi-agent review | Agent-native reviewer flagged as critical |

## Resources

- Branch: `feat/add-cortex`
