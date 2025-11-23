# SuperWhisper Automation

## Deep Links (URL Scheme)

SuperWhisper supports `superwhisper://` URL scheme for automation.

### Basic Deep Link Patterns

```bash
# Start recording with current mode
open "superwhisper://record"

# Switch to specific mode
open "superwhisper://mode?key=mode-key"

# Switch mode AND start recording
open "superwhisper://mode?key=mode-key&record=true"

# Stop recording (if supported)
open "superwhisper://stop"
```

### Finding Mode Keys

```bash
# List all mode keys
jq -r '.key' ~/Documents/SuperWhisper/modes/*.json

# Find specific mode key
jq -r 'select(.name=="Email Mode") | .key' ~/Documents/SuperWhisper/modes/*.json
```

### Additional Deep Links

```bash
# Open SuperWhisper settings
open "superwhisper://settings"

# iOS license activation (for mobile users)
open "superwhisper://license/XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX"
```

## File Transcription Automation

SuperWhisper can transcribe external audio/video files by opening them directly with the app.

### Transcribing Files

```bash
# Transcribe an audio recording
open /path/to/recording.mp3 -a superwhisper

# Transcribe a video file
open ~/Documents/meeting.mp4 -a superwhisper

# Transcribe multiple files at once
open ~/Downloads/interview-*.m4a -a superwhisper
```

### Optimal File Formats

**Best Performance**:

- Audio: `.m4a`, `.mp3`, `.wav`, `.aac`
- Video: `.mp4`, `.mov`, `.m4v`

**Avoid**:

- `.flac` (large files, slower processing)
- `.avi` (compatibility issues)
- Very long files (>2 hours) - split them first

### Automated Folder Watching

**Script**: Automatically transcribe new files in a folder

```bash
#!/bin/bash
# ~/code/dotfiles/bin/utils/sw-watch-transcribe.sh
# Watch a folder and auto-transcribe new audio files

WATCH_DIR="$HOME/Documents/ToTranscribe"
PROCESSED_DIR="$HOME/Documents/Transcribed"

mkdir -p "$WATCH_DIR" "$PROCESSED_DIR"

# Use fswatch to monitor folder
fswatch -0 "$WATCH_DIR" | while read -d "" file; do
  # Only process audio/video files
  if [[ "$file" =~ \.(mp3|m4a|wav|mp4|mov)$ ]]; then
    echo "Transcribing: $file"
    open "$file" -a superwhisper

    # Wait for processing (adjust time based on file size)
    sleep 10

    # Move to processed folder
    mv "$file" "$PROCESSED_DIR/"
    echo "Moved to: $PROCESSED_DIR/$(basename "$file")"
  fi
done
```

**Install fswatch** (required):

```bash
brew install fswatch
```

**Run in Background**:

```bash
nohup ~/code/dotfiles/bin/utils/sw-watch-transcribe.sh &
```

**Stop Watching**:

```bash
pkill -f sw-watch-transcribe.sh
```

## Backup & Sync Automation

### Filesync Feature

SuperWhisper includes a **Filesync** feature for backing up and syncing recordings across devices.

**Enable in Settings**:

```
SuperWhisper → Settings → Filesync
```

**What Gets Synced**:

- ✅ Audio recordings
- ✅ Transcriptions
- ✅ Custom modes
- ✅ Settings (via iCloud)

### When to Enable Filesync

**Enable If**:

- You use multiple Macs
- You want automatic backups
- You need to access recordings from iOS
- You collaborate and share modes

**Disable If**:

- Privacy concerns (recordings in cloud)
- Limited iCloud storage
- Only use one device
- Prefer manual backups

### Cross-Device Sync Benefits

1. **iOS → Mac**: Start recording on iPhone, access transcription on Mac
2. **Mac → Mac**: Settings and modes stay in sync
3. **Automatic Backup**: Never lose recordings
4. **Mode Sharing**: Custom modes available everywhere

### Manual Backup Commands

**Backup All SuperWhisper Data**:

```bash
#!/bin/bash
# ~/code/dotfiles/bin/utils/sw-backup.sh
# Manual backup to external location

BACKUP_DIR="$HOME/Backups/SuperWhisper/$(date +%Y-%m-%d)"
SW_DIR="$HOME/Documents/SuperWhisper"

mkdir -p "$BACKUP_DIR"

# Copy all data
cp -R "$SW_DIR"/* "$BACKUP_DIR/"

echo "Backup saved to: $BACKUP_DIR"
```

**Restore from Backup**:

```bash
#!/bin/bash
# ~/code/dotfiles/bin/utils/sw-restore.sh
# Restore from backup

BACKUP_DIR="$1"
SW_DIR="$HOME/Documents/SuperWhisper"

if [ -z "$BACKUP_DIR" ]; then
  echo "Usage: sw-restore.sh /path/to/backup"
  exit 1
fi

# Quit SuperWhisper first
osascript -e 'quit app "SuperWhisper"'

# Restore data
cp -R "$BACKUP_DIR"/* "$SW_DIR/"

echo "Restored from: $BACKUP_DIR"
echo "Restart SuperWhisper to apply changes"
```

**Automated Weekly Backup** (cron):

```bash
# Add to crontab: crontab -e
0 2 * * 0 ~/code/dotfiles/bin/utils/sw-backup.sh
```

## Settings Management via Automation

SuperWhisper settings are stored in `~/Documents/SuperWhisper/settings.json`. You can modify
settings programmatically for advanced automation.

### Programmatic Settings Updates

**Example**: Change voice model via script

```bash
#!/bin/bash
# ~/code/dotfiles/bin/utils/sw-set-model.sh
# Switch between voice models programmatically

SETTINGS_FILE="$HOME/Documents/SuperWhisper/settings.json"
MODEL="$1"  # Options: local-fast, local-accurate, cloud

if [ -z "$MODEL" ]; then
  echo "Usage: sw-set-model.sh [local-fast|local-accurate|cloud]"
  exit 1
fi

# Quit SuperWhisper before modifying settings
osascript -e 'quit app "SuperWhisper"'

# Update voice_model in settings.json
jq ".voice_model = \"$MODEL\"" "$SETTINGS_FILE" > "$SETTINGS_FILE.tmp"
mv "$SETTINGS_FILE.tmp" "$SETTINGS_FILE"

# Restart SuperWhisper
open -a SuperWhisper

echo "Switched to $MODEL model"
```

**Usage**:

```bash
sw-set-model.sh local-fast      # Fast local processing
sw-set-model.sh local-accurate  # Better accuracy, slower
sw-set-model.sh cloud           # Cloud-based (requires internet)
```

### Common Settings Modifications

**Toggle Auto-Activation**:

```bash
#!/bin/bash
# Enable/disable auto-activation

SETTINGS_FILE="$HOME/Documents/SuperWhisper/settings.json"
ENABLED="$1"  # true or false

osascript -e 'quit app "SuperWhisper"'
jq ".auto_activation = $ENABLED" "$SETTINGS_FILE" > "$SETTINGS_FILE.tmp"
mv "$SETTINGS_FILE.tmp" "$SETTINGS_FILE"
open -a SuperWhisper
```

**Update Default Mode**:

```bash
#!/bin/bash
# Set default mode on launch

SETTINGS_FILE="$HOME/Documents/SuperWhisper/settings.json"
MODE_KEY="$1"

osascript -e 'quit app "SuperWhisper"'
jq ".default_mode = \"$MODE_KEY\"" "$SETTINGS_FILE" > "$SETTINGS_FILE.tmp"
mv "$SETTINGS_FILE.tmp" "$SETTINGS_FILE"
open -a SuperWhisper
```

**Change Hotkey Programmatically**:

```bash
#!/bin/bash
# Update global recording hotkey

SETTINGS_FILE="$HOME/Documents/SuperWhisper/settings.json"
HOTKEY="$1"  # Example: "cmd+shift+space"

osascript -e 'quit app "SuperWhisper"'
jq ".hotkey = \"$HOTKEY\"" "$SETTINGS_FILE" > "$SETTINGS_FILE.tmp"
mv "$SETTINGS_FILE.tmp" "$SETTINGS_FILE"
open -a SuperWhisper

echo "Hotkey changed to: $HOTKEY"
```

### Important Notes

**Always Restart After Changes**:

```bash
# Quit and restart for settings to take effect
osascript -e 'quit app "SuperWhisper"'
sleep 1
open -a SuperWhisper
```

**Backup Before Modifications**:

```bash
cp ~/Documents/SuperWhisper/settings.json ~/Documents/SuperWhisper/settings.json.backup
```

**Validate JSON After Changes**:

```bash
jq . ~/Documents/SuperWhisper/settings.json > /dev/null && echo "Valid JSON" || echo "Invalid JSON"
```

## Shell Script Automation

### Quick Mode Switcher

```bash
#!/bin/bash
# ~/code/dotfiles/bin/utils/sw-mode.sh

MODE_KEY="$1"

if [ -z "$MODE_KEY" ]; then
  echo "Usage: sw-mode.sh <mode-key>"
  echo "Available modes:"
  jq -r '.key + " - " + .name' ~/Documents/SuperWhisper/modes/*.json
  exit 1
fi

open "superwhisper://mode?key=$MODE_KEY&record=true"
```

**Usage**:

```bash
sw-mode.sh quick-note    # Switch to quick note mode
sw-mode.sh email         # Switch to email mode
sw-mode.sh obsidian      # Switch to obsidian mode
```

### Context-Aware Mode Switching

**Note**: This is **external automation** (not SuperWhisper's built-in auto-activation).

- External scripts use **bundle IDs** to detect active apps (via osascript)
- SuperWhisper's built-in `activationApps` uses **application names** (e.g., "Messages", "Mail")
- Both approaches work, but built-in auto-activation is simpler for most use cases

```bash
#!/bin/bash
# ~/code/dotfiles/bin/utils/sw-smart.sh
# Auto-select mode based on active application using external script

# Get active app bundle ID (external detection method)
ACTIVE_APP=$(osascript -e 'tell application "System Events" to get bundle identifier of first application process whose frontmost is true')

case "$ACTIVE_APP" in
  "com.apple.mail")
    MODE="email"
    ;;
  "md.obsidian")
    MODE="obsidian-quick"
    ;;
  "com.microsoft.VSCode")
    MODE="code-comments"
    ;;
  "com.tinyspeck.slackmacgap")
    MODE="slack-message"
    ;;
  *)
    MODE="default"
    ;;
esac

echo "Activating $MODE mode for $ACTIVE_APP"
open "superwhisper://mode?key=$MODE&record=true"
```

**Keyboard Shortcut**: Bind this script to global hotkey (e.g., `cmd+shift+space`)

## Keyboard Maestro Integration

### Mode Switcher Macro

```
Trigger: cmd+shift+M
Action: Execute Shell Script
  ~/code/dotfiles/bin/utils/sw-mode.sh $KMVAR_MODE_KEY
```

### Context-Aware Recording

```
Trigger: cmd+shift+R
Action:
  1. Get Front Application → save to $APP
  2. Execute Shell Script
     ~/code/dotfiles/bin/utils/sw-smart.sh
```

### Quick Capture Palette

```
Trigger: cmd+shift+Q
Action: Prompt for User Input
  Options:
    - Quick Note (key: quick-note)
    - Email Draft (key: email)
    - Meeting Notes (key: meeting)
    - Obsidian (key: obsidian)
  Execute Shell Script:
    open "superwhisper://mode?key=$SELECTED_KEY&record=true"
```

## Raycast Integration

### Install Raycast Extension

**Check if Available**:

```bash
open "raycast://extensions/superwhisper"
```

### Custom Raycast Script Commands

**Location**: `~/Library/Application Support/Raycast/Scripts/`

**Quick Note Script** (`superwhisper-quick-note.sh`):

```bash
#!/bin/bash

# Required parameters:
# @raycast.schemaVersion 1
# @raycast.title Quick Note
# @raycast.mode silent
# @raycast.icon 🎙️
# @raycast.packageName SuperWhisper

open "superwhisper://mode?key=quick-note&record=true"
```

**Email Draft Script** (`superwhisper-email.sh`):

```bash
#!/bin/bash

# Required parameters:
# @raycast.schemaVersion 1
# @raycast.title Email Draft
# @raycast.mode silent
# @raycast.icon 📧
# @raycast.packageName SuperWhisper

open "superwhisper://mode?key=email&record=true"
```

**Make Executable**:

```bash
chmod +x ~/Library/Application\ Support/Raycast/Scripts/superwhisper-*.sh
```

## AppleScript Integration

### Record with Specific Mode

```applescript
-- ~/Library/Scripts/SuperWhisper/RecordEmail.scpt

on run
  set modeKey to "email"
  set deepLink to "superwhisper://mode?key=" & modeKey & "&record=true"
  do shell script "open " & quoted form of deepLink
end run
```

**Run from Shell**:

```bash
osascript ~/Library/Scripts/SuperWhisper/RecordEmail.scpt
```

### Active App Detection + Mode Switch

```applescript
-- Get frontmost app and switch SuperWhisper mode

tell application "System Events"
  set frontApp to name of first application process whose frontmost is true
end tell

if frontApp is "Mail" then
  set modeKey to "email"
else if frontApp is "Obsidian" then
  set modeKey to "obsidian-quick"
else if frontApp is "Slack" then
  set modeKey to "slack-message"
else
  set modeKey to "default"
end if

do shell script "open 'superwhisper://mode?key=" & modeKey & "&record=true'"
```

## Hammerspoon Integration

### Auto Mode Switching on Window Focus

**Location**: `~/.hammerspoon/init.lua`

```lua
-- SuperWhisper auto mode switching

local appModeMap = {
  ["Mail"] = "email",
  ["Obsidian"] = "obsidian-quick",
  ["Code"] = "code-comments",
  ["Slack"] = "slack-message",
}

function switchSuperWhisperMode(appName)
  local mode = appModeMap[appName] or "default"
  local url = string.format("superwhisper://mode?key=%s", mode)
  hs.execute(string.format("open '%s'", url))
end

-- Watch for app switches
appWatcher = hs.application.watcher.new(function(appName, eventType, appObject)
  if eventType == hs.application.watcher.activated then
    switchSuperWhisperMode(appName)
  end
end)
appWatcher:start()

-- Manual trigger with hotkey
hs.hotkey.bind({"cmd", "shift"}, "R", function()
  local app = hs.application.frontmostApplication()
  switchSuperWhisperMode(app:name())
  hs.execute("open 'superwhisper://record'")
end)
```

## Alfred Integration

### Workflow: SuperWhisper Quick Actions

**Download/Create**: Alfred Workflow with Keyword triggers

**Keyword Examples**:

- `sw quick` → Switch to quick-note mode
- `sw email` → Switch to email mode
- `sw record` → Start recording current mode

**Run Script Action**:

```bash
open "superwhisper://mode?key={query}&record=true"
```

## BetterTouchTool Integration

### Touchbar Button

**Setup**:

1. BetterTouchTool → Touchbar → Add Widget → Button
2. Label: "🎙️ Record"
3. Action: Execute Shell Script
   ```bash
   open "superwhisper://record"
   ```

### Gesture Triggers

**Three-Finger Tap**:

```
Trigger: Three Finger Tap
Action: Execute Shell Script
  ~/code/dotfiles/bin/utils/sw-smart.sh
```

## Tmux Integration

### Quick Record Binding

Add to `~/.config/tmux/tmux.conf`:

```bash
# SuperWhisper quick record (Ctrl-g then w)
bind w run-shell "open 'superwhisper://record'"

# Context-aware recording
bind W run-shell "~/code/dotfiles/bin/utils/sw-smart.sh"
```

**Usage**:

- `Ctrl-g w`: Start recording with current mode
- `Ctrl-g W`: Smart mode selection based on tmux session

### Tmux Session-Based Modes

```bash
#!/bin/bash
# ~/code/dotfiles/bin/tmux/sw-session-mode.sh

SESSION=$(tmux display-message -p '#S')

case "$SESSION" in
  *"MPCU"*|*"portal"*)
    MODE="code-comments"
    ;;
  *"dotfiles"*)
    MODE="documentation"
    ;;
  *"obsidian"*|*"vault"*)
    MODE="obsidian-quick"
    ;;
  *)
    MODE="default"
    ;;
esac

open "superwhisper://mode?key=$MODE&record=true"
```

**Tmux Binding**:

```bash
bind W run-shell "~/code/dotfiles/bin/tmux/sw-session-mode.sh"
```

## Aerospace Integration

### Window Manager Mode Switching

Add to `~/.config/aerospace/aerospace.toml`:

```toml
# SuperWhisper mode switching per workspace
[[on-workspace-change]]
exec-and-forget = ['bash', '-c', 'sw-workspace-mode.sh']
```

**Script** (`~/code/dotfiles/bin/utils/sw-workspace-mode.sh`):

```bash
#!/bin/bash

WORKSPACE=$(aerospace list-workspaces --focused)

case "$WORKSPACE" in
  "C")  # Code workspace
    MODE="code-comments"
    ;;
  "E")  # Email workspace
    MODE="email"
    ;;
  "N")  # Notes workspace
    MODE="obsidian-quick"
    ;;
  *)
    MODE="default"
    ;;
esac

open "superwhisper://mode?key=$MODE"
```

## Cron/Scheduled Automation

### Daily Mode Reset

```bash
# Reset to default mode at start of workday
# Add to crontab: crontab -e

0 9 * * 1-5 open "superwhisper://mode?key=default"
```

### Periodic History Cleanup

```bash
#!/bin/bash
# ~/code/dotfiles/bin/utils/sw-cleanup.sh
# Clean SuperWhisper history older than 30 days

find ~/Documents/SuperWhisper/history/ -type f -mtime +30 -delete
echo "Cleaned SuperWhisper history older than 30 days"
```

**Run Weekly**:

```bash
# Add to crontab
0 0 * * 0 ~/code/dotfiles/bin/utils/sw-cleanup.sh
```

## ADHD Workflow Automation

### One-Key Quick Capture

**Goal**: Minimize steps from thought to capture

```bash
#!/bin/bash
# ~/code/dotfiles/bin/utils/sw-adhd-capture.sh
# Optimized for ADHD: instant capture with minimal friction

# Step 1: Switch to fast local mode
# Step 2: Start recording immediately
# Step 3: Auto-paste to current app

open "superwhisper://mode?key=adhd-quick&record=true"

# Optional: Visual feedback
osascript -e 'display notification "Recording..." with title "SuperWhisper"'
```

**Global Hotkey**: `cmd+shift+space` (via Keyboard Maestro/BetterTouchTool)

### ADHD Mode Configuration

```json
{
  "context": {
    "activeApp": false,
    "clipboard": false,
    "selection": false
  },
  "instructions": "Transcribe exactly as spoken. Short paragraphs (2-3 sentences). Use bullet points. No editing.",
  "key": "adhd-quick",
  "model": "local-fast",
  "name": "ADHD Quick Capture",
  "output": {
    "method": "paste"
  }
}
```

**Why It Works**:

- ✅ Local-fast = no waiting
- ✅ Minimal instructions = faster processing
- ✅ No context = instant mode switch
- ✅ Auto-paste = no extra step
- ✅ One hotkey = low cognitive load
