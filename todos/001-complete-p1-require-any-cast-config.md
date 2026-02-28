---
status: pending
priority: p1
issue_id: "001"
tags: [code-review, typescript, type-safety]
dependencies: []
---

# require() + any cast in config.ts

## Problem Statement

`config.ts` uses `require('node:module').createRequire` with an `any` cast to load YAML config files. This bypasses TypeScript's type system entirely and could mask runtime errors. The `require()` call also bypasses Bun's module resolution.

**Why it matters:** The `any` type propagates through the config loading path, making it impossible for TypeScript to catch type mismatches between the YAML file and `ConfigSchema`.

## Findings

- **Source:** kieran-typescript-reviewer (critical severity)
- **Location:** `src/config.ts` -- config loading function
- **Evidence:** `require` imported and cast to `any`, defeating `noUncheckedIndexedAccess` and other strict checks

## Proposed Solutions

### Option A: Use Bun.file() + YAML parser

Replace `require()` with `Bun.file().text()` + a YAML parser (js-yaml or yaml package). Parse the result and validate with `ConfigSchema.parse()`.

- **Pros:** Type-safe, Bun-native, explicit error handling
- **Cons:** Adds a YAML parsing dependency (gray-matter already includes js-yaml though)
- **Effort:** Small
- **Risk:** Low

### Option B: Use readFileSync + gray-matter

Since gray-matter is already a dependency and can parse YAML, use it to parse the config file.

- **Pros:** No new dependencies, reuses existing parser
- **Cons:** gray-matter is designed for frontmatter, slightly awkward for pure YAML
- **Effort:** Small
- **Risk:** Low

## Recommended Action

_(To be filled during triage)_

## Technical Details

- **Affected files:** `src/config.ts`
- **Components:** Config loading, YAML parsing

## Acceptance Criteria

- [ ] No `require()` calls in config.ts
- [ ] No `any` casts in config loading path
- [ ] Config loading uses typed YAML parsing
- [ ] `bun run validate` passes

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-28 | Created from multi-agent review | TypeScript reviewer flagged as critical |

## Resources

- Branch: `feat/add-cortex`
