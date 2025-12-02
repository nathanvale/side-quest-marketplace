---
description: Copy text to clipboard
argument-hint: [text to copy]
---

# Clipboard: Copy

Copy text to the system clipboard using the MCP clipboard tool.

## Usage

```
/clipboard:copy [text]
```

## Examples

```
/clipboard:copy Hey Bestie - last night was great. xxx
```

```
/clipboard:copy https://example.com/some-long-url
```

## Implementation

This command uses the `mcp__plugin_clipboard_clipboard__copy` MCP tool which handles cross-platform clipboard operations (macOS pbcopy, Linux xclip, Windows clip).

## Instructions

When the user runs this command:

1. Extract the text argument from `$ARGUMENTS`
2. Call the `mcp__plugin_clipboard_clipboard__copy` MCP tool with the text
3. Report success or error to the user

If no arguments provided, ask the user what they want to copy.
