---
date: 2026-02-27
topic: cortex-second-brain
---

# Cortex -- Agent-Native Knowledge System

## What We're Building

Cortex is a knowledge system that replaces Obsidian/second-brain apps with plain markdown files, YAML frontmatter, and an MCP server. The intelligence layer is the agent, not the app.

The core insight: you don't need a GUI knowledge app when you're already talking to an agent that can search, read, and synthesize across documents. Obsidian's value was search + connections + templates -- an MCP server + skills give you all of that, plus the agent can produce and consume the documents.

## The Problem

- Research, brainstorms, plans, decisions, meeting notes are scattered across repos or trapped in apps
- No unified way for an agent to query your knowledge across projects
- Obsidian/Notion create lock-in and add complexity (plugins, sync, databases)
- When working across 5+ repos, there's no holistic view of what you're working on
- The research -> brainstorm -> plan pipeline has no standard tooling

## Architecture

### Two-layer structure

| Layer | Location | Purpose |
|-------|----------|---------|
| Shared/Global | `~/cortex/docs/` | Cross-project knowledge: meetings, general research, standards, team knowledge |
| Project | `~/code/<project>/docs/` | Project-specific: plans, decisions, TODOs, project research |

This mirrors Claude Code's memory model:
- `~/.claude/CLAUDE.md` = user-level shared context
- `.claude/CLAUDE.md` = project-level context
- Cortex = same pattern, but for **documents**

### Repo structure (the cortex repo)

```
~/cortex/
├── config.yaml              # source registry (glob patterns)
├── docs/                    # shared/global docs
│   ├── research/
│   ├── meetings/
│   └── standards/
├── src/                     # MCP server + CLI
│   └── index.ts
└── package.json
```

### Source discovery

```yaml
# config.yaml
sources:
  - path: ./docs              # shared docs in this repo
    scope: global
  - path: ~/code/*/docs       # auto-discover project docs
    scope: project
```

Glob pattern means zero config when starting a new project. Just `mkdir docs` in any repo under `~/code/` and Cortex picks it up.

### Frontmatter schema (unified across all sources)

```yaml
---
type: research | brainstorm | plan | meeting | decision | reference
status: draft | reviewed | final
project: my-agent-dojo       # null for shared/personal docs
tags: [mcp, skills, architecture]
created: 2026-02-27
---
```

The `type` field is what makes the pipeline work -- skills can query "give me all research tagged X" before brainstorming.

## Three interfaces

### 1. MCP server (`@side-quest/cortex`)

Any AI tool (Claude Code, Claude Desktop, Cursor) can query knowledge:
- `cortex_list` -- filter by type, tags, status, project, date range
- `cortex_search` -- full-text + frontmatter search
- `cortex_read` -- return full document for agent synthesis
- `cortex_open` -- open in configured viewer (Marked 2, VS Code, Obsidian)

### 2. CLI (`cortex`)

For when you're not in an agent context:
- `cortex list --type research --tag mcp`
- `cortex search "skill authoring"`
- `cortex open "mcp-tools"`

### 3. Skills (slash commands)

Skills that produce documents into the system:
- `/research` -- produces research docs with consistent frontmatter
- `/brainstorm` -- consumes research, produces brainstorm docs
- `/plan` -- consumes brainstorms, produces plan docs
- `/meeting` -- produces meeting notes
- `/decision` -- produces ADR-style decision records

## How indexing works

No database. No SQLite. In-memory index built on startup:

1. Scan configured folders
2. Parse YAML frontmatter from each .md file
3. Build in-memory index
4. Watch filesystem for changes, update incrementally

Source of truth is always the markdown files. Index is ephemeral -- crash and rebuild in milliseconds.

## The Bigger Vision -- Three Waves of Engineering

Cortex is the entry point to a larger story about how organisations adopt agentic workflows:

### Wave 1: Prompt Engineering (where most orgs are today)
"How do I talk to the AI?" -- writing better prompts, CLAUDE.md files, basic agent usage.

### Wave 2: Context Engineering (where Cortex starts)
"How do I give the AI the right knowledge?" -- structured documents, frontmatter schemas, MCP servers that surface relevant context. Cortex is the product here.

### Wave 3: Intent Engineering (where Cortex leads)
"How do I wire the AI into our entire organisation?" -- what MCP tools do we need? What memory systems? How do we connect to all our services (Jira, Confluence, Slack, internal APIs)? The intent is: the org declares what it wants to achieve, and the agent infrastructure makes it happen.

Cortex grows with the customer through all three waves. It starts as a simple knowledge tool and becomes the connective tissue for the whole agentic stack.

## Enterprise Angle

For individuals: shared docs = personal knowledge (meetings, journal, cross-project research)
For orgs: shared docs = team knowledge (onboarding, standards, architectural decisions)

Same architecture, different access model. The pitch: "You already have CLAUDE.md files across repos. Cortex is the same pattern for your team's knowledge -- indexed by an MCP server so any agent can find it."

## Roadmap -- Incremental Stages

Each stage is a usable product. Each builds on the last. No stage requires the next to be valuable.

### Stage 0: Dogfood (week 1)
**Goal:** Nathan uses it daily. Prove the concept works.
- Frontmatter schema definition (type, status, project, tags, created)
- Single script that parses frontmatter from a folder of .md files
- Basic CLI: `cortex list`, `cortex search`, `cortex open`
- One skill: `/research` that produces a doc with correct frontmatter
- Manual setup: `~/cortex/` repo with `docs/` folder
- **Ship criteria:** Nathan has 10+ docs in the system and uses it daily

### Stage 1: MCP Server (week 2-3)
**Goal:** Any AI agent can query your knowledge.
- MCP server with `cortex_list`, `cortex_search`, `cortex_read`, `cortex_open`
- Config file with glob patterns for source discovery
- In-memory index with fs.watch for live updates
- Works in Claude Code, Claude Desktop, Cursor
- **Ship criteria:** "What did I research about X?" works from any agent

### Stage 2: Document Pipeline (week 3-4)
**Goal:** Research -> brainstorm -> plan pipeline works end-to-end.
- `/brainstorm` skill that discovers related research via Cortex MCP
- `/plan` skill that discovers related brainstorms
- `/meeting` and `/decision` skills
- Pipeline handoff: each skill queries Cortex for prior documents on the topic
- **Ship criteria:** Full pipeline from research to plan with automatic context

### Stage 3: Multi-Repo Awareness (week 4-5)
**Goal:** Cross-project visibility.
- Auto-discovery of `docs/` folders across `~/code/*/`
- Project-level filtering: "what am I working on across all repos?"
- Status dashboard: "show me all in-progress plans"
- CLI improvements: `cortex status` (cross-project overview)
- **Ship criteria:** "What's the status of all my projects?" returns useful answer

### Stage 4: Polish + Package (week 5-6)
**Goal:** Someone else can install and use it.
- npm package: `@side-quest/cortex`
- `cortex init` command (creates ~/cortex/ repo, config, first doc)
- Documentation and README
- Configurable viewer (Marked 2, VS Code, Obsidian, etc.)
- Published MCP server config for easy installation
- **Ship criteria:** A developer can `npx cortex init` and be productive in 5 minutes

### Stage 5: Team Features (month 2)
**Goal:** Works for a small team.
- Shared cortex repo (team knowledge base)
- Per-user + team source configuration
- Git-based collaboration (PRs for shared docs, personal repos for private)
- Onboarding docs: "how to set up Cortex for our team"
- **Ship criteria:** A 3-5 person team uses it for 2 weeks and finds value

### Stage 6: Agentic Execution Engine (month 2-3)
**Goal:** Cortex powers the full build cycle, not just knowledge.

This is where Cortex goes from "knowledge system" to "engineering operating system." The plan documents from Stage 2 become executable. Agents don't just read your knowledge -- they use it to build, validate, and learn.

**Decomposition + Orchestration:**
- Plan -> DAG decomposition (break plans into tasks with dependencies)
- Wave composition (parallelise independent tasks, sequence dependent ones)
- Multi-agent dispatch: Builder agents execute, Validator agents verify
- MCP tool orchestration: agents call the right tools for each task

**Iterative Quality Loops:**
- Builder/Validator pattern: build -> validate -> fix -> validate
- Figma design loops: agent-browser screenshots -> compare to design -> iterate until pixel-match
- Test loops: write test -> run -> fix -> run until green
- Ralph Wiggin loops (the "I'm in danger" pattern): agent recognises it's stuck, escalates or tries a different approach

**Compounding Knowledge (the flywheel):**
- Gotchas captured automatically: when a build fails, the fix + context gets stored as a Cortex doc
- Pattern library grows organically: "last time we did X, here's what worked"
- Mistakes become guardrails: agent checks Cortex for known pitfalls before executing
- Per-project and cross-project: "this footgun exists in all Next.js repos" vs "this is specific to our auth setup"
- The more the team uses it, the smarter every future agent session becomes

**New document types:**
- `type: gotcha` -- "we tried X, it broke because Y, the fix was Z"
- `type: pattern` -- "when doing X, always do Y" (earned through experience, not prescribed)
- `type: postmortem` -- "what went wrong, what we learned, what changed"

**The compounding effect:** An org that's been using Cortex for 6 months has hundreds of gotchas, patterns, and postmortems. A new developer's agent sessions are immediately informed by everything the team has learned. This is the moat -- it gets more valuable the longer you use it, and you can't replicate it by switching tools.

- **Ship criteria:** A plan document can be decomposed into a DAG, executed by agents, and the learnings feed back into Cortex automatically

### Stage 7: Context Engineering Consulting (month 3-4)
**Goal:** Offer as a service to organisations.
- Assessment framework: "what knowledge exists, where, in what format?"
- Migration tooling: import from Obsidian, Notion, Confluence
- CLAUDE.md + Cortex setup playbook for teams
- Frontmatter schema customisation per org
- Training materials: "context engineering for your team"
- Cortex + Stage 6 execution engine as the flagship demo
- **Ship criteria:** First paying client engagement

### Stage 8: Intent Engineering Platform (month 4+)
**Goal:** Cortex becomes the hub for org-wide agentic infrastructure.
- MCP tool registry: what tools does this org have? What do they connect to?
- Memory layer: cross-session, cross-agent shared memory
- Service connectors: Jira, Confluence, Slack, internal APIs
- Intent templates: "I want my agents to be able to do X" -> generates the MCP config, skills, and docs
- Audit trail: who asked what, what knowledge was used, what decisions were made
- Cortex's compounding knowledge makes intent resolution smarter over time
- **Ship criteria:** An org can declare intent and Cortex configures the agent infrastructure

## The "Check Cortex First" Pattern

Every skill's first move is to check the cortex for existing knowledge on the topic. This is what makes knowledge compound.

```
1. User invokes skill with a topic
2. Skill searches cortex for existing docs on this topic
3. If found: "I found 3 existing docs on this. Let me build on what we already know."
4. Skill reads relevant docs and uses them as context
5. Proceeds with its own work (research, brainstorm, plan, etc.)
```

This means:
- `/cortex:research` checks what's already been researched before going external
- `/cortex:brainstorm` pulls in all existing research and prior brainstorms
- `/cortex:plan` pulls in brainstorms, research, and decisions

The more you use the system, the richer the context for every future session. For teams, this is transformative -- 5 engineers research separately, engineer #6 gets all prior findings automatically.

## The `/cortex:add` Command

Not all knowledge comes from structured research sessions. Often you've just spent 30 minutes discussing something with an agent and the findings are about to disappear into the transcript.

`/cortex:add` captures existing conversation knowledge as a cortex doc with proper frontmatter. It reviews the conversation, synthesizes findings, and asks where to save it.

## Per-Source Knowledge Systems

The frontmatter schema is flexible -- different sources can use different organizational systems. The system is configured per source in config.yaml:

```yaml
sources:
  - path: ./docs
    system: para                 # personal stuff uses PARA
  - path: ~/code/*/docs
    system: default              # engineering repos use research/brainstorm/plan
  - path: ~/work/team-docs
    system: gtd                  # this team uses GTD
```

Each system defines its own doc types, fields, folder structure, and templates. Built-in systems:

- **default** -- research, brainstorm, plan, meeting, decision pipeline
- **para** -- Projects, Areas, Resources, Archives
- **gtd** -- Next Actions, Projects, Waiting For, Reference, Someday/Maybe
- **zettelkasten** -- Permanent Notes, Literature Notes, Fleeting Notes

Custom systems are just a `system.yaml` + template files.

### System-Agnostic Indexing

The index doesn't care about systems. It indexes ALL frontmatter key-value pairs from ALL documents. Search and filters work across systems:

- `cortex search "auth"` finds PARA projects, default research docs, and GTD next-actions alike
- `--filter "key=value"` works on any frontmatter field
- `--type`, `--status`, `--tags` are just shortcuts for common fields

Systems only matter when WRITING docs (which template to use, which folder to put it in). The read/query layer is completely system-agnostic.

### Flexible Frontmatter Core Contract

All fields are optional to support best-effort indexing of external docs. `created` and `title` are encouraged for discoverability:

```yaml
---
created: YYYY-MM-DD         # encouraged for sorting/filtering
title: "..."                # optional, falls back to filename
tags: [...]                 # optional
project: "..."              # optional
# ... any other fields the system defines
---
```

## Doc Placement

When a skill produces a document, it asks where to put it:

```
Is this for:
  > This project (~/code/my-app/docs/)
  > The team (~/work/team-cortex/docs/)
  > Personal (~/code/my-agent-cortex/docs/)
```

The skill then uses the target source's system to determine the right template and folder structure.

## Enterprise Visibility

A CTO or engineering manager configures their cortex to index across all team repos:

```yaml
sources:
  - path: ~/code/*/docs
    system: default
  - path: ~/work/team-*/docs
    system: default
```

They see every brainstorm, research doc, decision, and gotcha across the entire org. Teams don't do anything extra -- they just use cortex normally. The visibility is a config change.

The progression:
1. **Individual**: "I don't lose my research anymore"
2. **Team**: "We don't duplicate each other's research anymore"
3. **Org**: "Every agent session starts with everything the company has ever learned about this topic"

## Obsidian as Read-Only Viewer

Obsidian can still be used as a browse-only viewer for the cortex. Open `~/code/my-agent-cortex/docs/` (or any source) as a vault with the "Enhanced Read Mode Control" plugin set to strict on the root folder. You get search, graph view, and reading view -- but can't edit. The agent and skills are the only writers.

But Obsidian is just one option. `cortex open` works with any viewer: Marked 2, VS Code preview, or anything that opens markdown files.

## Branding

Cortex is its own brand, not part of side-quest. The repo `my-agent-cortex` is its own Claude Code marketplace (like how `every-marketplace` contains `compound-engineering`). When installed, it clones to `~/.claude/plugins/marketplaces/my-agent-cortex/`.

## Key Decisions So Far

- **Centralized + distributed hybrid**: shared docs in ~/code/my-agent-cortex/docs/, project docs in each repo's docs/
- **Own marketplace**: my-agent-cortex is its own Claude Code marketplace, not inside side-quest
- **No database**: in-memory index from frontmatter, files are the source of truth
- **No app lock-in**: viewer is configurable (Obsidian read-only, Marked 2, VS Code, anything)
- **Auto-discovery**: glob patterns in config, zero setup for new projects
- **Per-source systems**: PARA, GTD, Zettelkasten, default -- configurable per source
- **System-agnostic index**: searches across all systems regardless of doc type
- **Flexible frontmatter**: only `created` required, everything else system-defined
- **Check cortex first**: every skill checks existing knowledge before going external
- **Name**: Cortex
- **Incremental delivery**: each stage is independently valuable
- **Three waves**: prompt engineering -> context engineering -> intent engineering

## Resolved Questions

- **CLI framework**: `util.parseArgs` (built-in, zero deps) -- upgrade to citty if >5 commands
- **Repo location**: own marketplace at `~/code/my-agent-cortex/` (not side-quest)
- **Frontmatter parsing**: gray-matter (industry standard, fast)
- **File watching**: fs.watch with recursive:true on macOS (Stage 1+, not Stage 0)
- **MCP server**: @modelcontextprotocol/sdk with side-quest-core MCP Easy wrapper (Stage 1)

## Search Scoping -- Up, Not Across

When you're working in a project, you want cortex to search UP the hierarchy (project -> global), not ACROSS into other teams' unrelated work.

**Default search hierarchy:**
```
1. Current project docs    ← most relevant, search first
2. Shared/global docs      ← your cross-project knowledge
--- default scope stops here ---
3. Team docs               ← only with --scope team
4. Org-wide docs           ← only with --all
```

**Config uses a `scope` field per source:**
```yaml
sources:
  - path: ./docs
    system: default
    scope: project               # searched when in this project
  - path: ~/code/my-agent-cortex/docs
    system: para
    scope: global                # always searched
  - path: ~/code/*/docs
    system: default
    scope: project               # each repo's docs scoped to that project
  - path: ~/work/team-cortex/docs
    system: default
    scope: team                  # opt-in with --scope team
```

**CLI/skill scope flags:**
```
cortex search "auth"                    # project + global (default)
cortex search "auth" --scope team       # + team docs
cortex search "auth" --all              # everything, everywhere
```

This is critical for enterprise -- a backend team's deep research on database sharding shouldn't pollute the frontend team's brainstorm about a new component. But the CTO can still `--all` to see everything.

The "check cortex first" pattern in skills uses the default scope (project + global). This keeps skill context focused and relevant.

### Document-Level Scope (Global vs Project)

Scope isn't just about WHERE the doc lives -- it's about the NATURE of the content:

- **Global knowledge**: best practices, tooling research, patterns, conventions. Any team benefits. "Cypress e2e testing best practices" is useful to everyone.
- **Project knowledge**: business domain, feature-specific decisions, product research. Only relevant to this team. "How our checkout flow handles partial refunds" is noise for everyone else.

The skill asks when saving:

```
Where should this research live?
  > This project only (business domain, feature-specific)
  > Global (best practices, tooling, patterns -- useful to all teams)
```

This maps to a frontmatter field:

```yaml
---
type: research
scope: global          # or: project
title: "Cypress e2e testing best practices"
---
```

A doc marked `scope: global` gets surfaced to anyone searching, even if it physically lives in a project repo. A doc marked `scope: project` stays local even if it's in a shared location.

This mirrors CLAUDE.md exactly:
- `~/.claude/CLAUDE.md` = global instructions = `scope: global` docs
- `.claude/CLAUDE.md` = project instructions = `scope: project` docs

Same mental model. People already understand this pattern.

## Enterprise Adapters (Future)

Because everything is markdown with frontmatter, Cortex can have adapters that sync to enterprise platforms. The markdown is the source of truth, and adapters push/pull to wherever the org already lives.

**Examples:**

| Adapter | Sync Target | How |
|---------|-------------|-----|
| **SharePoint** | Microsoft 365 / SharePoint document libraries | SharePoint Graph API. Markdown renders natively in SharePoint. Permissions via SharePoint's existing ACL model. Teams that live in Microsoft get cortex knowledge surfaced where they already work. |
| **Confluence** | Atlassian Confluence spaces | Confluence REST API. Convert markdown to Confluence storage format. Teams using Jira/Confluence see cortex docs as Confluence pages. |
| **Notion** | Notion databases/pages | Notion API. Frontmatter fields map to Notion database properties. |
| **Google Docs** | Google Workspace | Google Docs API. For orgs living in Google Workspace. |
| **GitBook** | GitBook spaces | Git-based sync (GitBook already reads markdown from repos). |

**The key insight:** Cortex doesn't replace the enterprise platform. It's the agent-native layer that PRODUCES knowledge, and adapters distribute it to wherever humans browse. Engineers write with cortex skills, managers read in SharePoint/Confluence/Notion.

**Permissions:** Each adapter inherits the target platform's permission model. SharePoint handles who can see what. Confluence handles space permissions. Cortex doesn't need its own permission system -- it delegates to the platforms that already have it.

**Bidirectional sync (future):** Could also PULL from enterprise platforms into cortex. A Confluence page written by a non-technical team member gets indexed by cortex so agents can find it. The markdown files become a cached, agent-readable mirror of org knowledge regardless of where it was originally authored.

This is a Stage 7-8 feature but it's a massive enterprise selling point: "Cortex works with your existing tools, not against them."

## Open Questions

- Pricing model for consulting (per-engagement, retainer, per-seat?)
- How to handle document versioning (git log per file? changelog frontmatter field?)
- Search: full-text vs semantic (embeddings) -- start with grep, add semantic later?
- How many built-in systems to ship at launch (default only? + PARA? + GTD?)
- Custom system authoring UX -- how easy should it be to create your own system?

## Next Steps

- Stage 0 plan written: see `docs/plans/` in my-agent-cortex (once created)
- Implement Stage 0: plugin + repo + CLI
- Dogfood for 1 week, accumulate 10+ docs
