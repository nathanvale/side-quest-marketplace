# Verification — Commands to Confirm Settings

After applying settings, use these commands to verify they took effect.

## Power Settings (pmset)

```bash
# All current settings
pmset -g

# Expected output for server:
# sleep           0
# displaysleep    0
# disksleep       0
# womp            1
# autorestart     1

# Custom settings per power source
pmset -g custom

# Check specific setting
pmset -g | grep sleep
```

## Finder Settings

```bash
# Path bar
defaults read com.apple.finder ShowPathbar
# Expected: 1 (true)

# Status bar
defaults read com.apple.finder ShowStatusBar
# Expected: 1 (true)

# POSIX path in title
defaults read com.apple.finder _FXShowPosixPathInTitle
# Expected: 1 (true)

# Hidden files
defaults read com.apple.finder AppleShowAllFiles
# Expected: 1 (true)

# All Finder settings
defaults read com.apple.finder
```

## Dock Settings

```bash
# Auto-hide
defaults read com.apple.dock autohide
# Expected: 1 (true)

# Icon size
defaults read com.apple.dock tilesize
# Expected: your value (e.g., 36)

# Recent apps
defaults read com.apple.dock show-recents
# Expected: 0 (false)

# Hot corners
defaults read com.apple.dock | grep wvous
```

## Keyboard Settings

```bash
# Key repeat rate
defaults read NSGlobalDomain KeyRepeat
# Expected: 1 (fastest) to 15 (slowest)

# Initial delay
defaults read NSGlobalDomain InitialKeyRepeat
# Expected: 10 (fast) to 120 (slow)

# Press and hold disabled
defaults read NSGlobalDomain ApplePressAndHoldEnabled
# Expected: 0 (false)

# Auto-correct disabled
defaults read NSGlobalDomain NSAutomaticSpellingCorrectionEnabled
# Expected: 0 (false)
```

## Screen Saver & Lock

```bash
# Screen saver idle time
defaults read com.apple.screensaver idleTime
# Expected: 0 (disabled)

# Login window screen saver
sudo defaults read /Library/Preferences/com.apple.screensaver loginWindowIdleTime
# Expected: 0 (disabled)
```

## Remote Access

```bash
# SSH enabled
sudo systemsetup -getremotelogin
# Expected: Remote Login: On

# Screen Sharing enabled
sudo launchctl list | grep screensharing
# Should show the service

# Hostname
scutil --get HostName
scutil --get ComputerName
scutil --get LocalHostName
```

## Bluetooth

```bash
# Auto-seek keyboard disabled
sudo defaults read /Library/Preferences/com.apple.Bluetooth BluetoothAutoSeekKeyboard
# Expected: 0 (false)

# Auto-seek pointing device disabled
sudo defaults read /Library/Preferences/com.apple.Bluetooth BluetoothAutoSeekPointingDevice
# Expected: 0 (false)
```

## Firewall

```bash
# Firewall status
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --getglobalstate
# Expected: Firewall is enabled

# Stealth mode
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --getstealthmode
# Expected: Stealth mode enabled
```

## System

```bash
# macOS version
sw_vers -productVersion

# Dark mode
defaults read NSGlobalDomain AppleInterfaceStyle
# Expected: Dark

# Reduce motion
defaults read com.apple.universalaccess reduceMotion
# Expected: 1 (true) for server/minimal

# Crash reporter
defaults read com.apple.CrashReporter DialogType
# Expected: none
```

## Automatic Updates

```bash
# Auto-download disabled
sudo defaults read /Library/Preferences/com.apple.SoftwareUpdate AutomaticDownload
# Expected: 0 (false)

# Auto-install disabled
sudo defaults read /Library/Preferences/com.apple.SoftwareUpdate AutomaticallyInstallMacOSUpdates
# Expected: 0 (false)
```

## Full Verification Script

Run this after applying a preset to verify all settings:

```bash
#!/bin/bash
echo "=== Power Settings ==="
pmset -g | grep -E "sleep|womp|autorestart|powernap"

echo ""
echo "=== Remote Access ==="
sudo systemsetup -getremotelogin 2>/dev/null || echo "Check manually"
sudo launchctl list 2>/dev/null | grep -q screensharing && echo "Screen Sharing: On" || echo "Screen Sharing: Off"

echo ""
echo "=== Finder ==="
echo "ShowPathbar: $(defaults read com.apple.finder ShowPathbar 2>/dev/null || echo 'not set')"
echo "ShowAllFiles: $(defaults read com.apple.finder AppleShowAllFiles 2>/dev/null || echo 'not set')"

echo ""
echo "=== Dock ==="
echo "autohide: $(defaults read com.apple.dock autohide 2>/dev/null || echo 'not set')"
echo "tilesize: $(defaults read com.apple.dock tilesize 2>/dev/null || echo 'not set')"

echo ""
echo "=== Keyboard ==="
echo "KeyRepeat: $(defaults read NSGlobalDomain KeyRepeat 2>/dev/null || echo 'not set')"
echo "ApplePressAndHoldEnabled: $(defaults read NSGlobalDomain ApplePressAndHoldEnabled 2>/dev/null || echo 'not set')"

echo ""
echo "=== Firewall ==="
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --getglobalstate 2>/dev/null || echo "Check manually"

echo ""
echo "=== System ==="
echo "macOS: $(sw_vers -productVersion)"
echo "Hostname: $(scutil --get HostName 2>/dev/null || hostname)"
```
