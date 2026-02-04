# Gotchas — Version Differences & Breaking Changes

Known differences between macOS Sequoia (15.x) and Tahoe (26.x), plus common pitfalls.

## Sequoia vs Tahoe

### UI Changes

| Feature | Sequoia (15.x) | Tahoe (26.x) |
|---------|----------------|--------------|
| Design language | Standard macOS | Liquid Glass |
| Launchpad | Available | **Removed** (use Applications folder) |
| System Settings | Standard layout | Reorganized with Liquid Glass |
| Finder columns | Normal | Horizontal scroller covers resize widget |

### Settings That Differ

| Setting | Sequoia | Tahoe | Notes |
|---------|---------|-------|-------|
| `showLaunchpadGestureEnabled` | Works | **No-op** | Launchpad removed |
| FileVault remote unlock | Not available | SSH pre-login server | Tahoe feature |
| Reduce Transparency | Works | Works | Same command, reduces Liquid Glass |

### Tahoe-Specific Issues

**Thermal/Idle Issues**
Some M1 Macs run hotter on idle with Tahoe vs Sequoia. Workaround:
```bash
sudo pmset -a powermode 2  # High Power mode
```

**Finder Column View Bug**
The horizontal scroller covers column resize widgets. No CLI fix — Apple bug.

## Common Pitfalls

### 1. Using wrong value type

**Wrong:**
```bash
defaults write com.apple.finder ShowPathbar true
```

**Right:**
```bash
defaults write com.apple.finder ShowPathbar -bool true
```

Always specify the type flag (`-bool`, `-int`, `-string`, `-float`).

### 2. Forgetting to restart apps

Settings don't apply until the app restarts:

```bash
defaults write com.apple.finder ShowPathbar -bool true
killall Finder  # Required!
```

### 3. User vs system-wide settings

User settings:
```bash
defaults write com.apple.finder ShowPathbar -bool true
```

System-wide (requires sudo, affects all users):
```bash
sudo defaults write /Library/Preferences/com.apple.loginwindow AdminHostInfo HostName
```

### 4. caffeinate memory leak

Repeated caffeinate calls leak ~12KB each:

**Bad:**
```bash
while true; do caffeinate -t 60; done
```

**Good:**
```bash
caffeinate -i ./my-script.sh
```

### 5. OrbStack headless auto-start

OrbStack won't start containers without a logged-in user session. Workaround:
1. Enable auto-login
2. Add OrbStack to Login Items
3. Create LaunchAgent as backup

See [server preset](presets/server.md) for full solution.

### 6. SSH without display

When SSHing into a Mac, use `-i` not `-d` with caffeinate:

```bash
# Good (no display on SSH)
caffeinate -i -t 7200

# Useless (no display exists)
caffeinate -d -t 7200
```

### 7. HDMI dongle for GPU

Headless Macs without HDMI connected use software rendering for Screen Sharing — very slow. An HDMI dummy dongle ($10) forces GPU rendering.

### 8. Bluetooth Setup Assistant hang

On headless boot, macOS shows "Bluetooth Setup Assistant" dialog if no keyboard detected. The Mac hangs waiting for input.

**Fix:**
```bash
sudo defaults write /Library/Preferences/com.apple.Bluetooth BluetoothAutoSeekKeyboard -bool false
sudo defaults write /Library/Preferences/com.apple.Bluetooth BluetoothAutoSeekPointingDevice -bool false
```

### 9. FileVault blocks headless reboot

**Sequoia:** Can't SSH until someone types the FileVault password. Consider disabling FileVault for headless servers.

**Tahoe:** Pre-login SSH server allows remote unlock. Requires wired Ethernet (WiFi Keychain not available at boot).

### 10. Ollama binds to 0.0.0.0

By default, Ollama listens on all interfaces — anyone on your network can use your LLM.

**Fix:**
```bash
export OLLAMA_HOST=127.0.0.1:11434  # Add to ~/.zshrc
```

### 11. pmset settings revert

If pmset changes don't stick:
1. Check SIP: `csrutil status` (should be enabled)
2. Check MDM: `profiles list` (corporate Macs may override)
3. Reboot and check again: `pmset -g`

### 12. Hot corners with modifier don't work

The modifier value changed format at some point. Use these values:
- 0 = None
- 131072 = Shift
- 262144 = Control
- 524288 = Option
- 1048576 = Cmd

### 13. Automatic updates override your settings

Even with auto-updates disabled, macOS may still download updates. Disable completely:

```bash
sudo defaults write /Library/Preferences/com.apple.SoftwareUpdate AutomaticDownload -bool false
sudo defaults write /Library/Preferences/com.apple.SoftwareUpdate AutomaticallyInstallMacOSUpdates -bool false
sudo defaults write /Library/Preferences/com.apple.commerce AutoUpdate -bool false
```

## Version Detection

Before applying settings, detect the macOS version:

```bash
VERSION=$(sw_vers -productVersion)
MAJOR=$(echo $VERSION | cut -d. -f1)

if [[ "$MAJOR" == "15" ]]; then
    echo "Sequoia"
elif [[ "$MAJOR" == "26" ]]; then
    echo "Tahoe"
fi
```

Use this to skip deprecated settings (like Launchpad gesture on Tahoe).
