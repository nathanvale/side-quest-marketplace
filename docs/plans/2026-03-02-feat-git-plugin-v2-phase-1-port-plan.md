---
created: 2026-03-02
title: "Git Plugin V2 - Phase 1: Port to Marketplace"
type: plan
tags: [git, plugin, marketplace, port]
project: git-plugin
status: draft
parent: docs/plans/2026-03-02-feat-git-plugin-v2-marketplace-port-plan.md
---

> Phase 1 of 5 from the master plan: `docs/plans/2026-03-02-feat-git-plugin-v2-marketplace-port-plan.md`
> V1 source: `~/code/side-quest-plugins/plugins/git/` (27 files)
> Target: `plugins/git/` in the marketplace

# Phase 1: Port Git Plugin to Marketplace

## Goal

Copy the V1 git plugin into the marketplace directory and get it passing `bun run validate` + `bun test`. Functionally identical to V1 -- no features added, no behavior changed.

## Why This Should Be Low-Friction

Both repos share identical toolchain configs:
- **tsconfig.base.json:** Same strict settings, same `bun-types`, same `verbatimModuleSyntax: true`
- **biome.json:** Same formatter (tabs, single quotes, 80-char), same linter rules, same Biome version (2.3.x)
- **Bun runtime:** Both use `bun test` and `bun run`

V1 already passes lint + typecheck in its home repo. The port should be near-frictionless. The main work is directory creation, file copying, marketplace registration, and README update.

---

## Steps

### Step 1: Create directory structure

Create the target directories:

```bash
mkdir -p plugins/git/.claude-plugin
mkdir -p plugins/git/commands
mkdir -p plugins/git/hooks
mkdir -p plugins/git/skills/workflow
```

### Step 2: Copy all files

Copy from V1 to marketplace. 27 files total, organized by category:

**Plugin manifest (1 file):**
```
.claude-plugin/plugin.json
```

**Commands (10 files):**
```
commands/changelog.md
commands/checkpoint.md
commands/commit.md
commands/compare.md
commands/create-pr.md
commands/history.md
commands/review-pr.md
commands/session-log.md
commands/squash.md
commands/worktree.md
```

**Hooks -- entry points (5 files):**
```
hooks/auto-commit-on-stop.ts    (Stop)
hooks/command-logger.ts          (PostToolUse)
hooks/git-context-loader.ts      (SessionStart)
hooks/git-safety.ts              (PreToolUse)
hooks/session-summary.ts         (PreCompact)
```

**Hooks -- shared modules (2 files):**
```
hooks/event-bus-client.ts
hooks/git-status-parser.ts
```

**Hooks -- tests (3 files):**
```
hooks/event-bus-client.test.ts
hooks/git-safety.test.ts
hooks/git-status-parser.test.ts
```

**Hooks -- config (1 file):**
```
hooks/hooks.json
```

**Skill (5 files):**
```
skills/workflow/SKILL.md
skills/workflow/CONVENTIONS.md
skills/workflow/EXAMPLES.md
skills/workflow/WORKFLOWS.md
skills/workflow/WORKTREE.md
```

**Excluded from copy:** `plans/`, `research/` -- these already exist at `docs/` level in the marketplace.

### Step 3: Register in marketplace

Add the git plugin entry to `.claude-plugin/marketplace.json`:

```json
{
  "name": "git",
  "source": "./plugins/git",
  "description": "Git workflow automation with conventional commits, safety hooks, worktree management, and PR creation",
  "category": "development",
  "tags": ["git", "commits", "conventional-commits", "safety", "worktree", "pr"]
}
```

Bump the marketplace `"version"` from `"0.1.0"` to `"0.2.0"` (minor bump for plugin addition, per validation rules).

### Step 4: Update README

The V1 README is comprehensive and well-written. Port it with these updates:
- Update version reference from `v1.0.0` to `v2.0.0`
- Keep all existing content (features, hooks, commands, skill description, usage examples)

### Step 5: Run Biome check

```bash
bun run check
```

This runs `biome check --write .` which auto-fixes formatting and lint issues. Since both repos use the same Biome config, this should produce zero or near-zero changes. If any files are reformatted, review to confirm format-only changes.

### Step 6: Run typecheck

```bash
bun run typecheck
```

The marketplace tsconfig includes `plugins/**/*.ts`. Since both repos share the same `tsconfig.base.json`, this should pass cleanly.

**If errors occur**, the most likely causes:
- Import path issues (V1 uses `./event-bus-client` relative imports -- these should work as-is)
- Missing type in a catch clause (marketplace strict mode)

### Step 7: Run marketplace validation

```bash
bun run validate:marketplace
```

This checks:
- marketplace.json structure (name, version, plugins array)
- Plugin entry fields (kebab-case name, valid category, tags array)
- Source path resolves to directory with `.claude-plugin/plugin.json`
- No duplicate names
- Name matches source directory basename (`"git"` matches `./plugins/git`)

### Step 8: Run tests

```bash
bun test plugins/git/
```

This runs the 3 test files:
- `git-safety.test.ts` -- tests `checkCommand()` against blocked/allowed patterns
- `git-status-parser.test.ts` -- tests `parsePorcelainStatus()`, `getMainWorktreeRoot()`, `getStableRepoName()`
- `event-bus-client.test.ts` -- tests `postEvent()` with ephemeral HTTP servers

**Note:** `bun test` is NOT part of `bun run validate`. Must be run separately.

**Potential test issue:** `event-bus-client.test.ts` manipulates `HOME` env var and creates temp directories. It uses `afterEach` to clean up. Should work in the marketplace context without changes.

### Step 9: Full validation gate

Run everything together to confirm:

```bash
bun run validate && bun test plugins/git/
```

Both must pass with zero errors.

---

## Success Criteria

- [ ] `plugins/git/` directory exists with all 27 files (+ README)
- [ ] `.claude-plugin/marketplace.json` has git plugin entry
- [ ] marketplace.json version is `0.2.0`
- [ ] `bun run validate` passes (lint + typecheck + marketplace structure)
- [ ] `bun test plugins/git/` passes (3 test files, all green)
- [ ] No `plans/` or `research/` directories inside the plugin
- [ ] No functional changes to any V1 code (format changes from Biome are acceptable)

---

## What's NOT in This Phase

| Deferred to Phase 2 | Reason |
|---------------------|--------|
| Self-destruct timers on hooks | Marketplace compliance, not port |
| Reference restructure (`references/` subdirectory) | Marketplace compliance |
| SKILL.md description polish | Marketplace compliance |
| plugin.json description tightening | Marketplace compliance |
| Event bus global path update | Marketplace compliance |
| Version bump to 2.0.0 in plugin.json | Phase 2 (compliance) |
