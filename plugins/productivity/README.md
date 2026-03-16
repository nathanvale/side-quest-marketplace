# Productivity Plugin

Ported from Anthropic's Cowork `knowledge-work-plugins/productivity` v1.1.0 (Apache 2.0) to work with Claude Code CLI via side-quest-marketplace. Works in both Claude Code CLI (local) and Cowork (VM).

Task management, workplace memory, and a visual dashboard -- Claude learns your people, projects, and terminology so it can act like a colleague, not a chatbot.

## Installation

```
claude plugin add side-quest-marketplace/productivity
```

## What It Does

- **Task management** -- A markdown task list (`TASKS.md`) that Claude reads, writes, and executes against. Add tasks naturally, and Claude tracks status, triages stale items, and syncs with external tools.
- **Workplace memory** -- A two-tier memory system that teaches Claude your shorthand, people, projects, and terminology. Say "ask todd to do the PSR for oracle" and Claude knows exactly who, what, and which deal.
- **Visual dashboard** -- A local HTML file that gives you a board view of your tasks and a live view of what Claude knows about your workplace. Edit from the board or the file -- they stay in sync.

## Memory OS Integration

When used in Nathan's setup, this plugin should operate inside the shared user-scope Memory OS rather than as a separate parallel system.

- Shared contract: `~/.config/memory/AGENTS.md`
- Shared integration guide: `~/.config/memory/docs/productivity-integration.md`
- External connectors remain tool-agnostic and keep working through the existing category mapping
- Repo ownership still matters: keep local work memory and task churn in the owning repo, promote only durable knowledge into `my-second-brain`

## Commands

| Command | What it does |
|---------|--------------|
| `/start` | Initialize tasks + memory, open the dashboard |
| `/update` | Sync from calendar, email, and project trackers, triage stale items, decode tasks, fill memory gaps |
| `/update --deep` | Everything in default, plus deep scan of chat, sent email, docs -- flag missed todos and suggest new memories |

## Skills

| Skill | Description |
|-------|-------------|
| `memory-management` | Two-tier memory system -- CLAUDE.md for working memory, memory/ directory for deep storage |
| `task-management` | Markdown-based task tracking using a shared TASKS.md file |
| `connectors` | Tool routing reference for external data sources (auto-discovered by Claude, not user-invocable) |

## Data Sources

All external sources are optional. If a tool isn't connected, the plugin skips it gracefully and works with what's available. Connect your tools for the best experience, or manage tasks and memory manually.

**Supported sources:**
- Calendar (Google Calendar, Microsoft 365) -- meeting sync, attendee discovery
- Email (Gmail, Microsoft 365) -- action item discovery, commitment tracking
- Project tracker (Jira, Asana, Linear, GitHub Issues, monday.com, ClickUp) -- task syncing
- Knowledge base (Notion, Confluence) -- reference documents
- Chat (Slack) -- deep scan only (`--deep` mode)

See [CONNECTORS.md](CONNECTORS.md) for the full category reference.

## Origin

Original plugin by Anthropic, distributed under Apache License 2.0. See [LICENSE](LICENSE) for terms.
