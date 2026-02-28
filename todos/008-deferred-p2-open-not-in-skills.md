---
status: pending
priority: p2
issue_id: "008"
tags: [code-review, agent-native, documentation]
dependencies: []
---

# open command and CLI flags not documented in SKILL.md

## Problem Statement

The `open` command is not listed in the plugin's SKILL.md, so agents relying on skill context for command discovery won't know it exists. Additionally, CLI flags like `--type`, `--tag`, `--project`, `--status`, `--fields`, `--limit`, `--sort`, `--json`, `--quiet` are not documented in the skill context.

**Why it matters:** Claude Code agents discover plugin capabilities through SKILL.md. Undocumented commands and flags are invisible to agents.

## Findings

- **Source:** agent-native-reviewer (warning, 2 findings merged)
- **Location:** Plugin SKILL.md (if it exists) or plugin.json commands list
- **Evidence:** open command and CLI flag documentation missing from agent-discoverable surfaces

## Proposed Solutions

### Option A: Update SKILL.md with full CLI reference

Add a comprehensive CLI reference section to SKILL.md documenting all commands and flags.

- **Pros:** Complete agent discovery, single source of truth
- **Cons:** Must be kept in sync with code
- **Effort:** Small
- **Risk:** Low

## Recommended Action

_(To be filled during triage)_

## Technical Details

- **Affected files:** Plugin SKILL.md or equivalent documentation

## Acceptance Criteria

- [ ] All CLI commands documented in agent-discoverable location
- [ ] All flags with descriptions and types
- [ ] `bun run validate` passes

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-28 | Created from multi-agent review | Agent-native reviewer flagged |

## Resources

- Branch: `feat/add-cortex`
