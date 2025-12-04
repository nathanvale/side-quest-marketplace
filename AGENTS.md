# Repository Guidelines

## Project Structure & Module Organization
- Monorepo managed by Bun workspaces (`package.json` + `pnpm-workspace.yaml`).
- Core utilities: `core/` (logging, spawn helpers, validation, shared exports).
- Plugins: `plugins/*` plus per-plugin MCP servers under `plugins/*/mcp-servers/*`.
- Docs and templates: see `PLUGIN_DEV_GUIDE.md`, `CLAUDE.md`, and per-plugin `README.md`.
- Temporary scratch space lives in `tmp/`; keep experiments out of commits.

## Build, Test, and Development Commands
- Prefer MCP tools (token-efficient): `biome-runner` for lint/format, `tsc-runner` for typecheck, `bun-runner` for tests. Wire via their `.mcp.json` or CLI bindings.
- Local scripts (when MCP not used): `bun install`; `bun run lint`; `bun run format:check` / `bun run format`; `bun run typecheck`; `bun run test` (use `--filter <pkg>` to scope); `bun run validate` (marketplace consistency).
- CI aggregate: `bun run ci` (typecheck + format check + tests), `bun run ci:full` (adds validate).

## Git Workflow
- Prefer the MCP `git` server for read-only ops (`git_get_status`, `git_get_branch_info`, diff summaries) to minimize token usage.
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
- When adding new MCP servers or hooks, mirror existing `hooks.json` and `path-validator` patterns and run `bun run validate`.

## Kit / Context7 Parity
- The `kit` MCP server exposes Kit’s search/symbol/file-tree capabilities; prefer it over shelling out to reduce token cost. Pass refs or cache options through MCP where needed (Kit CLI supports `--ref` and cache commands).
- If you must use the Kit CLI directly, install via `uv tool install cased-kit[all]` and ensure `kit` is on PATH; keep usage consistent with MCP responses to avoid drift.
- For git insights, use the MCP `git` server for reads (status/branch/diff) and standard git CLI for writes.

## Commit & Pull Request Guidelines
- Commit messages: follow Conventional Commits (`commitlint.config.js` + Husky hook). Examples: `feat: add git context loader`, `fix: correct bun path validation`, `chore: update docs`.
- PRs: include summary, linked issue/task, testing notes (`bun run ci`), and screenshots or logs for user-facing or tooling changes. Keep plugin/docs updates scoped and cross-reference impacted MCP server if relevant.
