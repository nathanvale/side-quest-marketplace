---
description: Paste text from clipboard
argument-hint:
---

# Clipboard: Paste

Paste text from the system clipboard using the MCP clipboard tool.

## Usage

```
/clipboard:paste
```

## Examples

```
/clipboard:paste
```

## Implementation

This command uses the `paste` MCP tool which handles cross-platform clipboard operations (macOS pbpaste, Linux xclip, Windows Get-Clipboard).

## Instructions

When the user runs this command:

1. Call the `paste` MCP tool
2. Display the clipboard content to the user
3. Report any errors if the paste fails

This command takes no arguments.
