---
description: Create or edit SuperWhisper custom modes using the superwhisper skill
argument-hint: [create|edit] [mode-name]
allowed-tools: Read, Edit, Write, Bash(jq:*), Bash(killall:*), Bash(open:*), Bash(ls:*)
---

# SuperWhisper Mode Manager

You MUST use the **superwhisper skill** to help with this task.

## Task

$ARGUMENTS

## Instructions

1. Invoke the superwhisper skill by reading `@custom-modes.md` for mode templates
2. Help create or edit the mode configuration in `~/Documents/superwhisper/modes/`
3. Validate the JSON structure using `jq`
4. Provide testing instructions with deep links
5. Remind to restart SuperWhisper: `killall -9 superwhisper && sleep 2 && open -a SuperWhisper`

## Common Operations

- **Create**: Generate new mode JSON from requirements
- **Edit**: Modify existing mode files
- **Validate**: Check JSON syntax with `jq`
- **Test**: Provide deep link test command

## Mode File Location

All mode files are stored in: `~/Documents/superwhisper/modes/`

## Testing Pattern

After creating/editing, test with:

```bash
open "superwhisper://mode?key=mode-key&record=true"
```
