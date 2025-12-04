# Repository Guidelines

## Project Structure & Module Organization
- Monorepo managed by Bun workspaces (`package.json` + `pnpm-workspace.yaml`).
- Core utilities: `core/` (logging, spawn helpers, validation, shared exports).
- Plugins: `plugins/*` plus per-plugin MCP servers under `plugins/*/mcp-servers/*`.
- Docs and templates: see `PLUGIN_DEV_GUIDE.md`, `CLAUDE.md`, and per-plugin `README.md`.
- Temporary scratch space lives in `tmp/`; keep experiments out of commits.

## Build, Test, and Development Commands
- Prefer MCP tools with JSON format (token-efficient):
  - `biome_lintCheck({ response_format: "json" })` / `biome_lintFix({ response_format: "json" })`
  - `tsc_check({ response_format: "json" })`
  - `bun_runTests({ response_format: "json" })` / `bun_testFile({ response_format: "json" })`
- Local scripts (when MCP not used): `bun install`; `bun run lint`; `bun run format:check` / `bun run format`; `bun run typecheck`; `bun run test` (use `--filter <pkg>` to scope); `bun run validate` (marketplace consistency).
- CI aggregate: `bun run ci` (typecheck + format check + tests), `bun run ci:full` (adds validate).

## Git Workflow
- Prefer the MCP `git` server for read-only ops with JSON format to minimize token usage:
  - `git_get_status({ response_format: "json" })`
  - `git_get_branch_info({ response_format: "json" })`
  - `git_get_diff_summary({ response_format: "json" })`
- For writes (commits, branches, merges), use standard `git` CLI; avoid destructive commands.

## Coding Style & Naming Conventions
- Language: TypeScript with `tsconfig.json` (ESNext, strict, Bun types).
- Formatting/linting: Biome (`biome.json` rules); no manual formatting tweaks in PRs.
- Tests named `*.test.ts`; overrides in `biome.json` allow relaxed rules for tests.
- Prefer explicit types; avoid `any`; keep modules ESM (`type: "module"` where applicable).

## Testing Guidelines
- Framework: `bun test` in each package; place tests alongside sources as `*.test.ts`.
- Targeted runs: `bun test path/to/file.test.ts` or workspace-filtered via `bun --filter '<pkg>' test`.
- Aim to cover new hooks/validators and any MCP command/skill behavior.

## MCP Tooling (linting, testing, types)
- MCP servers are available for automation: `plugins/biome-runner` (lint/format), `plugins/tsc-runner` (typecheck), `plugins/bun-runner` (tests). Use their `.mcp.json` definitions to wire into agents/CI.
- **CRITICAL:** All MCP tools are machine-to-machine interfaces. **ALWAYS use `response_format: "json"`** for token-efficient, structured responses. Never use `"markdown"` format—it wastes tokens on formatting that agents must parse back into structured data.
- When adding new MCP servers or hooks, mirror existing `hooks.json` and `path-validator` patterns and run `bun run validate`.

## Kit Tool Priority (Token Efficiency)

**CRITICAL:** Use Kit tools in priority order for maximum token efficiency. Tools listed in order of speed and efficiency:

### Priority 1: Index-Based Navigation (Fastest - Use First)
- **Setup:** Run `kit_index_prime({ response_format: "json" })` once per session (~2s, generates PROJECT_INDEX.json)
- **Query index:**
  - `kit_index_find({ symbol_name: "...", response_format: "json" })` — ~10ms, fastest symbol lookup
  - `kit_index_overview({ file_path: "...", response_format: "json" })` — ~10ms, all symbols in file
  - `kit_index_stats({ response_format: "json" })` — ~10ms, codebase statistics

### Priority 2: Graph + Analysis (Fast - Targeted Operations)
Use index + targeted grep (~200-300ms):
- `kit_callers({ function_name: "...", response_format: "json" })` — Who calls this function?
- `kit_usages({ symbol: "...", response_format: "json" })` — All usages of symbol
- `kit_blast({ target: "...", response_format: "json" })` — Change impact analysis
- `kit_api({ directory: "...", response_format: "json" })` — Module exports

### Priority 3: Direct Search (Slower - When Index Insufficient)
Full codebase scan (~30-500ms):
- `kit_grep({ pattern: "...", response_format: "json" })` — ~30ms, text/regex search
- `kit_ast_search({ pattern: "...", response_format: "json" })` — ~400ms, structural patterns
- `kit_semantic({ query: "...", response_format: "json" })` — ~500ms, ML-powered (requires `cased-kit[ml]`)

**Rule:** Always try index-based tools first. Only fall back to grep/search when index tools don't have the needed information.

### Kit Installation
- Required: `uv tool install cased-kit`
- Optional ML: `uv tool install cased-kit[ml]` (for semantic search)
- Prefer Kit MCP over direct CLI to reduce token cost

### Git Insights
- Use the MCP `git` server with JSON format for reads (status/branch/diff) and standard git CLI for writes.

## Commit & Pull Request Guidelines
- Commit messages: follow Conventional Commits (`commitlint.config.js` + Husky hook). Examples: `feat: add git context loader`, `fix: correct bun path validation`, `chore: update docs`.
- PRs: include summary, linked issue/task, testing notes (`bun run ci`), and screenshots or logs for user-facing or tooling changes. Keep plugin/docs updates scoped and cross-reference impacted MCP server if relevant.
