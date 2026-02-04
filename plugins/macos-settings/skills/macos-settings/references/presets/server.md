# Server Preset

Headless Mac Mini configuration for 24/7 operation. Optimized for:
- No sleep (always available)
- Remote access (SSH, Screen Sharing, ARD)
- Security (firewall, SSH hardening, Ollama localhost)
- Unattended operation (no dialogs, auto-restart)

## Target Machine
- Mac Mini M4 Pro (or any headless Mac)
- macOS Sequoia (15.x) or Tahoe (26.x)

## Prerequisites
- HDMI dummy dongle for GPU-accelerated Screen Sharing
- Wired Ethernet recommended (especially for Tahoe FileVault unlock)
- Static IP or DHCP reservation

---

## Phase 1: Remote Access (Do First!)

Enable before going headless — this is your lifeline.

```bash
# Enable SSH (Remote Login)
sudo systemsetup -setremotelogin on

# Enable Screen Sharing (VNC)
sudo launchctl load -w /System/Library/LaunchDaemons/com.apple.screensharing.plist

# Enable Remote Management (ARD) — more features than Screen Sharing
sudo /System/Library/CoreServices/RemoteManagement/ARDAgent.app/Contents/Resources/kickstart \
  -activate -configure -access -on -restart -agent -privs -all
```

---

## Phase 2: Hostname

```bash
HOSTNAME="mac-mini-server"  # Change to your preferred name

sudo scutil --set ComputerName "$HOSTNAME"
sudo scutil --set HostName "$HOSTNAME"
sudo scutil --set LocalHostName "$HOSTNAME"
```

---

## Phase 3: Energy (Prevent Sleep)

```bash
# Disable all sleep
sudo pmset -a sleep 0
sudo pmset -a displaysleep 0
sudo pmset -a disksleep 0

# Enable wake/restart features
sudo pmset -a womp 1              # Wake on LAN
sudo pmset -a autorestart 1       # Restart after power failure
sudo pmset -a tcpkeepalive 1      # Keep TCP connections alive

# Disable standby modes (Apple Silicon)
sudo pmset -a standby 0
sudo pmset -a autopoweroff 0
sudo pmset -a hibernatemode 0
sudo pmset -a proximitywake 0     # No wake when iPhone nearby

# Disable Power Nap
sudo pmset -a powernap 0

# Restart on freeze
sudo systemsetup -setrestartfreeze on
```

---

## Phase 4: Security

### Firewall

```bash
# Enable firewall
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --setglobalstate on

# Enable stealth mode (don't respond to pings/probes)
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --setstealthmode on
```

### Disable Automatic Updates (You Control Reboots)

```bash
sudo defaults write /Library/Preferences/com.apple.SoftwareUpdate AutomaticDownload -bool false
sudo defaults write /Library/Preferences/com.apple.SoftwareUpdate AutomaticallyInstallMacOSUpdates -bool false
sudo defaults write /Library/Preferences/com.apple.commerce AutoUpdate -bool false
```

### SSH Hardening (Optional but Recommended)

Edit `/etc/ssh/sshd_config`:
```
PasswordAuthentication no           # Require key-based auth
PermitRootLogin no                  # Never allow root SSH
MaxAuthTries 3                      # Limit brute force
AllowUsers yourusername             # Whitelist specific users
```

Then restart SSH:
```bash
sudo launchctl unload /System/Library/LaunchDaemons/ssh.plist
sudo launchctl load -w /System/Library/LaunchDaemons/ssh.plist
```

---

## Phase 5: Headless UI

### Screensaver

```bash
# Disable screensaver
defaults write com.apple.screensaver idleTime -int 0

# Disable at login window
sudo defaults write /Library/Preferences/com.apple.screensaver loginWindowIdleTime 0

# Show hostname at login window (useful for identifying servers)
sudo defaults write /Library/Preferences/com.apple.loginwindow AdminHostInfo HostName
```

### Bluetooth (Prevent Setup Assistant Hang)

```bash
# Disable auto-seek for keyboard/mouse (prevents hang on headless boot)
sudo defaults write /Library/Preferences/com.apple.Bluetooth BluetoothAutoSeekKeyboard -bool false
sudo defaults write /Library/Preferences/com.apple.Bluetooth BluetoothAutoSeekPointingDevice -bool false

# Optionally disable Bluetooth entirely (if not using HomePods etc.)
# sudo defaults write /Library/Preferences/com.apple.Bluetooth ControllerPowerState -int 0
```

### Crash Reporter

```bash
# Disable crash dialogs (no one to click OK)
defaults write com.apple.CrashReporter DialogType -string "none"
```

---

## Phase 6: Performance

```bash
# Disable Spotlight indexing (saves CPU on server)
sudo mdutil -a -i off

# Reduce visual effects
defaults write com.apple.universalaccess reduceMotion -bool true
defaults write com.apple.universalaccess reduceTransparency -bool true

# Disable Siri/Apple Intelligence
defaults write com.apple.assistant.support "Assistant Enabled" -bool false

# Disable startup sound
defaults write NSGlobalDomain com.apple.sound.beep.feedback -bool false

# Disable App Nap
defaults write NSGlobalDomain NSAppSleepDisabled -bool true

# Disable hot corners (not useful headless)
defaults write com.apple.dock wvous-tl-corner -int 0
defaults write com.apple.dock wvous-tr-corner -int 0
defaults write com.apple.dock wvous-bl-corner -int 0
defaults write com.apple.dock wvous-br-corner -int 0
```

---

## Phase 7: Ollama Security (If Running LLMs)

**CRITICAL:** Ollama binds to `0.0.0.0:11434` by default — anyone on your network can use it.

Add to `~/.zshrc`:
```bash
# Bind to localhost only
export OLLAMA_HOST=127.0.0.1:11434

# Performance settings
export OLLAMA_FLASH_ATTENTION=1
export OLLAMA_KV_CACHE_TYPE=q8_0
export OLLAMA_KEEP_ALIVE=24h
export OLLAMA_DISABLE_TELEMETRY=1
```

---

## Phase 8: OrbStack Auto-Start (If Using Docker)

OrbStack won't start containers without a logged-in user.

**Workaround:**

1. **Enable auto-login:**
   System Settings → Users & Groups → Login Options → Automatic login

2. **Add OrbStack to Login Items:**
   System Settings → General → Login Items → add OrbStack

3. **Create LaunchAgent backup:**
```bash
cat > ~/Library/LaunchAgents/com.orbstack.helper.plist << 'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.orbstack.helper</string>
    <key>ProgramArguments</key>
    <array>
        <string>/Applications/OrbStack.app/Contents/MacOS/OrbStack</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
</dict>
</plist>
EOF
launchctl load ~/Library/LaunchAgents/com.orbstack.helper.plist
```

4. **Graceful shutdown hook** (prevents DB corruption):
```bash
mkdir -p ~/scripts
cat > ~/scripts/docker-shutdown.sh << 'EOF'
#!/bin/bash
cd ~ && docker compose down
EOF
chmod +x ~/scripts/docker-shutdown.sh
```

---

## Apply & Restart

After running all commands:

```bash
# Restart affected apps
killall Dock 2>/dev/null || true
killall SystemUIServer 2>/dev/null || true

echo "Server settings applied. Some changes require reboot."
```

---

## Verification

```bash
# Power
pmset -g | grep -E "sleep|womp|autorestart"

# Remote access
sudo systemsetup -getremotelogin
scutil --get HostName

# Firewall
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --getglobalstate

# Screen saver
defaults read com.apple.screensaver idleTime
```

---

## Revert to Defaults

To undo server settings:

```bash
# Power — restore defaults
sudo pmset restoredefaults

# Screensaver — delete custom setting
defaults delete com.apple.screensaver idleTime

# Firewall — disable
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --setglobalstate off

# Bluetooth — re-enable auto-seek
sudo defaults delete /Library/Preferences/com.apple.Bluetooth BluetoothAutoSeekKeyboard
sudo defaults delete /Library/Preferences/com.apple.Bluetooth BluetoothAutoSeekPointingDevice

# Restart affected apps
killall Dock SystemUIServer
```
