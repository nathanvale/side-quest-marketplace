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
- Migration hooks with tag backfills/status normalization; default template versions at 2; change summaries in migrate output; migrate-all emits change notes and `attachmentsUsed`.
- Attachment auto-discovery for auto-commit when attachments not explicitly passed.
- Semantic search via kit (CLI `semantic`, MCP tool `semantic_search`).
- MCP server wiring: para-obsidian MCP with config/list/read/search/semantic/index prime/query/create/insert/rename/delete/frontmatter get/validate/migrate/migrate-all/set.
- CLI polish: shared formatter utilities and colored output for CLI/MCP responses (core formatter helpers, applied across config/search/rename/delete/insert/git/migrate flows); consistent JSON mode handling.
- Frontmatter set/edit support (dry-run, unset, auto-commit) and MCP `frontmatter_set`; config output now surfaces commit template.
- Multi-dir search/index/semantic with default dir scoping, richer frontmatter filters (`--frontmatter` or `frontmatter.key`), and dir-aware semantic output.
- Migration scaffolding: migrate-all supports dir lists, `--force` version bumps, and type filtering; auto-commit paths include mutated notes.
- Version bump planner: `frontmatter plan <type> --to <version>` plus MCP `frontmatter_plan`; dir-aware counts for outdated/missing/mismatched notes.
- Template catalog: `templates` CLI + MCP tool listing configured template versions.
- Plan application: `frontmatter apply-plan <plan.json>` + MCP `frontmatter_apply_plan` to migrate only listed files (status filters, auto-commit aware).
- Plan refinement: apply-plan supports dir filters, filtered-plan emission, and per-file previews in JSON/MD.
- CLI migrate messaging shows per-file change hints and error details; frontmatter set warns on unknown/invalid fields and suggests allowed fields; strict mode exits on warnings.
- Suggestions: `frontmatter set` can report allowed fields/enums; `frontmatter plan`/`apply-plan` support saving filtered plans.
- Tests: 48 pass in `plugins/para-obsidian/src`.

## Remaining / Next Work
- Consider richer hints for frontmatter set (e.g., allowed enums) and migrate failure auto-fixes.
- Extend plan tooling with per-type summaries and interactive prompts. (interactive stub added; full flow TBD)

## Reference
- Original plan/spec captured in chat; snapshot at `plugins/para-obsidian/SPEC.md`. Core requirements mirror para-brain templates and validate-note rules.
- Templates live at `plugins/para-brain/templates`; defaults reflected in config loader and frontmatter rules.
- Current code/tests in `plugins/para-obsidian/src`.
