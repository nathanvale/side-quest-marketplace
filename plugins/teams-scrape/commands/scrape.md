---
description: Scrape Microsoft Teams chat content to structured JSON
argument-hint: <target-name>
---

# Scrape Teams Chat

Extract chat messages from Microsoft Teams and return structured JSON.

## Usage

```
/teams-scrape:scrape Jay Pancholi
/teams-scrape:scrape "Project Alpha Channel"
```

## Instructions

This command uses the `teams-scrape` skill to:

1. **Navigate** to the specified chat/channel using Cmd+G
2. **Capture** content via Escape → Cmd+A → Cmd+C
3. **Parse** the clipboard text into structured JSON
4. **Return** messages with author, timestamp, content, reactions, replies

## Prerequisites

- Microsoft Teams desktop app must be running
- Accessibility permissions granted for automation
- `macos-automator` MCP server available

## Arguments

| Argument | Required | Description |
|----------|----------|-------------|
| `target-name` | Yes | Person name or channel to scrape |

## Output

Returns JSON with:
- `target`: The chat/channel name
- `capturedAt`: ISO 8601 timestamp
- `messageCount`: Number of messages
- `messages`: Array of parsed messages

## Examples

**Scrape DM:**
```
/teams-scrape:scrape Jay Pancholi
```

**Scrape channel:**
```
/teams-scrape:scrape "Engineering Standup"
```

## See Also

- Full workflow documentation: `skills/teams-scrape/SKILL.md`
- Teams clipboard format reference in the skill documentation
