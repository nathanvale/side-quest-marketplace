# Desktop-Dev Preset

Developer workstation configuration. Optimized for:
- Fast keyboard (key repeat, no auto-correct)
- Efficient Finder (paths, extensions, column view, quit with Cmd+Q)
- Minimal Dock (auto-hide, small icons, no clutter)
- Speed (fast animations, no unnecessary effects)
- Better input (trackpad tap-to-click, three-finger drag)
- Quality audio (Bluetooth bitpool optimization)

## Target Machine
- MacBook Pro or desktop Mac for daily development
- macOS Sequoia (15.x) or Tahoe (26.x)

---

## Keyboard — Fast & Code-Friendly

```bash
# Blazingly fast key repeat
defaults write NSGlobalDomain KeyRepeat -int 1
defaults write NSGlobalDomain InitialKeyRepeat -int 10

# Disable press-and-hold (get key repeat instead of accents)
defaults write NSGlobalDomain ApplePressAndHoldEnabled -bool false

# Full keyboard access (Tab through all controls)
defaults write NSGlobalDomain AppleKeyboardUIMode -int 2

# Disable all auto-correct/substitution (annoying when typing code)
defaults write NSGlobalDomain NSAutomaticSpellingCorrectionEnabled -bool false
defaults write NSGlobalDomain NSAutomaticCapitalizationEnabled -bool false
defaults write NSGlobalDomain NSAutomaticQuoteSubstitutionEnabled -bool false
defaults write NSGlobalDomain NSAutomaticDashSubstitutionEnabled -bool false
defaults write NSGlobalDomain NSAutomaticPeriodSubstitutionEnabled -bool false
```

---

## Finder — Developer View

```bash
# Show path bar at bottom
defaults write com.apple.finder ShowPathbar -bool true

# Show status bar
defaults write com.apple.finder ShowStatusBar -bool true

# Show full POSIX path in title bar
defaults write com.apple.finder _FXShowPosixPathInTitle -bool true

# Show all file extensions
defaults write NSGlobalDomain AppleShowAllExtensions -bool true

# Keep folders on top when sorting
defaults write com.apple.finder _FXSortFoldersFirst -bool true

# Column view by default
defaults write com.apple.finder FXPreferredViewStyle -string "clmv"

# Search current folder by default (not entire Mac)
defaults write com.apple.finder FXDefaultSearchScope -string "SCcf"

# Disable extension change warning
defaults write com.apple.finder FXEnableExtensionChangeWarning -bool false

# Allow text selection in Quick Look
defaults write com.apple.finder QLEnableTextSelection -bool true

# Allow quitting Finder with Cmd+Q
defaults write com.apple.finder QuitMenuItem -bool true

# Disable warning when emptying trash
defaults write com.apple.finder WarnOnEmptyTrash -bool false

# New Finder windows open home folder
defaults write com.apple.finder NewWindowTarget -string "PfHm"
defaults write com.apple.finder NewWindowTargetPath -string "file://${HOME}"

# Show external drives on desktop
defaults write com.apple.finder ShowExternalHardDrivesOnDesktop -bool true
defaults write com.apple.finder ShowRemovableMediaOnDesktop -bool true
defaults write com.apple.finder ShowHardDrivesOnDesktop -bool false
defaults write com.apple.finder ShowMountedServersOnDesktop -bool false

# Auto-open mounted volumes
defaults write com.apple.frameworks.diskimages auto-open-ro-root -bool true
defaults write com.apple.frameworks.diskimages auto-open-rw-root -bool true

# Expand info panes by default
defaults write com.apple.finder FXInfoPanesExpanded -dict \
    General -bool true \
    OpenWith -bool true \
    Privileges -bool true
```

---

## Dock — Minimal & Fast

```bash
# Auto-hide dock
defaults write com.apple.dock autohide -bool true

# Instant auto-hide (no delay)
defaults write com.apple.dock autohide-delay -float 0
defaults write com.apple.dock autohide-time-modifier -float 0.001

# Small icon size (16px)
defaults write com.apple.dock tilesize -int 16

# Show only open applications (no pinned apps)
defaults write com.apple.dock static-only -bool true

# Clear all default pinned apps (clean slate)
defaults write com.apple.dock persistent-apps -array

# Don't show recent apps
defaults write com.apple.dock show-recents -bool false

# No launch animation
defaults write com.apple.dock launchanim -bool false

# Scale minimize effect (faster than genie)
defaults write com.apple.dock mineffect -string "scale"

# Minimize to application icon
defaults write com.apple.dock minimize-to-application -bool true

# Show indicator lights for open apps
defaults write com.apple.dock show-process-indicators -bool true

# Make hidden app icons translucent
defaults write com.apple.dock showhidden -bool true

# Highlight hover effect on stacks
defaults write com.apple.dock mouse-over-hilite-stack -bool true

# Spring loading on all dock items
defaults write com.apple.dock enable-spring-load-actions-on-all-items -bool true
```

---

## Spaces & Mission Control

```bash
# Displays have separate Spaces (disabled — spans displays)
defaults write com.apple.spaces spans-displays -bool true

# Don't automatically rearrange Spaces based on recent use
defaults write com.apple.dock mru-spaces -bool false

# Group windows by application in Mission Control
defaults write com.apple.dock expose-group-apps -bool true

# Fast Mission Control animation
defaults write com.apple.dock expose-animation-duration -float 0.1

# Disable Launchpad gesture (Sequoia only — removed in Tahoe)
defaults write com.apple.dock showLaunchpadGestureEnabled -int 0
```

---

## Hot Corners (with Cmd Modifier)

Using Cmd modifier prevents accidental triggers.

```bash
# Top-left: Desktop
defaults write com.apple.dock wvous-tl-corner -int 4
defaults write com.apple.dock wvous-tl-modifier -int 1048576

# Top-right: Desktop
defaults write com.apple.dock wvous-tr-corner -int 4
defaults write com.apple.dock wvous-tr-modifier -int 1048576

# Bottom-left: Screen saver
defaults write com.apple.dock wvous-bl-corner -int 5
defaults write com.apple.dock wvous-bl-modifier -int 1048576

# Bottom-right: Display sleep
defaults write com.apple.dock wvous-br-corner -int 10
defaults write com.apple.dock wvous-br-modifier -int 1048576
```

---

## Window & Dialog Behavior

```bash
# Fast window resize animation
defaults write NSGlobalDomain NSWindowResizeTime -float 0.001

# Disable window opening/closing animations (snappier feel)
defaults write NSGlobalDomain NSAutomaticWindowAnimationsEnabled -bool false

# Expand save panel by default
defaults write NSGlobalDomain NSNavPanelExpandedStateForSaveMode -bool true
defaults write NSGlobalDomain NSNavPanelExpandedStateForSaveMode2 -bool true

# Expand print panel by default
defaults write NSGlobalDomain PMPrintingExpandedStateForPrint -bool true
defaults write NSGlobalDomain PMPrintingExpandedStateForPrint2 -bool true

# Save to disk by default (not iCloud)
defaults write NSGlobalDomain NSDocumentSaveNewDocumentsToCloud -bool false

# Keep windows on resume
defaults write NSGlobalDomain NSQuitAlwaysKeepsWindows -bool true

# Don't auto-terminate inactive apps
defaults write NSGlobalDomain NSDisableAutomaticTermination -bool true

# Enable WebKit developer extras
defaults write NSGlobalDomain WebKitDeveloperExtras -bool true
```

---

## System — Dark Mode & Quality of Life

```bash
# Dark mode
defaults write NSGlobalDomain AppleInterfaceStyle -string "Dark"

# Disable crash reporter dialogs
defaults write com.apple.CrashReporter DialogType -string "none"

# Don't create .DS_Store on network/USB volumes
defaults write com.apple.desktopservices DSDontWriteNetworkStores -bool true
defaults write com.apple.desktopservices DSDontWriteUSBStores -bool true

# Skip disk image verification
defaults write com.apple.frameworks.diskimages skip-verify -bool true
defaults write com.apple.frameworks.diskimages skip-verify-locked -bool true
defaults write com.apple.frameworks.diskimages skip-verify-remote -bool true

# Increase Bluetooth audio quality
defaults write com.apple.BluetoothAudioAgent "Apple Bitpool Min (editable)" -int 48

# Help viewer non-floating
defaults write com.apple.helpviewer DevMode -bool true
```

---

## Activity Monitor

```bash
# Show main window on launch
defaults write com.apple.ActivityMonitor OpenMainWindow -bool true

# Show all processes
defaults write com.apple.ActivityMonitor ShowCategory -int 0

# Sort by CPU usage
defaults write com.apple.ActivityMonitor SortColumn -string "CPUUsage"
defaults write com.apple.ActivityMonitor SortDirection -int 0
```

---

## Safari

```bash
# Blank home page (fast)
defaults write com.apple.Safari HomePage -string "about:blank"

# Don't send search queries to Apple
defaults write com.apple.Safari UniversalSearchEnabled -bool false
defaults write com.apple.Safari SuppressSearchSuggestions -bool true

# Enable continuous spellchecking
defaults write com.apple.Safari WebContinuousSpellCheckingEnabled -bool true

# Disable auto-correct
defaults write com.apple.Safari WebAutomaticSpellingCorrectionEnabled -bool false

# Don't auto-open "safe" downloads
defaults write com.apple.Safari AutoOpenSafeDownloads -bool false
```

---

## Mail

```bash
# Copy email addresses without names
defaults write com.apple.mail AddressesIncludeNameOnPasteboard -bool false
```

---

## Trackpad — Developer Efficiency

```bash
# Enable tap to click (faster than physical click)
defaults write com.apple.driver.AppleBluetoothMultitouch.trackpad Clicking -bool true
defaults -currentHost write NSGlobalDomain com.apple.mouse.tapBehavior -int 1
defaults write NSGlobalDomain com.apple.mouse.tapBehavior -int 1

# Note: Three-finger drag must be enabled in System Settings:
# Accessibility → Pointer Control → Trackpad Options → Dragging style: Three Finger Drag
```

---

## Screenshots — Developer Workflow

```bash
# Save screenshots to ~/Screenshots (create folder first)
mkdir -p ~/Screenshots
defaults write com.apple.screencapture location -string "${HOME}/Screenshots"

# Save as PNG (lossless, better for docs/PRs)
defaults write com.apple.screencapture type -string "png"

# Disable shadow on window screenshots (cleaner for docs)
defaults write com.apple.screencapture disable-shadow -bool true

# Include date in filename
defaults write com.apple.screencapture include-date -bool true
```

---

## Developer Folders & Access

```bash
# Show ~/Library folder (frequently accessed by devs)
chflags nohidden ~/Library

# Show /Volumes in Finder sidebar
# (Useful for external drives, disk images)

# Enable AirDrop over Ethernet (for wired Macs)
defaults write com.apple.NetworkBrowser BrowseAllInterfaces -bool true
```

---

## Apply & Restart

```bash
# Quit System Settings if open
osascript -e 'tell application "System Preferences" to quit' 2>/dev/null || true
osascript -e 'tell application "System Settings" to quit' 2>/dev/null || true

# Restart affected apps
killall Finder
killall Dock
killall SystemUIServer

echo "Desktop-dev settings applied!"
echo "Note: Keyboard repeat requires logout to take effect."
```

---

## Verification

```bash
# Keyboard
defaults read NSGlobalDomain KeyRepeat
defaults read NSGlobalDomain ApplePressAndHoldEnabled

# Finder
defaults read com.apple.finder ShowPathbar
defaults read com.apple.finder _FXShowPosixPathInTitle
defaults read com.apple.finder QuitMenuItem

# Dock
defaults read com.apple.dock autohide
defaults read com.apple.dock tilesize

# Trackpad
defaults read com.apple.driver.AppleBluetoothMultitouch.trackpad Clicking

# Screenshots
defaults read com.apple.screencapture location
defaults read com.apple.screencapture type
defaults read com.apple.screencapture disable-shadow

# Library folder visible
ls -lOd ~/Library | grep -q hidden && echo "Hidden" || echo "Visible"
```

---

## Revert to Defaults

```bash
# Keyboard
defaults delete NSGlobalDomain KeyRepeat
defaults delete NSGlobalDomain InitialKeyRepeat
defaults delete NSGlobalDomain ApplePressAndHoldEnabled

# Finder
defaults delete com.apple.finder ShowPathbar
defaults delete com.apple.finder _FXShowPosixPathInTitle
defaults delete com.apple.finder QuitMenuItem
defaults delete com.apple.finder WarnOnEmptyTrash

# Dock
defaults delete com.apple.dock autohide
defaults delete com.apple.dock tilesize

# Window animations
defaults delete NSGlobalDomain NSAutomaticWindowAnimationsEnabled

# Trackpad
defaults delete com.apple.driver.AppleBluetoothMultitouch.trackpad Clicking
defaults -currentHost delete NSGlobalDomain com.apple.mouse.tapBehavior
defaults delete NSGlobalDomain com.apple.mouse.tapBehavior

# Screenshots
defaults delete com.apple.screencapture location
defaults delete com.apple.screencapture type
defaults delete com.apple.screencapture disable-shadow

# Hide Library folder again
chflags hidden ~/Library

# Restart
killall Finder Dock SystemUIServer
```
