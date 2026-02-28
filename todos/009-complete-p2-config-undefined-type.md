---
status: pending
priority: p2
issue_id: "009"
tags: [code-review, typescript, type-safety]
dependencies: ["001"]
---

# Config type uses `undefined` instead of typed error

## Problem Statement

`loadConfig()` returns `CortexConfig | undefined` where `undefined` conflates "no config file found" with "config file exists but is invalid." Callers can't distinguish between these cases.

**Why it matters:** Different failure modes require different agent actions -- "no config" might mean "create one" while "invalid config" means "fix the existing one."

## Findings

- **Source:** kieran-typescript-reviewer (high)
- **Location:** `src/config.ts` -- `loadConfig()` return type
- **Evidence:** Returns undefined for both missing and invalid configs

## Proposed Solutions

### Option A: Return discriminated union

Return `{ ok: true, config: CortexConfig } | { ok: false, error: ConfigError }` so callers can distinguish failure modes.

- **Pros:** Type-safe, explicit error handling
- **Cons:** More verbose call sites
- **Effort:** Small
- **Risk:** Low

### Option B: Throw on invalid, return undefined on missing

Return `undefined` only when no config file exists. Throw `ConfigError` when the file exists but is invalid.

- **Pros:** Simple, conventional
- **Cons:** Error handling via exceptions
- **Effort:** Small
- **Risk:** Low

## Recommended Action

_(To be filled during triage)_

## Technical Details

- **Affected files:** `src/config.ts`, `src/cli.ts`

## Acceptance Criteria

- [ ] Callers can distinguish "no config" from "invalid config"
- [ ] Error messages guide the user/agent to the right fix
- [ ] `bun run validate` passes

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-28 | Created from multi-agent review | TS reviewer flagged as high |

## Resources

- Branch: `feat/add-cortex`
