# defaults — User Defaults System

`defaults` reads and writes macOS preferences (the same settings System Settings changes).

## Quick Reference

```bash
defaults read                           # All domains
defaults read com.apple.finder          # Specific domain
defaults read com.apple.finder ShowPathbar  # Specific key
defaults write com.apple.finder ShowPathbar -bool true  # Set value
defaults delete com.apple.finder ShowPathbar  # Reset to default
defaults domains | tr ',' '\n'          # List all domains
```

## Value Types

| Type | Flag | Example |
|------|------|---------|
| Boolean | `-bool` | `-bool true` or `-bool false` |
| Integer | `-int` | `-int 0` or `-int 1` |
| Float | `-float` | `-float 0.5` |
| String | `-string` | `-string "value"` |
| Array | `-array` | `-array item1 item2` |
| Dict | `-dict` | `-dict key1 value1 key2 value2` |

## Common Domains

| Domain | Controls |
|--------|----------|
| `NSGlobalDomain` | System-wide settings |
| `com.apple.finder` | Finder |
| `com.apple.dock` | Dock |
| `com.apple.Safari` | Safari |
| `com.apple.screensaver` | Screen saver |
| `com.apple.loginwindow` | Login window |
| `com.apple.desktopservices` | Desktop services |
| `com.apple.CrashReporter` | Crash reporter |

## System Locations

| Location | Scope | Requires sudo |
|----------|-------|---------------|
| `~/Library/Preferences/` | User | No |
| `/Library/Preferences/` | All users | Yes |

```bash
# User setting
defaults write com.apple.finder ShowPathbar -bool true

# System-wide setting
sudo defaults write /Library/Preferences/com.apple.loginwindow AdminHostInfo HostName
```

## Finder Settings

```bash
# Show path bar at bottom
defaults write com.apple.finder ShowPathbar -bool true

# Show status bar
defaults write com.apple.finder ShowStatusBar -bool true

# Show full POSIX path in title
defaults write com.apple.finder _FXShowPosixPathInTitle -bool true

# Show hidden files
defaults write com.apple.finder AppleShowAllFiles -bool true

# Show all file extensions
defaults write NSGlobalDomain AppleShowAllExtensions -bool true

# Folders on top when sorting
defaults write com.apple.finder _FXSortFoldersFirst -bool true

# Default view style (clmv=column, Nlsv=list, icnv=icon, glyv=gallery)
defaults write com.apple.finder FXPreferredViewStyle -string "clmv"

# Search current folder by default
defaults write com.apple.finder FXDefaultSearchScope -string "SCcf"

# Disable extension change warning
defaults write com.apple.finder FXEnableExtensionChangeWarning -bool false

# Allow text selection in Quick Look
defaults write com.apple.finder QLEnableTextSelection -bool true
```

## Dock Settings

```bash
# Auto-hide Dock
defaults write com.apple.dock autohide -bool true

# Instant auto-hide (no delay)
defaults write com.apple.dock autohide-delay -float 0
defaults write com.apple.dock autohide-time-modifier -float 0.001

# Icon size (pixels)
defaults write com.apple.dock tilesize -int 36

# Show only open apps (no pinned apps)
defaults write com.apple.dock static-only -bool true

# Don't show recent apps
defaults write com.apple.dock show-recents -bool false

# Minimize effect (scale is faster than genie)
defaults write com.apple.dock mineffect -string "scale"

# Minimize to app icon
defaults write com.apple.dock minimize-to-application -bool true

# Don't rearrange Spaces based on recent use
defaults write com.apple.dock mru-spaces -bool false

# Clear all pinned apps
defaults write com.apple.dock persistent-apps -array
```

## Hot Corners

Values: 0=none, 2=Mission Control, 3=App Windows, 4=Desktop, 5=Screen Saver, 6=Disable Screen Saver, 10=Display Sleep, 11=Launchpad, 12=Notification Center, 13=Lock Screen

Modifier: 0=none, 131072=Shift, 262144=Control, 524288=Option, 1048576=Cmd

```bash
# Top-left: Desktop (with Cmd modifier)
defaults write com.apple.dock wvous-tl-corner -int 4
defaults write com.apple.dock wvous-tl-modifier -int 1048576

# Top-right: Desktop (with Cmd modifier)
defaults write com.apple.dock wvous-tr-corner -int 4
defaults write com.apple.dock wvous-tr-modifier -int 1048576

# Bottom-left: Screen saver (with Cmd modifier)
defaults write com.apple.dock wvous-bl-corner -int 5
defaults write com.apple.dock wvous-bl-modifier -int 1048576

# Bottom-right: Display sleep (with Cmd modifier)
defaults write com.apple.dock wvous-br-corner -int 10
defaults write com.apple.dock wvous-br-modifier -int 1048576

# Disable all hot corners
defaults write com.apple.dock wvous-tl-corner -int 0
defaults write com.apple.dock wvous-tr-corner -int 0
defaults write com.apple.dock wvous-bl-corner -int 0
defaults write com.apple.dock wvous-br-corner -int 0
```

## Keyboard Settings

```bash
# Fast key repeat
defaults write NSGlobalDomain KeyRepeat -int 1

# Short delay before repeat
defaults write NSGlobalDomain InitialKeyRepeat -int 10

# Disable press-and-hold (get key repeat instead of accents)
defaults write NSGlobalDomain ApplePressAndHoldEnabled -bool false

# Full keyboard access (Tab through all controls)
defaults write NSGlobalDomain AppleKeyboardUIMode -int 2

# Disable auto-correct
defaults write NSGlobalDomain NSAutomaticSpellingCorrectionEnabled -bool false

# Disable auto-capitalize
defaults write NSGlobalDomain NSAutomaticCapitalizationEnabled -bool false

# Disable smart quotes
defaults write NSGlobalDomain NSAutomaticQuoteSubstitutionEnabled -bool false

# Disable smart dashes
defaults write NSGlobalDomain NSAutomaticDashSubstitutionEnabled -bool false

# Disable period substitution (double-space → period)
defaults write NSGlobalDomain NSAutomaticPeriodSubstitutionEnabled -bool false
```

## System Settings

```bash
# Dark mode
defaults write NSGlobalDomain AppleInterfaceStyle -string "Dark"

# Reduce motion
defaults write com.apple.universalaccess reduceMotion -bool true

# Reduce transparency
defaults write com.apple.universalaccess reduceTransparency -bool true

# Disable crash reporter dialogs
defaults write com.apple.CrashReporter DialogType -string "none"

# Expand save panel by default
defaults write NSGlobalDomain NSNavPanelExpandedStateForSaveMode -bool true
defaults write NSGlobalDomain NSNavPanelExpandedStateForSaveMode2 -bool true

# Save to disk, not iCloud, by default
defaults write NSGlobalDomain NSDocumentSaveNewDocumentsToCloud -bool false

# Disable automatic app termination
defaults write NSGlobalDomain NSDisableAutomaticTermination -bool true
```

## Screen Saver & Lock

```bash
# Disable screen saver
defaults write com.apple.screensaver idleTime -int 0

# Login window screen saver (system-wide)
sudo defaults write /Library/Preferences/com.apple.screensaver loginWindowIdleTime 0

# Don't require password after sleep (less secure)
defaults write com.apple.screensaver askForPassword -int 0
defaults write com.apple.screensaver askForPasswordDelay -int 0
```

## After Making Changes

Most settings require restarting the affected app:

```bash
killall Finder
killall Dock
killall SystemUIServer
```

Some settings require logout or reboot.

## Troubleshooting

### Find the domain for a setting

```bash
# Search all domains for a keyword
defaults read | grep -i "keyword"

# Or use defaults find
defaults find "keyword"
```

### Setting doesn't work

1. Check you're using the right type (`-bool`, `-int`, `-string`)
2. Check the domain exists: `defaults read com.apple.whatever`
3. Restart the affected app
4. Some settings require logout/reboot

### Reset a setting to default

```bash
defaults delete com.apple.finder ShowPathbar
killall Finder
```

## Sources

- `man defaults` (run in Terminal)
- [ss64.com/mac/defaults.html](https://ss64.com/mac/defaults.html)
- [macos-defaults.com](https://macos-defaults.com)
