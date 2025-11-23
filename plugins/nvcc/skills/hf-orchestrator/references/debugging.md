# Debugging HyperFlow

## Common Issues

### 1. Shortcut Not Working

**Symptoms:** Pressing Hyper+Key does nothing

**Debug steps:**

1. Check if Karabiner is running
2. Verify JSON syntax in `karabiner.json`
3. Check Console.app for Karabiner errors
4. Test if Hyper key itself works (try Hyper+H for arrow navigation)

```bash
# Validate Karabiner JSON
python3 -c "import json; json.load(open('config/karabiner/karabiner.json'))"

# Check Karabiner process
ps aux | grep -i karabiner

# View recent Karabiner logs
log show --predicate 'process CONTAINS "karabiner"' --last 5m
```

### 2. Race Conditions

**Symptoms:** App launches but SuperWhisper mode doesn't switch, or wrong app gets focus

**Debug steps:**

1. Check timing in `superwhisper-mode-switch.sh`
2. Increase `sleep` duration if needed
3. Review Console.app logs for timing

```bash
# View HyperFlow execution logs
log show --predicate 'eventMessage CONTAINS "hyperflow"' --last 5m --style compact

# Look for:
# - "Launching app: App Name"
# - "Switching mode to: mode-name"
# - "Restoring focus to: App Name"
```

**Fix:** Adjust sleep timing in `bin/hyperflow/superwhisper-mode-switch.sh`:

```bash
sleep 0.5  # Increase to 0.7 or 1.0 if race conditions persist
```

### 3. App Won't Focus

**Symptoms:** App launches in background but doesn't come to foreground

**Debug steps:**

1. Check if app name in `hyperflow.sh` matches actual app name
2. Verify app is installed and accessible

```bash
# Get correct app name
osascript -e 'tell application "System Events" to get name of every application process'

# Test app activation directly
osascript -e 'tell application "App Name" to activate'
```

### 4. Wrong SuperWhisper Mode

**Symptoms:** App launches but mode doesn't match expected

**Debug steps:**

1. Check app-to-mode mapping in `superwhisper-mode-switch.sh`
2. Verify app bundle name matches case statement
3. Ensure mode JSON file exists

```bash
# Get active app's bundle name
osascript -e 'tell application "System Events" to get name of first application process whose frontmost is true'

# Check available modes
ls -1 config/superwhisper/modes/
```

## Viewing Debug Logs

### Console.app (macOS System Logs)

**Filter patterns:**

- `process == "karabiner"`
- `eventMessage CONTAINS "hyperflow"`
- `eventMessage CONTAINS "superwhisper"`

**Time range:** Last 5 minutes or custom

### Command Line Logs

```bash
# HyperFlow execution logs
log stream --predicate 'eventMessage CONTAINS "hyperflow"' --level debug

# SuperWhisper mode switching
log stream --predicate 'eventMessage CONTAINS "superwhisper"' --level debug

# Karabiner events
log stream --predicate 'process == "karabiner_grabber"' --level debug
```

## Testing Changes

### 1. Test Karabiner JSON Syntax

```bash
# Validate JSON
python3 -c "import json; json.load(open('config/karabiner/karabiner.json'))"
```

### 2. Test HyperFlow Script

```bash
# Directly invoke launcher
~/bin/hyperflow 2  # Should launch VS Code

# Test mode switcher
~/code/dotfiles/apps/hyperflow/superwhisper-mode-switch.sh  # Should switch mode based on active app
```

### 3. Test Individual Components

```bash
# Test app launch via AppleScript
osascript -e 'tell application "Visual Studio Code" to activate'

# Test SuperWhisper deep link
open "superwhisper://mode?name=default"

# Test key event detection
# Open Karabiner-EventViewer and press keys to see events
```

## Performance Issues

### Slow App Launch

**Symptoms:** Noticeable delay between keypress and app appearing

**Causes:**

- App not already running (first launch is always slower)
- System resource constraints
- Excessive sleep delays

**Fix:**

```bash
# Reduce unnecessary sleeps in hyperflow.sh
# Keep apps in Dock for faster activation
# Use launchd to keep apps running in background
```

### Mode Switch Lag

**Symptoms:** App launches but mode switch happens seconds later

**Debug:**

```bash
# Add timing debug to superwhisper-mode-switch.sh
echo "$(date): Starting mode switch" >> /tmp/hyperflow-debug.log
# ... existing code ...
echo "$(date): Mode switch complete" >> /tmp/hyperflow-debug.log

# Review timing
cat /tmp/hyperflow-debug.log
```

## Backup and Recovery

### Backup Current Configuration

```bash
# Backup Karabiner config
cp config/karabiner/karabiner.json config/karabiner/karabiner.json.backup

# Backup HyperFlow scripts
tar -czf ~/hyperflow-backup-$(date +%Y%m%d).tar.gz bin/hyperflow/
```

### Restore from Backup

```bash
# Restore Karabiner config
cp config/karabiner/karabiner.json.backup config/karabiner/karabiner.json

# Karabiner will auto-reload
```

### Reset to Clean State

```bash
# Remove all complex modifications (careful!)
# Edit karabiner.json and set:
# "complex_modifications": { "rules": [] }

# Or restore from dotfiles repo
git checkout config/karabiner/karabiner.json
```
