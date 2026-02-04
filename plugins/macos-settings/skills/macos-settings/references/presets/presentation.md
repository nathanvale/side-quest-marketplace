# Presentation Preset

Clean, distraction-free configuration for meetings and demos. Optimized for:
- No notifications
- No sleep during presentation
- Clean desktop
- Professional appearance

## Target Machine
- Any Mac during meetings/demos
- macOS Sequoia (15.x) or Tahoe (26.x)

---

## Do Not Disturb — Enable

```bash
# Enable Focus/DND (Note: Full Focus API requires shortcuts or GUI)
# This disables notification previews
defaults write com.apple.ncprefs show_previews -int 0

# Alternative: Use Focus mode via Shortcuts app or menu bar
# Or use caffeinate for the duration of presentation
```

---

## Prevent Sleep

```bash
# Option 1: Temporary (for this session only)
caffeinate -di &
# Save PID to kill later: echo $! > /tmp/caffeinate.pid

# Option 2: Permanent until changed
sudo pmset -a displaysleep 0
sudo pmset -a sleep 0
```

---

## Desktop — Clean

```bash
# Hide desktop icons temporarily
defaults write com.apple.finder CreateDesktop -bool false
killall Finder

# To restore:
# defaults write com.apple.finder CreateDesktop -bool true
# killall Finder
```

---

## Dock — Professional

```bash
# Auto-hide (more screen space)
defaults write com.apple.dock autohide -bool true

# Instant show/hide (no delay)
defaults write com.apple.dock autohide-delay -float 0
defaults write com.apple.dock autohide-time-modifier -float 0.2

# Reasonable size
defaults write com.apple.dock tilesize -int 48

# No recent apps (cleaner)
defaults write com.apple.dock show-recents -bool false

# No bouncing (distracting)
defaults write com.apple.dock no-bouncing -bool true
```

---

## Menu Bar — Clean

```bash
# Hide Spotlight icon (use Cmd+Space instead)
defaults write com.apple.Spotlight MenuItemHidden -bool true

# Note: Most menu bar items require their app's settings
# Consider using Bartender or similar for presentations
```

---

## Screen Saver — Disabled

```bash
# Never start screen saver
defaults write com.apple.screensaver idleTime -int 0
```

---

## Notifications — Minimal

```bash
# Disable notification sounds
defaults write com.apple.sound.beep.flash -bool false

# Hide notification previews
defaults write com.apple.ncprefs show_previews -int 0
```

---

## Hot Corners — Disabled

```bash
# Prevent accidental screen saver/sleep during demo
defaults write com.apple.dock wvous-tl-corner -int 0
defaults write com.apple.dock wvous-tr-corner -int 0
defaults write com.apple.dock wvous-bl-corner -int 0
defaults write com.apple.dock wvous-br-corner -int 0
```

---

## Apply & Restart

```bash
# Restart affected apps
killall Finder
killall Dock
killall SystemUIServer
killall NotificationCenter 2>/dev/null || true

echo "Presentation settings applied!"
echo ""
echo "IMPORTANT: To prevent sleep during presentation, run:"
echo "  caffeinate -di"
echo ""
echo "To stop caffeinate when done:"
echo "  killall caffeinate"
```

---

## Quick Toggle Script

Save as `~/scripts/presentation-mode.sh`:

```bash
#!/bin/bash
# Toggle presentation mode

STATE_FILE="/tmp/presentation-mode"

if [[ -f "$STATE_FILE" ]]; then
    echo "Disabling presentation mode..."

    # Restore desktop icons
    defaults write com.apple.finder CreateDesktop -bool true

    # Kill caffeinate
    killall caffeinate 2>/dev/null

    # Restore screen saver
    defaults delete com.apple.screensaver idleTime

    # Restore notification previews
    defaults write com.apple.ncprefs show_previews -int 2

    rm "$STATE_FILE"
    killall Finder Dock
    echo "Presentation mode OFF"
else
    echo "Enabling presentation mode..."

    # Hide desktop
    defaults write com.apple.finder CreateDesktop -bool false

    # Prevent sleep
    caffeinate -di &

    # Disable screen saver
    defaults write com.apple.screensaver idleTime -int 0

    # Hide notifications
    defaults write com.apple.ncprefs show_previews -int 0

    touch "$STATE_FILE"
    killall Finder Dock NotificationCenter 2>/dev/null
    echo "Presentation mode ON"
fi
```

Make executable: `chmod +x ~/scripts/presentation-mode.sh`

---

## Verification

```bash
# Desktop icons hidden
defaults read com.apple.finder CreateDesktop
# Expected: 0 (false)

# Screen saver disabled
defaults read com.apple.screensaver idleTime
# Expected: 0

# Caffeinate running
pgrep caffeinate && echo "Sleep prevention: ACTIVE"
```

---

## Revert to Defaults

```bash
# Restore desktop icons
defaults write com.apple.finder CreateDesktop -bool true

# Kill caffeinate
killall caffeinate 2>/dev/null

# Restore screen saver (5 minutes default)
defaults write com.apple.screensaver idleTime -int 300

# Restore notification previews
defaults write com.apple.ncprefs show_previews -int 2

# Restore Dock
defaults delete com.apple.dock autohide-delay
defaults delete com.apple.dock no-bouncing

# Restart
killall Finder Dock SystemUIServer
```

---

## Pre-Presentation Checklist

Before starting your presentation:

1. [ ] Close unnecessary apps (email, Slack, etc.)
2. [ ] Run `caffeinate -di &` to prevent sleep
3. [ ] Enable Do Not Disturb (menu bar or `~/scripts/presentation-mode.sh`)
4. [ ] Check display mirroring/arrangement
5. [ ] Test audio if needed
6. [ ] Hide desktop icons if cluttered

After presentation:

1. [ ] Run `killall caffeinate`
2. [ ] Disable Do Not Disturb
3. [ ] Restore desktop icons if hidden
