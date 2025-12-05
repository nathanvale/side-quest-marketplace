# MCP Tools Reference

## CRITICAL: Always Use `response_format: "json"`

All MCP tool calls MUST include `response_format: "json"` — saves 40-60% tokens.

---

## Kit Tools — Use in Priority Order

| Priority | Tools | Speed | When to Use |
|----------|-------|-------|-------------|
| **1. Index** | `kit_index_find`, `kit_index_overview`, `kit_index_stats` | ~10ms | Symbol lookup, file structure |
| **2. Graph** | `kit_callers`, `kit_usages`, `kit_blast`, `kit_dead` | ~200ms | Call analysis, impact |
| **3. Search** | `kit_grep`, `kit_ast_search`, `kit_semantic` | ~30-500ms | When index insufficient |

**Setup:** Run `kit_index_prime` once per session (~2s)

**Rule:** Index tools are 30-50x faster. Always try Priority 1 first.

---

## Other Tools Quick Reference

| Plugin | Tools | Use For |
|--------|-------|---------|
| **Git** | `mcp__plugin_git_git-intelligence__git_get_recent_commits`, `git_search_commits`, `git_get_status` | History, status |
| **Bun** | `bun_runTests`, `bun_testFile`, `bun_testCoverage` | Testing |
| **Biome** | `biome_lintCheck`, `biome_lintFix`, `biome_formatCheck` | Linting |
| **TSC** | `mcp__plugin_tsc-runner_tsc-runner__tsc_check` | Type checking |
| **Atuin** | `mcp__plugin_atuin_bash-history__atuin_search_history`, `atuin_history_insights` | Shell history |

---

## Tool Naming Convention

```
mcp__plugin_<plugin>_<server>__<tool>
```

Example: `mcp__plugin_git_git-intelligence__git_get_recent_commits`

---

## Error Responses

Tools return `isError: true` flag on errors. Check this before processing results.
