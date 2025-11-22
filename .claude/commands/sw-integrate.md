---
description: Create SuperWhisper integration scripts using the superwhisper skill
argument-hint: [app-name] [workflow-description]
allowed-tools: Read, Write, Edit, Bash(chmod:*), Bash(ls:*), Bash(mkdir:*)
---

# SuperWhisper Integration Setup

You MUST use the **superwhisper skill** to create this integration.

## Integration Request

$ARGUMENTS

## Instructions

1. Invoke the superwhisper skill by reading `@integration.md`
2. Find relevant integration pattern from existing examples:
   - Obsidian (daily notes, quick capture, vault-aware)
   - VS Code (documentation, commit messages)
   - Slack (messages, thread replies)
   - Mail (drafting, replies)
   - Terminal (command dictation)
   - Browser (form filling, search)
   - Zoom/Teams (meeting notes)
3. Create custom scripts in `~/code/dotfiles/bin/utils/`
4. Create necessary mode JSON files in `~/Documents/superwhisper/modes/`
5. Provide Raycast/Karabiner setup if needed
6. Test the complete workflow

## Script Template

Generate scripts following this pattern:

```bash
#!/bin/bash
# ~/code/dotfiles/bin/utils/sw-[app]-[action].sh

# 1. Context gathering (optional)
# Get clipboard, active window, etc.

# 2. Mode switching with deep link
open "superwhisper://mode?key=mode-key&record=true"

# 3. Post-processing (optional)
# Wait for transcription, parse output, etc.
```

## Mode Configuration

Create mode JSON with:

- Clear instructions for AI formatting
- Context settings (clipboard, selection, activeApp)
- Output method (paste or clipboard)
- Activation apps (if auto-activate)

## Testing Checklist

After setup, verify:

1. Script is executable: `chmod +x script.sh`
2. Mode JSON is valid: `jq '.' mode.json`
3. Deep link works: `open "superwhisper://mode?key=..."`
4. End-to-end workflow completes successfully
5. SuperWhisper restarted if needed
