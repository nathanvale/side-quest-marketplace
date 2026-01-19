---
name: teams-scrape
description: Use when extracting Microsoft Teams chat messages - navigates Teams, captures clipboard, and parses to JSON using macOS automation
version: 1.0.0
---

# Teams Chat Scraper

Extract chat messages from Microsoft Teams desktop app using `macos-automator` MCP tools.

## When to Use

Invoke this skill when you need to:
- Extract chat history from a Teams DM or channel
- Capture meeting chat content
- Get structured JSON from Teams messages
- Parse reactions, replies, and attachments

## Prerequisites

1. **Microsoft Teams desktop app** must be running
2. **Accessibility permissions** granted to the terminal/Claude Code
3. **macos-automator MCP** available (provides `execute_script` tool)

## Workflow

### Step 1: Navigate to Target Chat

Use `macos-automator` to activate Teams and navigate:

```applescript
-- Navigate to a specific person or channel
tell application "Microsoft Teams" to activate
delay 0.5
tell application "System Events"
    tell process "Microsoft Teams"
        keystroke "g" using command down  -- Open "Go to" search
        delay 0.8
        keystroke "TARGET_NAME"           -- Type target name
        delay 1.5
        key code 36                        -- Enter (select first result)
        delay 1.5
    end tell
end tell
```

**MCP call:**
```json
{
  "tool": "mcp__macos-automator__execute_script",
  "arguments": {
    "script_content": "tell application \"Microsoft Teams\" to activate\ndelay 0.5\ntell application \"System Events\"\n    tell process \"Microsoft Teams\"\n        keystroke \"g\" using command down\n        delay 0.8\n        keystroke \"Jay Pancholi\"\n        delay 1.5\n        key code 36\n        delay 1.5\n    end tell\nend tell",
    "timeout_seconds": 10
  }
}
```

### Step 2: Capture Chat Content

**Critical:** Press Escape before Cmd+A to ensure the chat area has focus.

```applescript
tell application "System Events"
    tell process "Microsoft Teams"
        key code 53                        -- Escape (clear focus)
        delay 0.3
        keystroke "a" using command down   -- Select all
        delay 0.5
        keystroke "c" using command down   -- Copy
        delay 0.8
    end tell
end tell
do shell script "pbpaste"                  -- Return clipboard content
```

**MCP call:**
```json
{
  "tool": "mcp__macos-automator__execute_script",
  "arguments": {
    "script_content": "tell application \"System Events\"\n    tell process \"Microsoft Teams\"\n        key code 53\n        delay 0.3\n        keystroke \"a\" using command down\n        delay 0.5\n        keystroke \"c\" using command down\n        delay 0.8\n    end tell\nend tell\ndo shell script \"pbpaste\"",
    "timeout_seconds": 5
  }
}
```

### Step 3: Parse the Clipboard Content

Parse the raw text into structured JSON. See format documentation below.

---

## Teams Clipboard Format

When you copy chat content from Teams, it uses a specific text format. Parse this natively.

### Message Structure

Each message block follows this pattern:

```
AuthorName
DD/MM/YYYY H:MM am/pm
Message content here
Can span multiple lines
```

**Example:**
```
Jay Pancholi
15/01/2025 2:34 pm
Hey Nathan, just checking in on the project status.
Let me know when you have a moment.
```

### Replies (Reference Blocks)

Replies to messages appear as:

```
Begin Reference, preview of quoted message by OriginalAuthor
Quoted content snippet...
End Reference
Reply content here
```

**Example:**
```
Nathan Vale
15/01/2025 2:45 pm
Begin Reference, preview of Hey Nathan, just checking in on the project status. by Jay Pancholi
End Reference
All good! I'll have the update ready by EOD.
```

### Reactions

Reactions appear after message content:

```
emoji
N emoji-name reactions.
```

**Example:**
```
👍
2 like reactions.
❤️
1 heart reactions.
```

### Attachments

Various attachment indicators:

| Type | Pattern |
|------|---------|
| GIF | `(GIF Image)` |
| Image | `(Image)` or filename like `Screenshot 2025-01-15.png` |
| File | `has an attachment: filename.pdf` |
| URL Preview | `Url Preview for https://...` |
| Loop Component | `Loop Component` |

### Mentions

- **Direct mention:** Name appears inline in message text
- **@everyone:** Appears as `Everyone` in message text

### Edited Messages

Edited messages include:

```
Message content
Edited.
```

---

## Output Schema

Return parsed messages as JSON:

```typescript
interface TeamsMessage {
  author: string;
  timestamp: string;          // ISO 8601 format
  content: string;
  replyTo?: {
    author: string;
    preview: string;
  };
  reactions?: {
    emoji: string;
    count: number;
    name: string;
  }[];
  attachments?: {
    type: "gif" | "image" | "file" | "url" | "loop";
    name?: string;
    url?: string;
  }[];
  mentions?: string[];
  edited?: boolean;
}

interface TeamsChat {
  target: string;             // Channel or person name
  capturedAt: string;         // ISO 8601 timestamp
  messageCount: number;
  messages: TeamsMessage[];
}
```

**Example output:**

```json
{
  "target": "Jay Pancholi",
  "capturedAt": "2025-01-20T14:30:00.000Z",
  "messageCount": 2,
  "messages": [
    {
      "author": "Jay Pancholi",
      "timestamp": "2025-01-15T14:34:00.000Z",
      "content": "Hey Nathan, just checking in on the project status.\nLet me know when you have a moment.",
      "reactions": [
        { "emoji": "👍", "count": 1, "name": "like" }
      ]
    },
    {
      "author": "Nathan Vale",
      "timestamp": "2025-01-15T14:45:00.000Z",
      "content": "All good! I'll have the update ready by EOD.",
      "replyTo": {
        "author": "Jay Pancholi",
        "preview": "Hey Nathan, just checking in on the project status."
      }
    }
  ]
}
```

---

## Error Handling

### Teams Not Running

If Teams is not running, the AppleScript will fail. Check first:

```applescript
tell application "System Events"
    set isRunning to (name of processes) contains "Microsoft Teams"
end tell
return isRunning
```

### Target Not Found

If Cmd+G search doesn't find the target:
- The script will timeout waiting for navigation
- Suggest verifying the exact name/channel exists
- Consider partial matches or typos

### Accessibility Permissions

If keystrokes don't work:
- Check System Preferences → Security & Privacy → Privacy → Accessibility
- Ensure terminal app has permission granted

### Empty Clipboard

If clipboard is empty after capture:
- Teams window may not have focus
- Chat area may not be selected
- Try the Escape → Cmd+A → Cmd+C sequence again

---

## Complete Example

**User request:** "Scrape my chat with Jay Pancholi from Teams"

**Workflow:**

1. Navigate to Jay Pancholi's chat using Cmd+G
2. Capture content with Escape → Cmd+A → Cmd+C
3. Parse the clipboard text
4. Return structured JSON

**Combined script:**

```applescript
-- Navigate and capture in one script
tell application "Microsoft Teams" to activate
delay 0.5

tell application "System Events"
    tell process "Microsoft Teams"
        -- Navigate
        keystroke "g" using command down
        delay 0.8
        keystroke "Jay Pancholi"
        delay 1.5
        key code 36
        delay 2.0

        -- Capture
        key code 53
        delay 0.3
        keystroke "a" using command down
        delay 0.5
        keystroke "c" using command down
        delay 0.8
    end tell
end tell

do shell script "pbpaste"
```

---

## Tips

- **Increase delays** if Teams is slow to respond (especially on first navigation)
- **Verify target name** matches exactly what appears in Teams search
- **Parse timestamps** accounting for AU date format (DD/MM/YYYY)
- **Handle multiline content** by detecting next author/timestamp pattern
- **Filter system messages** like "X joined the meeting" if not needed
