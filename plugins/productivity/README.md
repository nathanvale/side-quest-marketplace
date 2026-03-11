# Productivity Plugin

Ported from Anthropic's Cowork `knowledge-work-plugins/productivity` v1.1.0 (Apache 2.0) to work with Claude Code CLI via side-quest-marketplace.

Task management, workplace memory, and a visual dashboard - Claude learns your people, projects, and terminology so it can act like a colleague, not a chatbot.

## Installation

```
claude plugin add side-quest-marketplace/productivity
```

## What It Does

- **Task management** - A markdown task list (`TASKS.md`) that Claude reads, writes, and executes against. Add tasks naturally, and Claude tracks status, triages stale items, and syncs with external tools.
- **Workplace memory** - A two-tier memory system that teaches Claude your shorthand, people, projects, and terminology. Say "ask todd to do the PSR for oracle" and Claude knows exactly who, what, and which deal.
- **Visual dashboard** - A local HTML file that gives you a board view of your tasks and a live view of what Claude knows about your workplace. Edit from the board or the file - they stay in sync.

## Commands

| Command | What it does |
|---------|--------------|
| `/start` | Initialize tasks + memory, open the dashboard |
| `/update` | Triage stale items, check memory for gaps, sync from external tools if applicable |
| `/update --comprehensive` | Deep scan email, calendar, chat - flag missed todos and suggest new memories |

## Skills

| Skill | Description |
|-------|-------------|
| `memory-management` | Two-tier memory system - CLAUDE.md for working memory, memory/ directory for deep storage |
| `task-management` | Markdown-based task tracking using a shared TASKS.md file |

## Data Sources

Connect your communication and project management tools for the best experience. Without them, manage tasks and memory manually.

**Included MCP connections:**
- Chat (Slack) for team context and message scanning
- Email and calendar (Microsoft 365) for action item discovery
- Knowledge base (Notion) for reference documents
- Project tracker (Asana, Linear, Atlassian, monday.com, ClickUp) for task syncing
- Office suite (Microsoft 365) for documents

See [CONNECTORS.md](CONNECTORS.md) for alternative tools in each category.

## Origin

Original plugin by Anthropic, distributed under Apache License 2.0. See [LICENSE](LICENSE) for terms.
