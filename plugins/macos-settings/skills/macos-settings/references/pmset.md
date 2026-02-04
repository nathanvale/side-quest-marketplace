# pmset — Power Management Settings

`pmset` controls all power/energy settings on macOS. Changes persist across reboots.

## Quick Reference

```bash
pmset -g              # Show current settings
pmset -g custom       # Show all profiles (AC/battery)
pmset -g assertions   # Show what's preventing sleep
pmset -g log          # Show power event history
```

## Common Settings

| Setting | Values | Description |
|---------|--------|-------------|
| `sleep` | minutes or 0 | System sleep timer (0 = never) |
| `displaysleep` | minutes or 0 | Display sleep timer (0 = never) |
| `disksleep` | minutes or 0 | Disk spindown timer (0 = never) |
| `womp` | 0/1 | Wake on Magic Packet (Wake on LAN) |
| `autorestart` | 0/1 | Restart after power failure |
| `powernap` | 0/1 | Power Nap (background updates while sleeping) |
| `tcpkeepalive` | 0/1 | Maintain TCP connections during sleep |
| `proximitywake` | 0/1 | Wake when iPhone nearby (Apple Silicon) |
| `hibernatemode` | 0/3/25 | Hibernation behavior |
| `standby` | 0/1 | Enter standby after sleeping (Apple Silicon) |
| `autopoweroff` | 0/1 | Auto power off after standby |

## Power Source Flags

| Flag | Applies To |
|------|------------|
| `-a` | All power sources |
| `-b` | Battery only |
| `-c` | Charger (AC) only |
| `-u` | UPS only |

## Server Configuration (Prevent All Sleep)

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

## Laptop Configuration (Battery Focused)

```bash
# Aggressive sleep on battery
sudo pmset -b sleep 5
sudo pmset -b displaysleep 2

# Normal sleep on AC
sudo pmset -c sleep 30
sudo pmset -c displaysleep 10

# Disable Power Nap on battery (saves power)
sudo pmset -b powernap 0
sudo pmset -c powernap 1
```

## Hibernation Modes

| Mode | Behavior | Best For |
|------|----------|----------|
| `0` | No hibernation, RAM powered during sleep | Desktops, fast wake |
| `3` | Hibernation + RAM powered (default portable) | Laptops (safe sleep) |
| `25` | Hibernation only, RAM unpowered | Maximum battery, slow wake |

```bash
# Desktop mode (fastest wake)
sudo pmset -a hibernatemode 0

# Laptop default (safe sleep)
sudo pmset -a hibernatemode 3

# Maximum battery (slow wake)
sudo pmset -a hibernatemode 25
```

## Troubleshooting

### Mac keeps waking from sleep

Check what's preventing/causing wake:
```bash
pmset -g assertions    # Active power assertions
pmset -g log | grep -i wake  # Recent wake events
log show --last 1h --predicate 'eventMessage contains "Wake"'
```

### Settings don't persist after reboot

Check for MDM or SIP issues:
```bash
csrutil status              # SIP should be enabled
profiles list               # Check for MDM profiles
```

### pmset changes not taking effect

Some settings require logout/reboot. Also check:
```bash
# Verify the setting was written
pmset -g | grep sleep

# Check if something is overriding
pmset -g assertions
```

## Sequoia vs Tahoe

Both versions use the same pmset commands. No breaking changes identified.

**Tahoe thermal note**: Some M1 Macs run hotter on idle with Tahoe. If experiencing this:
```bash
sudo pmset -a powermode 2  # High Power mode (Tahoe)
```

## Sources

- `man pmset` (run in Terminal)
- [ss64.com/mac/pmset.html](https://ss64.com/mac/pmset.html)
- [Apple Developer: Energy Efficiency Guide](https://developer.apple.com/library/archive/documentation/Performance/Conceptual/power_efficiency_guidelines_osx/)
