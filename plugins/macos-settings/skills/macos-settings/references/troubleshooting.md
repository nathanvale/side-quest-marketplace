# Troubleshooting — Common Issues & Fixes

## Settings Not Applying

### Symptom: defaults write doesn't change anything

**Causes & Fixes:**

1. **App not restarted**
   ```bash
   killall Finder  # or Dock, SystemUIServer, Safari, etc.
   ```

2. **Wrong value type**
   ```bash
   # Wrong
   defaults write com.apple.finder ShowPathbar true

   # Right
   defaults write com.apple.finder ShowPathbar -bool true
   ```

3. **App overwriting on quit**
   Some apps write preferences on quit. Change settings while app is closed, or quit without saving.

4. **Sandboxed app**
   Some App Store apps use containers. Check:
   ```bash
   ls ~/Library/Containers/
   ```

### Symptom: pmset changes don't persist

**Causes & Fixes:**

1. **MDM profile overriding**
   ```bash
   profiles list  # Check for corporate profiles
   ```

2. **SIP issue** (rare)
   ```bash
   csrutil status  # Should show "enabled"
   ```

3. **Forgot sudo**
   ```bash
   sudo pmset -a sleep 0  # Must use sudo
   ```

## Sleep Issues

### Mac keeps waking from sleep

```bash
# Check what's waking it
pmset -g log | grep -i wake | tail -20

# Check active power assertions
pmset -g assertions

# Check wake schedule
pmset -g sched
```

Common culprits:
- `Wake on LAN`: `sudo pmset -a womp 0`
- `Power Nap`: `sudo pmset -a powernap 0`
- `Proximity Wake`: `sudo pmset -a proximitywake 0`

### Mac won't sleep

```bash
# Check what's preventing sleep
pmset -g assertions
```

Look for `PreventUserIdleSystemSleep`. Common causes:
- Background processes (Activity Monitor → Energy tab)
- caffeinate running
- Network shares mounted
- Bluetooth devices connected

### Mac sleeps despite caffeinate

```bash
# Verify caffeinate is running
pgrep caffeinate

# Check its assertion is active
pmset -g assertions | grep caffeinate
```

## Remote Access Issues

### Can't SSH after reboot (FileVault)

**Sequoia:** FileVault blocks SSH until password entered at console. Options:
1. Disable FileVault: `sudo fdesetup disable`
2. Keep a monitor connected
3. Upgrade to Tahoe

**Tahoe:** Use pre-login SSH unlock (requires wired Ethernet):
```bash
# From remote machine
ssh user@mac-mini
# Enter FileVault password at pre-login prompt
```

### Screen Sharing is slow/laggy

**Cause:** No HDMI connected = software rendering

**Fix:** Use HDMI dummy dongle (~$10). Forces GPU rendering.

### Can't connect via VNC

1. **Check Screen Sharing is enabled:**
   ```bash
   sudo launchctl list | grep screensharing
   ```

2. **Enable if not:**
   ```bash
   sudo launchctl load -w /System/Library/LaunchDaemons/com.apple.screensharing.plist
   ```

3. **Check firewall:**
   ```bash
   sudo /usr/libexec/ApplicationFirewall/socketfilterfw --listapps
   ```

## Docker/OrbStack Issues

### Containers don't start after reboot

OrbStack requires a logged-in user session.

**Fix:**
1. Enable auto-login: System Settings → Users & Groups → Login Options
2. Add OrbStack to Login Items
3. Create LaunchAgent backup (see server preset)

### OrbStack shows "Docker engine is off"

Click "Turn On" in OrbStack menu bar, or:
```bash
orb start
```

To prevent: Add OrbStack to Login Items.

### Database corruption after macOS restart

OrbStack doesn't gracefully stop containers on shutdown.

**Fix:** Add shutdown hook:
```bash
#!/bin/bash
# Save as ~/scripts/docker-shutdown.sh
cd ~ && docker compose down
```

Add to logout hooks or run before restart.

## Finder Issues

### Finder settings reset after reboot

Some Finder settings require both user and system defaults:
```bash
defaults write com.apple.finder ShowPathbar -bool true
killall Finder
```

If still resetting, check for corporate MDM profiles.

### Hidden files not showing

```bash
defaults write com.apple.finder AppleShowAllFiles -bool true
killall Finder
```

Press `Cmd+Shift+.` to toggle in Finder.

## Dock Issues

### Dock keeps resetting

1. Check for conflicting settings:
   ```bash
   defaults read com.apple.dock
   ```

2. Delete all Dock preferences and restart:
   ```bash
   defaults delete com.apple.dock
   killall Dock
   ```

### Hot corners not working

1. Check they're set:
   ```bash
   defaults read com.apple.dock | grep wvous
   ```

2. Check modifier isn't conflicting with other shortcuts

3. Restart Dock:
   ```bash
   killall Dock
   ```

## Keyboard Issues

### Key repeat not working

1. Disable press-and-hold:
   ```bash
   defaults write NSGlobalDomain ApplePressAndHoldEnabled -bool false
   ```

2. Set repeat rate:
   ```bash
   defaults write NSGlobalDomain KeyRepeat -int 1
   defaults write NSGlobalDomain InitialKeyRepeat -int 10
   ```

3. **Logout required** (not just app restart)

## Diagnostic Commands

```bash
# System info
sw_vers                          # macOS version
system_profiler SPSoftwareDataType  # Detailed system info

# Power
pmset -g                         # Current power settings
pmset -g assertions              # What's preventing sleep
pmset -g log | tail -50          # Recent power events

# Defaults
defaults read com.apple.finder   # All Finder settings
defaults find "keyword"          # Search all domains

# Processes
ps aux | grep -i "process"       # Find running processes
lsof -i :5900                    # What's using VNC port

# Network
scutil --get HostName            # Hostname
networksetup -listallhardwareports  # Network interfaces
```
