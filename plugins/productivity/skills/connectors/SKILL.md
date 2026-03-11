---
name: connectors
description: Tool routing reference for external data sources. Lists default MCP tools by category (calendar, email, project tracker, knowledge base) with example function names. Do not invoke directly -- this is a reference for other skills and commands.
user-invocable: false
---

# Connectors

Tool routing table for external data sources. Reference this skill when you need to know which MCP tools to call for calendar, email, project tracking, or knowledge base operations.

**Important:** Tool names below are defaults. Users may have different MCP servers connected. Always check tool availability before calling -- if a tool is not available, skip that source gracefully and note it in the report.

## Calendar

| Tool | What it does |
|------|-------------|
| `gcal_list_events` | List events in a date range |
| `gcal_get_event` | Get event details |
| `gcal_list_calendars` | List available calendars |
| `gcal_find_my_free_time` | Find free time slots |

**Common patterns:**
- Past 2 days + next 3 days for `/update` default sync
- Full week scan for `--deep` mode
- Extract attendees for memory cross-referencing

## Email

| Tool | What it does |
|------|-------------|
| `gmail_search_messages` | Search messages by query |
| `gmail_read_message` | Read a specific message |
| `gmail_read_thread` | Read full email thread |
| `gmail_list_labels` | List email labels/folders |

**Common patterns:**
- Unread inbox for `/update` default sync
- Sent messages for `--deep` mode (find commitments made)
- Search by sender/recipient for people context

## Project Trackers

| Tool | What it does |
|------|-------------|
| `searchJiraIssuesUsingJql` | Search Jira issues |
| `getJiraIssue` | Get issue details |
| `getVisibleJiraProjects` | List accessible projects |

**Other tracker options:** Asana, Linear, monday.com, ClickUp, GitHub Issues (`gh issue list --assignee=@me`).

**Common patterns:**
- Open/in-progress issues assigned to user
- Compare against TASKS.md for sync
- Flag items completed externally

## Knowledge Base

| Tool | What it does |
|------|-------------|
| `notion-search` | Search Notion pages |
| `notion-query-database-view` | Query a Notion database |

**Other options:** Confluence (`searchConfluenceUsingCql`), Google Drive, Obsidian.

**Common patterns:**
- Recently modified docs for `--deep` mode
- Project documentation lookup
- Meeting notes retrieval

## Chat

| Tool | What it does |
|------|-------------|
| Slack MCP tools | Search/read channels and DMs |

**Note:** Chat scanning is `--deep` mode only. Not included in default sync due to volume.

## Availability Check Pattern

Before calling any tool above, verify it exists:

```
1. Reference this table for the tool name
2. Attempt the call
3. If tool is unavailable, skip with: "Skipped [source] -- no [category] tools connected"
4. Continue to next source
```

Never fail the entire sync because one source is unavailable.
