# SuperWhisper Mode Integration

## Overview

SuperWhisper modes provide context-aware AI voice dictation that automatically switches based on the
active application.

## Mode Definitions

| Mode                    | Use Case                   | Apps                            |
| ----------------------- | -------------------------- | ------------------------------- |
| `default`               | Coding, terminal work      | VS Code, Ghostty, terminal apps |
| `casual-text`           | Messaging, chat            | Messages, Slack, Teams          |
| `professional-engineer` | Professional communication | Outlook, email clients          |
| `email`                 | Email composition          | Mail.app                        |

## Mode Configuration Files

Location: `config/superwhisper/modes/`

Each mode has its own JSON file with prompts and settings:

- `default.json`
- `casual-text.json`
- `professional-engineer.json`
- `email.json`

## Mode Switching Logic

Located in: `apps/hyperflow/superwhisper-mode-switch.sh`

### App-to-Mode Mapping

```bash
case "$app_name" in
  "Visual Studio Code"|"Ghostty"|"Terminal"|"iTerm")
    mode="default"
    ;;
  "Messages"|"Slack")
    mode="casual-text"
    ;;
  "Microsoft Outlook")
    mode="professional-engineer"
    ;;
  "Mail")
    mode="email"
    ;;
  *)
    mode="default"
    ;;
esac
```

## Deep Link Format

SuperWhisper modes are switched via deep links:

```bash
open "superwhisper://mode?name=MODE_NAME"
```

Example:

```bash
open "superwhisper://mode?name=default"
```

## Integration with HyperFlow

The mode switcher runs automatically after app launches:

1. HyperFlow launches app via `hyperflow.sh`
2. Script waits 0.5s for app to focus
3. Triggers `superwhisper-mode-switch.sh` in background
4. Mode switcher detects active app
5. Switches to appropriate SuperWhisper mode
6. Restores focus to original app

## Debugging Mode Switches

Check Console.app logs:

```bash
# Filter for mode switching
log show --predicate 'process == "hyperflow" OR process == "superwhisper"' --last 5m

# Look for lines like:
# "Switching SuperWhisper mode to: default"
# "Active app: Visual Studio Code"
```

## Adding New Mode Mappings

To add a new app-to-mode mapping:

1. Determine app bundle name:

   ```bash
   osascript -e 'tell application "System Events" to get name of first application process whose frontmost is true'
   ```

2. Edit `apps/hyperflow/superwhisper-mode-switch.sh`

3. Add case to the switch statement:

   ```bash
   "Your App Name")
     mode="your-mode"
     ;;
   ```

4. Ensure mode JSON exists in `config/superwhisper/modes/`

## Race Condition Prevention

The mode switcher includes debouncing:

```bash
sleep 0.5  # Wait for app to fully focus
# Then switch mode
# Then restore focus
```

This prevents race conditions where:

- Mode switch happens before app is focused
- Focus restoration happens before mode completes
