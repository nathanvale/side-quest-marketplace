# SideQuest Marketplace

Bun monorepo with 20+ Claude Code plugins (MCP servers, slash commands, skills, hooks).

**Stack:** Bun 1.3.3 | TypeScript 5.7.2 (strict) | Biome 2.3.7 | Conventional Commits

---

## CRITICAL RULES — YOU MUST FOLLOW

| Rule | Why |
|------|-----|
| Run `bun run validate` before push | CI blocks PRs that fail |
| Use `workspace:*` for cross-plugin deps | Version numbers break resolution |
| Use `response_format: "json"` in MCP tools | Saves 40-60% tokens |
| Use `${CLAUDE_PLUGIN_ROOT}` in .mcp.json | Absolute paths break portability |
| Run `bun install` from root only | Plugin-level corrupts lockfile |

**NEVER:**
- Commit without `bun run validate:quick` passing
- Create circular dependencies between plugins
- Skip Kit index prime before multiple code searches
- Commit files from `.test-scratch/`

---

## Commands

| Task | Command |
|------|---------|
| Quick validate | `bun run validate:quick` (~5s, pre-commit) |
| Full validate | `bun run validate` (~30s, before push) |
| Plugin validate | `claude plugin validate plugins/<name>` |
| Create plugin | `/plugin-template:create <name>` |
| Commit | `/git:commit` |
| Create PR | `/git:create-pr` |

**MCP tools (preferred):** `bun_runTests`, `bun_testFile`, `tsc_check`, `biome_lintCheck`, `biome_lintFix`

---

## Code Search — Use in Priority Order

```
1. kit_index_find     → Know symbol name (~10ms)
2. kit_index_overview → Need file symbols (~10ms)
3. kit_callers        → Find who calls function (~200ms)
4. kit_grep           → Text/regex pattern (~30ms)
5. kit_semantic       → Fuzzy search (~500ms, last resort)
```

**IMPORTANT:** Run `kit_index_prime` once per session. Index tools are 30-50x faster.

---

## Structure

```
side-quest-marketplace/
├── plugins/           # 20+ plugins (workspace packages)
├── core/              # Shared validation engine
├── PROJECT_INDEX.json # Kit codebase index
└── docs/              # Extended documentation
```

---

## Plugin Development

**Tool naming:** `mcp__<plugin>_<server>__<tool>`

**Required MCP parameters:**
```typescript
{ response_format: "json" }  // ALWAYS
{ isError: true }            // On errors
```

**Cross-plugin deps:**
```json
{ "@anthropic/core": "workspace:*" }  // ✓ Correct
{ "@anthropic/core": "^1.0.0" }       // ✗ Wrong
```

---

## Error Recovery

| Problem | Fix |
|---------|-----|
| Typecheck fails | `bun typecheck` for details |
| Lint fails | `biome_lintFix` to auto-fix |
| Test fails | `bun_testFile` on failing test |
| Plugin structure | `claude plugin validate plugins/<name>` |
| Deps broken | `cd root && rm -rf node_modules bun.lockb && bun install` |

---

## Extended Documentation

Reference these **only when needed** for the specific task:

- Plugin development: @./PLUGIN_DEV_GUIDE.md
- MCP tools reference: @./docs/MCP_TOOLS.md
- Git workflow: @./docs/GIT_WORKFLOW.md
- Troubleshooting: @./TROUBLESHOOTING.md

---

## Pre-Push Checklist

- [ ] `bun run validate` passes
- [ ] Tests cover new functionality
- [ ] Commit follows `<type>(<scope>): <subject>`
- [ ] Cross-plugin deps use `workspace:*`
