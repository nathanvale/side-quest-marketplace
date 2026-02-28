---
title: Cortex Stage 0 -- Dogfood MVP
type: feat
status: active
date: 2026-02-27
origin: docs/brainstorms/2026-02-27-cortex-brainstorm.md
---

# Cortex Stage 0 -- Dogfood MVP

## Context

Nathan is building Cortex, an agent-native knowledge system that replaces Obsidian with plain markdown files, YAML frontmatter, and agent tooling. The full vision spans 9 stages from personal dogfood to enterprise intent engineering platform (see brainstorm: `docs/brainstorms/2026-02-27-cortex-brainstorm.md` in my-agent-dojo).

Stage 0 is the smallest possible MVP: `my-agent-cortex` -- a single repo that serves as its own Claude Code marketplace (with a cortex plugin providing research skills), a knowledge store, and a CLI tool. The goal is Nathan using it daily with 10+ docs.

## Architecture

One repo, three jobs. No dependency on side-quest branding.

`my-agent-cortex` is its own marketplace (like `every-marketplace` contains `compound-engineering`). When installed in Claude Code, it clones to `~/.claude/plugins/marketplaces/my-agent-cortex/` and the cortex plugin becomes available.

### Source repo: `~/code/my-agent-cortex/`

The repo you develop in. Contains the marketplace plugin, knowledge store, and CLI.

### Installed clone: `~/.claude/plugins/marketplaces/my-agent-cortex/`

Claude Code's read-only clone. Provides skills/commands to every session.

### Where docs get written

| Context | Location |
|---------|----------|
| No project context | `~/code/my-agent-cortex/docs/research/YYYY-MM-DD-<topic>.md` |
| Working in a project repo | `~/code/<project>/docs/research/YYYY-MM-DD-<topic>.md` |

The CLI finds everything via `config.yaml` glob patterns regardless of where docs live.

### Repo structure

```
~/code/my-agent-cortex/
├── plugins/
│   └── cortex/                          # the Claude Code plugin
│       ├── .claude-plugin/
│       │   └── plugin.json
│       ├── README.md
│       ├── skills/
│       │   ├── cortex-frontmatter/
│       │   │   └── SKILL.md         # router: base fields + per-system extras (default, PARA)
│       │   ├── research/
│       │   │   └── SKILL.md         # workflow: check cortex, dispatch research, synthesize
│       │   └── brainstorm/
│       │       └── SKILL.md         # workflow: check cortex, brainstorm, synthesize
│       └── commands/
│           ├── research.md              # /cortex:research -- do new research
│           ├── add.md                   # /cortex:add -- capture existing research
│           └── brainstorm.md            # /cortex:brainstorm -- brainstorm with cortex context
├── config.yaml                          # source registry (globs + viewer)
├── docs/                                # shared/global knowledge
│   ├── research/
│   ├── brainstorms/
│   └── meetings/
├── src/                                 # CLI tool
│   ├── schema.ts                        # Zod frontmatter schema + types
│   ├── parser.ts                        # scan folders, parse frontmatter, build index
│   ├── config.ts                        # load + validate config.yaml
│   ├── commands/
│   │   ├── list.ts
│   │   ├── search.ts
│   │   └── open.ts
│   └── cli.ts                           # entry point
├── package.json                         # bin: { "cortex": "./src/cli.ts" }
├── biome.json
└── tsconfig.json
```

## Acceptance Criteria

- [x] Plugin at `plugins/cortex/` with plugin.json, 3 skills (frontmatter, research, brainstorm), and 3 commands
- [x] Repo at `~/code/my-agent-cortex/` scaffolded from bun-typescript-starter
- [x] Frontmatter schema as Zod types in `src/schema.ts`
- [x] `config.yaml` with Nathan's actual source paths and viewer
- [x] Parser scans configured folders, parses frontmatter via gray-matter, builds in-memory index
- [x] CLI: `cortex list` with `--type`, `--tags`, `--project`, `--status`, `--json`
- [x] CLI: `cortex search "query"` with substring match across frontmatter + body
- [x] CLI: `cortex open "identifier"` resolves by filename stem, opens in configured viewer
- [x] `/cortex:research` checks cortex first, then does new research and saves with correct frontmatter
- [x] `/cortex:add` captures existing conversation research as a cortex doc
- [x] `/cortex:brainstorm` checks cortex for existing research, then runs brainstorm, saves output
- [x] 3+ sample docs in the system
- [ ] Ship criteria: Nathan uses cortex daily

## MVP Details

### Plugin manifest (`plugins/cortex/.claude-plugin/plugin.json`)

```json
{
  "name": "cortex",
  "description": "Agent-native knowledge system. Research topics and capture findings as structured markdown documents with YAML frontmatter.",
  "version": "0.1.0",
  "author": { "name": "Nathan Vale" },
  "repository": "https://github.com/nathanvale/my-agent-cortex",
  "keywords": ["knowledge", "research", "second-brain", "frontmatter", "cortex"],
  "license": "MIT",
  "skills": ["./skills/cortex-frontmatter", "./skills/research", "./skills/brainstorm"],
  "commands": [
    "./commands/research.md",
    "./commands/add.md",
    "./commands/brainstorm.md"
  ]
}
```

### The "check cortex first" pattern

Every skill's first move is to check the cortex for existing knowledge on the topic. This is the compounding effect -- the more you use the system, the more context every future session starts with.

```
1. User invokes skill with a topic
2. Skill runs `cortex search "<topic>" --json` (or greps the docs/ folders directly)
3. If related docs found: "I found 3 existing docs on this topic. Let me build on what we already know."
4. Skill reads the relevant docs and uses them as context
5. Then proceeds with its own work (research, brainstorm, etc.)
```

### Agent-CLI design patterns

The cortex CLI serves three audiences simultaneously: humans in a terminal, developers debugging, and AI agents calling it as a subprocess. The design follows the **Agent-Hint Observability** pattern (see [pattern-agent-hint-observability.md](/Users/nathanvale/code/my-agent-dojo/.claude/references/proposed-patterns/pattern-agent-hint-observability.md)) with the **LogTape CLI Observability spec** (see [logtape-cli-observability-spec.md](/Users/nathanvale/code/side-quest-word-on-the-street/docs/research/logtape-cli-observability-spec.md)) as the reference implementation.

**Three output tiers:**

| Tier | Channel | Content | Controlled by |
|------|---------|---------|---------------|
| Program output | `stdout` | JSON envelopes, tables, markdown | `--json`, `--jsonl`, `--fields` |
| Diagnostics | `stderr` | Progress, debug, warnings | `--verbose`, `--debug`, `--quiet` |
| Side-channel | files | Rotating logs, telemetry | Future (Stage 1+) |

**stdout is sacred** -- never mix log messages into stdout. This lets `cortex search "auth" --json | jq .` work while debug logs appear on stderr.

**Tri-modal program output:**
- **TTY (default)**: Human-readable table/prose
- **Piped / `--json`**: JSON envelope on stdout
- **`--jsonl`**: JSON Lines stream (one object per line)
- **Auto-detect**: When `!process.stdout.isTTY`, auto-switch to JSON. Agents never need to pass `--json`.

**Typed exit codes:**

| Code | Meaning | Agent action |
|------|---------|-------------|
| 0 | Success | Continue |
| 1 | General error | Escalate |
| 2 | Invalid arguments | Fix args |
| 3 | Config error | Check config |
| 4 | Not found | Try different query |
| 130 | Interrupted (SIGINT) | Retry or abort |

Agents branch on exit code, never parse stderr.

**Error-action contract (agent hints):**

Every JSON error includes machine-readable fields so agents know what to do next without parsing prose:

```json
{
  "status": "error",
  "message": "Config file not found",
  "error": {
    "code": "E_CONFIG",
    "action": "CHECK_CONFIG",
    "retryable": false
  }
}
```

**Field projection:**

`--fields title,created,path` reduces output to only requested fields. 6-7x token reduction for agent consumption. Critical for keeping MCP tool responses lean in Stage 1.

**Structured logging (LogTape):**

LogTape for diagnostics on stderr. Silent no-op by default (library-first). Auto-switches format:
- TTY stderr: human-readable with ANSI colors
- Piped stderr: JSON Lines (machine-parseable)
- `--debug`: full structured trace
- `--quiet`: errors only

Logger category hierarchy for per-module debug:
```
cortex              # root
├── cortex.cli      # arg parsing, entry/exit
├── cortex.config   # config loading, path resolution
├── cortex.parser   # file scanning, frontmatter parsing
└── cortex.search   # search, filtering, ranking
```

### `/cortex:research` command

Research a topic and save the findings.

**Skill behavior:**
1. Confirms topic and project context with the user
2. **Checks cortex** for existing research on this topic -- summarizes what's already known
3. Dispatches new research (beat-reporter agents, web search, codebase exploration)
4. Synthesizes findings (building on existing cortex knowledge) using the `cortex-frontmatter` skill for correct doc structure
5. Writes the doc to the appropriate location (project docs/ or my-agent-cortex/docs/)
6. Confirms: "Research saved to `<path>`."

### `/cortex:add` command

Capture research that already happened in the current conversation.

**Skill behavior:**
1. Reviews the conversation context for research findings, key decisions, sources
2. Asks user to confirm: topic, project, tags
3. Synthesizes conversation findings using the `cortex-frontmatter` skill for correct doc structure
4. Writes the doc to the appropriate location
5. Confirms: "Captured to `<path>`."

This is the "I just spent 30 minutes researching, save this before it disappears" flow.

### `/cortex:brainstorm` command

Brainstorm an idea, building on existing cortex knowledge.

**Skill behavior:**
1. Confirms the idea/topic with the user
2. **Checks cortex** for existing research, prior brainstorms, related decisions on this topic
3. Presents what's already known: "Found 2 research docs and 1 prior brainstorm on this. Here's what we already know..."
4. Runs brainstorming session (questions, approaches, trade-offs) -- building on existing knowledge rather than starting from scratch
5. Writes the brainstorm doc using the `cortex-frontmatter` skill for correct doc structure
6. Confirms: "Brainstorm saved to `<path>`. Next step: `/cortex:plan` when you're ready."

### Skill SKILL.md files

**Cortex Frontmatter (router skill):**
```yaml
---
name: cortex-frontmatter
description: Knows the frontmatter contract for all Cortex knowledge systems. Routes to the correct base fields + system-specific extras when writing docs. Other skills delegate to this skill for doc creation.
---
```

The frontmatter skill owns all knowledge about doc structure. No template files, no system.yaml -- the skill IS the template router.

**Base frontmatter (all systems):**
```yaml
created: YYYY-MM-DD        # required
title: "..."               # required
type: research | brainstorm | plan | meeting | decision | ...
tags: [...]                # lowercase, no spaces
project: my-project        # kebab-case
status: draft | reviewed | final | archived
```

**System-specific extras:**

| System | Extra fields | When used |
|--------|-------------|-----------|
| `default` | (none -- base fields are sufficient) | Engineering repos, project docs |
| `para` | `para: project \| area \| resource \| archive` | Personal organization, global docs |

The skill also knows section structure per doc type (e.g. research docs get Summary/Key Findings/Sources/Open Questions, brainstorms get Context/Questions/Approaches/Decision).

**Research (workflow skill):**
```yaml
---
name: producing-research-documents
description: Produces structured research documents with YAML frontmatter into the Cortex knowledge system. Checks existing cortex knowledge before going external. Delegates to cortex-frontmatter skill for doc structure. Use when the user asks to research a topic, investigate something, or create a research note.
---
```

**Brainstorm (workflow skill):**
```yaml
---
name: brainstorming-with-cortex
description: Runs brainstorming sessions that build on existing Cortex knowledge. Checks for prior research and brainstorms before exploring. Delegates to cortex-frontmatter skill for doc structure. Use when the user wants to brainstorm, explore ideas, or think through an approach.
---
```

### Frontmatter schema (`src/schema.ts`)

The core contract is minimal. Only `created` is truly required. Everything else is freeform.

```typescript
// Core (required for all systems)
created: string        // YYYY-MM-DD

// Common optional fields (used by most systems)
title?: string         // human-readable (falls back to filename stem)
type?: string          // research, brainstorm, plan, meeting, decision, etc.
tags?: string[]        // lowercase, no spaces
project?: string       // kebab-case project identifier
status?: string        // draft, reviewed, final, archived
updated?: string       // YYYY-MM-DD

// System-specific fields are freeform
[key: string]: unknown // e.g. para: "project" for PARA system
```

Case-insensitive matching on filters. Warn to stderr for malformed frontmatter, still index with available fields. The CLI filters with shortcuts: `--type`, `--status`, `--tags`, `--project`.

### Config (`config.yaml`)

```yaml
sources:
  - path: ./docs                         # shared docs in this repo
    scope: global                        # always searched
  - path: ~/code/*/docs                  # auto-discover project docs
    scope: project                       # only searched when in that project

viewer: open -a "Marked 2"              # %s replaced with file path
```

**Scoping:** Default search is project + global. `--scope team` or `--all` to widen. This prevents noise from other teams' unrelated research while still allowing the "show me everything" view.

Recursive scan within matched directories. Ignore `.git/`, `.obsidian/`, `node_modules/`. Non-existent paths warn to stderr, skip gracefully. The `cortex-frontmatter` skill handles system selection (default vs PARA) based on context, not config.

### CLI commands

Entry point uses `util.parseArgs` (built-in, zero deps).

**`cortex list`**
- Flags: `--type`, `--tags` (comma-separated, OR semantics), `--project`, `--status`, `--json`
- Default: table with `type | status | project | title | created | path`
- Sort: `created` descending

**`cortex search "query"`**
- Substring match (case-insensitive) across title, tags, project, type, body
- Flags: `--json`, `--limit N` (default 20), `--scope` (project|team|all, default: project+global), `--all`

**`cortex open "identifier"`**
- Resolve by filename stem (exact first, then substring)
- Zero matches: error with suggestions
- Multiple matches: list them, ask to be more specific

### Dependencies

| Package | Purpose |
|---------|---------|
| `gray-matter` | YAML frontmatter parsing |
| `zod` | Schema validation |
| `@logtape/logtape` | Structured logging (zero-dep, 5.3 KB, silent no-op by default) |

CLI: `util.parseArgs` (built-in). No file watching for MVP.

### Implementation Order

**Plugin (in my-agent-cortex repo):**
1. Create `plugins/cortex/` directory structure
2. Write `.claude-plugin/plugin.json`
3. Write `skills/cortex-frontmatter/SKILL.md` (router: base fields, default system, PARA system, section structures per doc type)
4. Write `skills/research/SKILL.md` (workflow: check cortex, dispatch research, delegate to frontmatter skill for writing)
5. Write `skills/brainstorm/SKILL.md` (workflow: check cortex, brainstorm, delegate to frontmatter skill for writing)
6. Write `commands/research.md` (do new research)
7. Write `commands/add.md` (capture existing research)
8. Write `commands/brainstorm.md` (brainstorm with cortex context)

**Repo (my-agent-cortex):**
9. Scaffold from bun-typescript-starter at `~/code/my-agent-cortex/`
10. Create `docs/` with subdirs (`research/`, `brainstorms/`, `meetings/`)
11. Write `config.yaml` with Nathan's actual paths
12. `src/schema.ts` -- core Zod types
13. `src/config.ts` -- load + validate config.yaml
14. `src/parser.ts` -- scan + parse + index (gray-matter + Bun.glob)
15. `src/commands/list.ts`
16. `src/commands/search.ts`
17. `src/commands/open.ts`
18. `src/cli.ts` -- entry point + routing
19. Add `"bin": { "cortex": "./src/cli.ts" }` to package.json + `bun link`

**Verify:**
20. Create 3+ docs using `/cortex:research`, `/cortex:add`, and `/cortex:brainstorm`
21. Run all verification steps

## Verification

1. `/cortex:research "YAML frontmatter best practices"` -- checks cortex first, then researches, saves doc
2. `/cortex:add` (after a research conversation) -- captures findings as a cortex doc
3. `/cortex:brainstorm "new CLI tool"` -- finds existing research, uses it as context for brainstorm
4. `cortex list` -- shows docs in a table
5. `cortex list --type research --json` -- filtered JSON output
6. `cortex search "frontmatter"` -- finds relevant docs across all sources
7. `cortex open "yaml-frontmatter"` -- opens in Marked 2
8. Add a frontmattered .md to any `~/code/*/docs/` -- `cortex list` discovers it
9. `cortex list --project my-agent-dojo` -- shows only that project's docs
10. Verify compounding: run `/cortex:brainstorm` on a topic with existing research -- it should reference prior findings

## Deferred to Later Stages

These features exist in the brainstorm roadmap (see `docs/brainstorms/2026-02-27-cortex-brainstorm.md` in my-agent-dojo) but are explicitly out of scope for Stage 0. Nothing is deleted -- it's all captured in the brainstorm.

| Feature | Brainstorm stage | Why deferred |
|---------|-----------------|--------------|
| `system.yaml` config files | Stage 4+ (custom systems) | Skill-based routing is simpler for 2 built-in systems. File-based config needed when users create their own systems (GTD, Zettelkasten, custom). |
| Template files (`templates/*.md`) | Stage 4+ (custom systems) | Skills write docs directly in Stage 0. Template files needed when non-skill tooling (e.g. `cortex init`) creates docs. |
| Per-source `system` field in config.yaml | Stage 4+ (custom systems) | The `cortex-frontmatter` skill handles system selection based on context. Config-driven system selection needed when there are many sources with different systems. |
| Custom systems (GTD, Zettelkasten, user-defined) | Stage 4+ (Polish + Package) | Two built-in systems (default, PARA) are enough for dogfooding. |
| MCP server (`cortex_list`, `cortex_search`, `cortex_read`) | Stage 1 (week 2-3) | CLI-first for Stage 0. MCP enables any AI agent to query knowledge. |
| File watching (`fs.watch` for live index updates) | Stage 1 (week 2-3) | Re-scan on every CLI invocation is fine for <100 docs. |
| `/plan` skill | Stage 2 (Document Pipeline) | Research -> brainstorm pipeline first, plan skill adds the third leg. |
| `/meeting` and `/decision` skills | Stage 2 (Document Pipeline) | The `cortex-frontmatter` skill knows these doc types, but no dedicated workflow skills yet. |
| Multi-repo awareness (`cortex status`) | Stage 3 (week 4-5) | Cross-project queries work via glob config, but no status dashboard. |
| `cortex init` command | Stage 4 (Polish + Package) | Manual setup is fine for one user. |
| Team features (shared repos, per-user config) | Stage 5 (month 2) | Solo dogfood first. |
| Agentic execution (plan -> DAG -> agents) | Stage 6 (month 2-3) | Knowledge system must be solid before execution engine. |

## Sources

- **Origin brainstorm:** [my-agent-dojo/docs/brainstorms/2026-02-27-cortex-brainstorm.md](/Users/nathanvale/code/my-agent-dojo/docs/brainstorms/2026-02-27-cortex-brainstorm.md)
- **Agent-Hint Observability pattern (gold standard):** [pattern-agent-hint-observability.md](/Users/nathanvale/code/my-agent-dojo/.claude/references/proposed-patterns/pattern-agent-hint-observability.md) -- tri-modal output, error-action contract, typed exit codes, LogTape integration
- **LogTape CLI Observability spec (reference implementation):** [logtape-cli-observability-spec.md](/Users/nathanvale/code/side-quest-word-on-the-street/docs/research/logtape-cli-observability-spec.md) -- three output tiers, sink selection, logger hierarchy, AI agent diagnostics
- **Plugin pattern reference:** `~/.claude/plugins/marketplaces/side-quest/plugins/git/` -- plugin.json, skills/, commands/
- **Compound engineering:** `~/.claude/plugins/cache/every-marketplace/compound-engineering/2.35.2/`
- **gray-matter:** https://github.com/jonschlinkert/gray-matter
- **LogTape:** https://logtape.org/
