# SuperWhisper Integration Patterns

## Obsidian Integration

### Quick Capture to Inbox

**Mode Configuration**:

```json
{
  "instructions": "Format for Obsidian: Use ## for headings, [[wikilinks]] for connections, #tags for categories. Keep paragraphs short (2-3 sentences). Add timestamp.",
  "key": "obsidian-inbox",
  "name": "Obsidian Inbox",
  "output": {
    "method": "paste"
  }
}
```

**Workflow**:

1. Open Obsidian inbox note
2. Trigger: `cmd+shift+o`
3. Speak thought
4. Auto-formatted markdown appears

### Daily Notes Integration

**AppleScript** (`~/Library/Scripts/SuperWhisper/ObsidianDaily.scpt`):

```applescript
-- Open today's daily note and start SuperWhisper recording

tell application "Obsidian"
  activate
end tell

-- Wait for window focus
delay 0.5

-- Trigger daily note (assumes cmd+d hotkey in Obsidian)
tell application "System Events"
  keystroke "d" using command down
  delay 0.5
end tell

-- Start SuperWhisper in obsidian-daily mode
do shell script "open 'superwhisper://mode?key=obsidian-daily&record=true'"
```

**Shell Wrapper**:

```bash
#!/bin/bash
# ~/code/dotfiles/bin/vault/obsidian-voice-daily.sh

osascript ~/Library/Scripts/SuperWhisper/ObsidianDaily.scpt
```

### Context-Aware Vault Selection

```bash
#!/bin/bash
# ~/code/dotfiles/bin/vault/sw-vault-capture.sh
# Uses vault script to determine active Obsidian vault

VAULT=$(~/code/dotfiles/bin/vault/vault current)

case "$VAULT" in
  "repos")
    MODE="obsidian-code"
    ;;
  "MPCU-Build-and-Deliver")
    MODE="obsidian-work"
    ;;
  "personal")
    MODE="obsidian-personal"
    ;;
  *)
    MODE="obsidian-inbox"
    ;;
esac

open "superwhisper://mode?key=$MODE&record=true"
```

## VS Code Integration

### Code Documentation Mode

**Mode Configuration**:

```json
{
  "context": {
    "clipboard": true,
    "selection": true
  },
  "instructions": "Format as JSDoc/TSDoc comment. Include @param, @returns, @example. Use markdown code blocks.",
  "key": "vscode-docs",
  "name": "VS Code Documentation",
  "output": {
    "method": "paste"
  }
}
```

**Workflow**:

1. Select function/class in VS Code
2. Trigger: `cmd+shift+d`
3. Dictate documentation
4. Formatted JSDoc comment pastes above selection

### Commit Message Dictation

```bash
#!/bin/bash
# ~/code/dotfiles/bin/utils/sw-commit-message.sh

# Stage changes first
cd "$(git rev-parse --show-toplevel)"

# Get git diff for context
git diff --staged > /tmp/git-staged-diff.txt

# Copy diff to clipboard for SuperWhisper context
pbcopy < /tmp/git-staged-diff.txt

# Switch to commit message mode (uses clipboard context)
open "superwhisper://mode?key=git-commit&record=true"

# Open commit message editor
sleep 3  # Wait for transcription
git commit
```

**Commit Message Mode**:

```json
{
  "context": {
    "clipboard": true
  },
  "instructions": "Write conventional commit message based on diff in clipboard. Format: type(scope): description. Types: feat, fix, docs, refactor, test, chore. Keep description under 50 chars.",
  "key": "git-commit",
  "name": "Git Commit Message",
  "output": {
    "method": "clipboard"
  }
}
```

## Slack Integration

### Message Drafting

**Mode Configuration**:

```json
{
  "instructions": "Format for Slack: casual but professional tone, use *bold* for emphasis, bullet points for lists, `code` for technical terms, >quote blocks for references. Keep messages concise.",
  "key": "slack-message",
  "name": "Slack Message",
  "output": {
    "method": "paste"
  }
}
```

### Thread Reply with Context

```bash
#!/bin/bash
# ~/code/dotfiles/bin/utils/sw-slack-reply.sh

# Copy selected thread context first (manually)
# Then run this script

# Check if clipboard has content
if ! pbpaste | grep -q .; then
  echo "Copy thread context first!"
  exit 1
fi

# Use context-aware mode
open "superwhisper://mode?key=slack-reply&record=true"
```

**Slack Reply Mode** (with clipboard context):

```json
{
  "context": {
    "clipboard": true
  },
  "instructions": "Read clipboard for thread context. Write reply referencing previous messages. Use conversational tone. Quote relevant parts with > if needed.",
  "key": "slack-reply",
  "name": "Slack Reply",
  "output": {
    "method": "paste"
  }
}
```

## Mail.app Integration

### Email Drafting with Contact Detection

```bash
#!/bin/bash
# ~/code/dotfiles/bin/utils/sw-email-smart.sh

# Detect if composing reply or new email
IS_REPLY=$(osascript -e '
tell application "Mail"
  try
    set selectedMessages to selection
    if (count of selectedMessages) > 0 then
      return "true"
    end if
  end try
end tell
return "false"
')

if [ "$IS_REPLY" = "true" ]; then
  MODE="email-reply"
else
  MODE="email-new"
fi

open "superwhisper://mode?key=$MODE&record=true"
```

### Auto-Signature Integration

**Mode with Context**:

```json
{
  "context": {
    "activeApp": true,
    "clipboard": true
  },
  "instructions": "Format as professional email. Include: clear subject line, polite greeting, structured body paragraphs, professional closing. Infer recipient formality from context.",
  "key": "email-new",
  "name": "Email New",
  "output": {
    "method": "paste"
  }
}
```

## Browser Integration

### Form Filling Mode

```json
{
  "instructions": "Transcribe for form filling. Format: field_name: value. One field per line. No extra formatting.",
  "key": "web-form",
  "name": "Web Form",
  "output": {
    "method": "clipboard"
  }
}
```

**Usage**:

1. Focus first form field
2. Dictate: "Name: John Smith. Email: john at example dot com. Phone: 555-1234"
3. Copy from clipboard
4. Parse and fill programmatically

### Search Query Optimization

```bash
#!/bin/bash
# ~/code/dotfiles/bin/utils/sw-search.sh

# Optimized for ADHD: speak complex search, get formatted query

open "superwhisper://mode?key=search-query&record=true"

# Wait for transcription to clipboard
sleep 3

# Open in default browser
QUERY=$(pbpaste | sed 's/ /+/g')
open "https://www.google.com/search?q=$QUERY"
```

## Terminal Integration

### Command Dictation

**Safety First**: Don't auto-execute dictated commands!

```bash
#!/bin/bash
# ~/code/dotfiles/bin/utils/sw-command.sh

open "superwhisper://mode?key=terminal-command&record=true"

# Wait for transcription
sleep 3

# Copy to terminal input (not execute)
COMMAND=$(pbpaste)
echo "$COMMAND"
echo "Press Enter to execute, or edit first"
```

**Terminal Command Mode**:

```json
{
  "instructions": "Transcribe as shell command. Replace natural language with actual commands: 'list files' → ls -la, 'change directory' → cd, 'search for text' → grep. Include flags. No explanations.",
  "key": "terminal-command",
  "name": "Terminal Command",
  "output": {
    "method": "clipboard"
  }
}
```

## Zoom/Teams Meeting Integration

### Meeting Notes Mode

```json
{
  "instructions": "Format as meeting notes. Sections: ## Attendees, ## Key Points (bullets), ## Decisions (bullets), ## Action Items (- [ ] checkboxes), ## Next Steps. Use timestamps for important moments.",
  "key": "meeting-notes",
  "name": "Meeting Notes",
  "output": {
    "method": "paste"
  }
}
```

### Auto-Switch on Meeting Start

**Hammerspoon** (`~/.hammerspoon/init.lua`):

```lua
-- Detect Zoom/Teams and auto-switch SuperWhisper mode

local meetingApps = {"zoom.us", "com.microsoft.teams"}

function switchToMeetingMode()
  hs.execute("open 'superwhisper://mode?key=meeting-notes'")
  hs.notify.new({title="SuperWhisper", informativeText="Switched to Meeting Notes mode"}):send()
end

appWatcher = hs.application.watcher.new(function(appName, eventType, appObject)
  if eventType == hs.application.watcher.activated then
    local bundleID = appObject:bundleID()
    for _, meetingApp in ipairs(meetingApps) do
      if bundleID == meetingApp then
        switchToMeetingMode()
        break
      end
    end
  end
end)
appWatcher:start()
```

## iMessage Integration

### Quick Reply Mode

```json
{
  "instructions": "Write casual message reply. Use natural conversational tone. Include emoji if appropriate. Keep brief.",
  "key": "imessage-reply",
  "name": "iMessage Reply",
  "output": {
    "method": "paste"
  }
}
```

**Auto-Detect iMessage**:

```bash
#!/bin/bash
# Add to sw-smart.sh

case "$ACTIVE_APP" in
  "com.apple.MobileSMS")
    MODE="imessage-reply"
    ;;
esac
```

## Multi-App Workflows

### Cross-App Context Passing

**Example: Email → Obsidian Note**

```bash
#!/bin/bash
# ~/code/dotfiles/bin/utils/sw-email-to-note.sh

# 1. Select email content in Mail.app
# 2. Copy selection (cmd+c)
# 3. Run this script

# Extract email context
EMAIL_SUBJECT=$(osascript -e 'tell application "Mail" to get subject of item 1 of (get selection)')

# Open Obsidian
open -a Obsidian

# Wait for focus
sleep 1

# Create new note with email context
osascript -e 'tell application "System Events" to keystroke "n" using command down'

sleep 0.5

# Start SuperWhisper with clipboard context
open "superwhisper://mode?key=obsidian-email-note&record=true"
```

**Mode with Email Context**:

```json
{
  "context": {
    "clipboard": true
  },
  "instructions": "Create note about email in clipboard. Format: # Email Subject (from context), ## Summary (dictation), ## Action Items, ## Follow-up. Include [[contact links]] for people.",
  "key": "obsidian-email-note",
  "name": "Obsidian Email Note",
  "output": {
    "method": "paste"
  }
}
```

## Integration Testing

### Test Integration Script

```bash
#!/bin/bash
# ~/code/dotfiles/bin/test/test-sw-integration.sh

echo "Testing SuperWhisper Integrations..."

# Test 1: Basic deep link
echo "Test 1: Basic record..."
open "superwhisper://record"
sleep 2

# Test 2: Mode switching
echo "Test 2: Mode switch..."
open "superwhisper://mode?key=default"
sleep 1

# Test 3: Mode + record
echo "Test 3: Mode with recording..."
open "superwhisper://mode?key=quick-note&record=true"
sleep 3

# Test 4: Context awareness
echo "Test 4: Clipboard context..."
echo "test context" | pbcopy
open "superwhisper://mode?key=email&record=true"

echo "✅ Integration tests complete"
```

## Troubleshooting Integrations

### Common Issues

**Deep links not triggering**:

```bash
# Ensure SuperWhisper is running
ps aux | grep SuperWhisper

# Test basic link first
open "superwhisper://record"
```

**Context not being passed**:

```bash
# Verify clipboard/selection has content
pbpaste

# Check mode configuration has context enabled
jq '.context' ~/Documents/SuperWhisper/modes/your-mode.json
```

**Wrong mode activating**:

```bash
# Verify mode key matches exactly
jq -r '.key' ~/Documents/SuperWhisper/modes/*.json | grep your-mode
```

## AeroSpace Window Manager Integration

### Floating Window Configuration

SuperWhisper is configured to float on the current workspace to prevent unwanted workspace
switching:

**Configuration** (`~/code/dotfiles/config/aerospace/aerospace.toml`):

```toml
[[on-window-detected]]
if.app-id = 'com.superduper.superwhisper'
run = 'layout floating'
```

### Why Floating Mode?

- **Prevents workspace switching**: SuperWhisper stays on current workspace when activated
- **Always accessible**: Recording window appears over current work
- **Quick activation**: Press `Option+Space` without disrupting workflow

### Troubleshooting AeroSpace Integration

**SuperWhisper still switching workspaces**:

```bash
# Verify AeroSpace configuration
grep -A 2 "com.superduper.superwhisper" ~/code/dotfiles/config/aerospace/aerospace.toml

# Reload AeroSpace config
aerospace reload-config

# Check SuperWhisper app ID
osascript -e 'id of app "SuperWhisper"'
```

**SuperWhisper not floating**:

```bash
# Verify the app-id matches exactly
aerospace list-windows | grep -i whisper
```
