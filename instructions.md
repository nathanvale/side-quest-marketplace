# Instructions

For Claude Code working in side-quest-marketplace.

---

## Kit Tools: Which to Use?

**CRITICAL:** Always follow this priority order. Index tools are 30-50x faster.

| Need | Tool(s) | Speed | Setup |
|------|---------|-------|-------|
| **Find where X is defined** | `kit_index_find` | ~10ms | Run `kit_index_prime` once per session |
| **Find who uses X** | `kit_callers` / `kit_usages` | ~200ms | Same setup |
| **Find by structure** | `kit_ast_search` | ~30-500ms | No setup needed |
| **Find by meaning** | `kit_semantic` | ~500ms | Requires ML deps + first-run index build |
| **Show file/module structure** | `kit_file_tree` / `kit_api` | ~50ms | No setup needed |

**Priority hierarchy:** 1) Index → 2) Graph/Analysis → 3) Direct Search (ast/semantic)

→ Always use `response_format: "json"` for token efficiency (40-60% savings vs markdown)

---

## Why Kit Grep is Disabled

`kit_grep` has been disabled because:
- Timeouts at ~30s on large repos (MPCU-Build-and-Deliver)
- Priority 1/2 tools provide same results 30-50x faster
- Index-based lookups are more reliable and efficient

**Use instead:** `kit_index_find` for symbols, `kit_callers` for usage analysis, `kit_ast_search` for patterns.

---

## Key Rules

- **ALWAYS** run `kit_index_prime` before using index tools
- **NEVER** call `kit_grep` — use Priority 1/2 tools instead
- **ALWAYS** use `response_format: "json"` for all MCP tools
- **ALWAYS** validate workspace with `bun run validate:quick` before committing

See `CLAUDE.md` for full documentation.
