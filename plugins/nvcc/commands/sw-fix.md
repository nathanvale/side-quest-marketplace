---
description: Troubleshoot SuperWhisper issues using the superwhisper skill
argument-hint: [issue-description]
allowed-tools:
  Read, Bash(ps:*), Bash(ls:*), Bash(grep:*), Bash(killall:*), Bash(open:*), Bash(jq:*),
  Bash(osascript:*)
---

# SuperWhisper Troubleshooting

You MUST use the **superwhisper skill** to diagnose this issue.

## Problem

$ARGUMENTS

## Instructions

1. Invoke the superwhisper skill by reading `@troubleshooting.md`
2. Run diagnostic commands to identify the issue
3. Check common problems:
   - Modes not showing after adding mode files
   - Keyboard shortcuts not working
   - SuperWhisper switching workspaces (AeroSpace)
   - Microphone not picking up voice
   - Transcription quality issues
4. Provide step-by-step fix with verification commands
5. Test the solution

## Diagnostic Steps

Run these automatically to gather context:

**Check if SuperWhisper is running:**

```bash
!`ps aux | grep -i superwhisper | grep -v grep`
```

**Verify modes directory:**

```bash
!`ls -la ~/Documents/superwhisper/modes/`
```

**Check mode JSON validity:**

```bash
!`ls ~/Documents/superwhisper/modes/*.json`
```

Then use the Read tool to inspect individual mode files for JSON validity.

**Check AeroSpace config (if workspace switching issue):**

```bash
!`grep -A 2 "com.superduper.superwhisper" ~/code/dotfiles/config/aerospace/aerospace.toml`
```

## Common Fixes

- **Modes not appearing**: Hard restart SuperWhisper
- **Shortcuts not working**: Check Accessibility permissions
- **Workspace switching**: Verify AeroSpace floating config
- **Poor transcription**: Switch voice models or adjust instructions
