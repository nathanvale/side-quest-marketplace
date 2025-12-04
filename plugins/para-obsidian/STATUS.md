# Para Obsidian – Progress & Next Steps

## Completed (this session)
- Config loader (ENV-first, user/project rc, defaults for tags/frontmatter/template versions).
- FS safety helpers (vault path resolution, list/read).
- Frontmatter utilities (parse/serialize/validate; file read/validate; frontmatter CLI commands).
- Template loader + create-from-template (Title Case filenames, templater arg substitution).
- Search: rg-based text search + frontmatter/tag filtering; CLI wired.
- Indexer: build/save/load lightweight index (frontmatter/tags/headings); CLI `index prime/query`.
- Rename with link rewrite (wikilinks/MD links), dry-run; CLI `rename`.
- Delete with confirm/dry-run; CLI `delete`.
- Git guard (repo presence + clean check).
- Insert/append/prepend under heading/block with CLI `insert`.
- Git auto-commit flag (add/commit after writes if vault git) and template_version tracking on create/validate/migrate.
- Template version migration helper (`frontmatter migrate`) with optional force + dry-run.
- Bulk template migration (`frontmatter migrate-all`) and attachment inclusion flag for auto-commit.
- Semantic search via kit (CLI `semantic`, MCP tool `semantic_search`).
- MCP server wiring: para-obsidian MCP with config/list/read/search/semantic/index prime/query/create/insert/rename/delete/frontmatter get/validate/migrate/migrate-all.
- Tests: 42 pass in `plugins/para-obsidian/src`.

## Remaining / Next Work
- Template migration scaffolding (version bumps, helper commands).
- Semantic/Kit integration and richer index queries (dir-scoped).
- CLI polish: consistent JSON outputs, better args for frontmatter filters (`--frontmatter.key value`), and improved format checks.

## Reference
- Original plan/spec captured in chat; snapshot at `plugins/para-obsidian/SPEC.md`. Core requirements mirror para-brain templates and validate-note rules.
- Templates live at `plugins/para-brain/templates`; defaults reflected in config loader and frontmatter rules.
- Current code/tests in `plugins/para-obsidian/src`.
