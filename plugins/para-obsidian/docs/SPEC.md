# Para Obsidian – Working Spec (Snapshot)

Source context: chat session with user; based on PARA/Templater templates at `plugins/para-brain/templates` and validate-note rules.

## Goals
- CLI + MCP server for PARA-style Obsidian vault management (local vault; ENV-first config).
- Feature parity with Obsidian MCP idea: list/read/search, create from template, insert, rename/move with link updates, delete with confirm, frontmatter validation/edit, index/semantic search, git guard/auto-commit, template versioning/migration.
- Intelligent inbox processing with classifier system for document types (invoices, bookings, bookmarks, etc.)
- Web bookmark management via Obsidian Web Clipper integration with PARA classification
- Vault path via `PARA_VAULT`; optional rc (`~/.config/para-obsidian/config.json`, `.para-obsidianrc`).

## Command Surface (planned)
- Config: show resolved config.
- List/read: vault/dir listing, cat file.
- Search: rg text/regex/glob with context; filters `--tag`, `--frontmatter key=val`, `--dir`; semantic via Kit (scope by dir) – TODO.
- Index: `prime`/`query` (frontmatter/tag/headings from cached index; dir scope); semantic index reuse planned.
- Create: from templates (Templater prompts; Title Case filenames; dest rules per type); periodic helpers planned.
- Insert: under heading/block; append/prepend – TODO.
- Rename/move: link rewrite (wikilink/md), dry-run (done).
- Delete: confirm + dry-run (done).
- Frontmatter: get/validate (done); set/edit – TODO; enforce rules per type.
- Git: guard (repo check, clean status done); auto-commit flag – TODO.
- Template versioning/migration: track template_version, migrate older notes – TODO.

## Templates & Rules
- Templates default to `<vault>/06_Metadata/Templates` (project, area, resource, task, daily, weekly-review, capture, checklist, booking, itinerary, trip-research).
- Filename rule: Title Case with spaces; avoid generic names.
- Frontmatter required per type (see validate-note/STATUS defaults): project/area/resource/task/daily/weekly-review/capture/checklist/booking/itinerary/research.
- Suggested tags seed: project, area, resource, task, daily, journal, review, weekly, checklist, booking, itinerary, research, capture, inbox, travel, work, family, health, learning, finance, home, career.

## Config Model
- ENV required: `PARA_VAULT`; optional `PARA_OBSIDIAN_CONFIG`.
- User rc: `~/.config/para-obsidian/config.json`; project rc: `.para-obsidianrc`.
- Fields: vault, templatesDir, indexPath, defaultSearchDirs, autoCommit, gitCommitMessageTemplate, suggestedTags, frontmatterRules, templateVersions.

## Guardrails
- Writes require git repo (guard); delete needs confirm; rename supports dry-run; link rewrites only within vault.
- Git auto-commit optional (TODO); attachments inclusion to consider.

## Pending Work (high level)
- Insert/append/prepend; frontmatter set.
- Auto-commit flow; semantic/Kit integration; template migrations; MCP server mirror.
