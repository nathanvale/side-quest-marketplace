# Minimal Preset

Battery-focused configuration for laptop travel. Optimized for:
- Maximum battery life
- Reduced visual effects
- Aggressive sleep
- No unnecessary background processes

## Target Machine
- MacBook Pro/Air on battery
- macOS Sequoia (15.x) or Tahoe (26.x)

---

## Energy — Aggressive Battery Saving

```bash
# Sleep quickly on battery
sudo pmset -b displaysleep 2      # Display off after 2 minutes
sudo pmset -b sleep 5             # System sleep after 5 minutes
sudo pmset -b disksleep 2         # Disk sleep after 2 minutes

# Disable wake features on battery
sudo pmset -b womp 0              # No wake on network
sudo pmset -b powernap 0          # No Power Nap
sudo pmset -b proximitywake 0     # No wake when iPhone nearby
sudo pmset -b tcpkeepalive 0      # Don't maintain connections during sleep

# Optimize for battery
sudo pmset -b lowpowermode 1      # Enable low power mode
sudo pmset -b lessbright 1        # Slightly dim display

# When plugged in — normal settings
sudo pmset -c displaysleep 10
sudo pmset -c sleep 0             # Never sleep when plugged in
sudo pmset -c lowpowermode 0
```

---

## Visual Effects — Reduce Everything

```bash
# Reduce motion (accessibility)
defaults write com.apple.universalaccess reduceMotion -bool true

# Reduce transparency (less GPU)
defaults write com.apple.universalaccess reduceTransparency -bool true

# Fast window animations
defaults write NSGlobalDomain NSWindowResizeTime -float 0.001

# No Dock animation
defaults write com.apple.dock launchanim -bool false

# Fast Mission Control
defaults write com.apple.dock expose-animation-duration -float 0.1

# Scale minimize (faster than genie)
defaults write com.apple.dock mineffect -string "scale"
```

---

## Dock — Minimal

```bash
# Auto-hide
defaults write com.apple.dock autohide -bool true

# Small size
defaults write com.apple.dock tilesize -int 32

# No recent apps
defaults write com.apple.dock show-recents -bool false

# No bouncing icons
defaults write com.apple.dock no-bouncing -bool true
```

---

## Finder — Simple

```bash
# List view (fastest rendering)
defaults write com.apple.finder FXPreferredViewStyle -string "Nlsv"

# Show extensions
defaults write NSGlobalDomain AppleShowAllExtensions -bool true

# No animation when opening info window
defaults write com.apple.finder DisableAllAnimations -bool true
```

---

## Keyboard — Standard

```bash
# Moderate key repeat (save battery vs aggressive)
defaults write NSGlobalDomain KeyRepeat -int 2
defaults write NSGlobalDomain InitialKeyRepeat -int 15

# Disable press-and-hold (get key repeat)
defaults write NSGlobalDomain ApplePressAndHoldEnabled -bool false
```

---

## Background Processes — Disable

```bash
# Disable Siri
defaults write com.apple.assistant.support "Assistant Enabled" -bool false

# Disable Spotlight indexing (optional — saves CPU but breaks search)
# sudo mdutil -a -i off

# Disable App Nap (controversial — may save or cost battery)
# defaults write NSGlobalDomain NSAppSleepDisabled -bool true
```

---

## Hot Corners — Disabled

```bash
# No hot corners (prevent accidental triggers)
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

echo "Minimal settings applied!"
echo "Note: Energy settings take effect immediately."
```

---

## Verification

```bash
# Power settings
pmset -g | grep -E "lowpowermode|sleep|displaysleep"

# Visual effects
defaults read com.apple.universalaccess reduceMotion
defaults read com.apple.universalaccess reduceTransparency

# Dock
defaults read com.apple.dock autohide
defaults read com.apple.dock tilesize
```

---

## Revert to Defaults

```bash
# Power — restore defaults
sudo pmset restoredefaults

# Visual effects
defaults delete com.apple.universalaccess reduceMotion
defaults delete com.apple.universalaccess reduceTransparency

# Dock
defaults delete com.apple.dock autohide
defaults delete com.apple.dock tilesize
defaults delete com.apple.dock no-bouncing

# Finder
defaults delete com.apple.finder FXPreferredViewStyle
defaults delete com.apple.finder DisableAllAnimations

# Restart
killall Finder Dock SystemUIServer
```
