---
name: macos-settings
description: Expert guidance for configuring macOS settings via CLI (pmset, defaults, scutil, caffeinate). Covers Sequoia (15.x) and Tahoe (26.x) with presets for server, desktop-dev, minimal, and presentation modes. Can apply presets, reset to defaults, factory reset guidance, export scripts, and research unknown settings from official sources.
---

# macOS Settings Expert

Configure macOS via CLI instead of System Settings. Supports Sequoia (15.x) and Tahoe (26.x).

## Capabilities

| Action | What It Does |
|--------|--------------|
| **Answer questions** | "How do I disable sleep?" → pmset command with explanation |
| **Apply preset** | Run all commands for a profile (server, desktop-dev, etc.) |
| **Reset to defaults** | Undo customizations with `defaults delete` |
| **Factory reset** | Guide through "Erase All Content and Settings" or Recovery Mode |
| **Export script** | Generate shell script for dotfiles |
| **Compare presets** | Show differences between profiles |
| **Research unknown** | Search Apple docs when answer isn't in references |

## Available Presets

| Preset | Use Case | Key Settings |
|--------|----------|--------------|
| `server` | Headless Mac Mini | No sleep, SSH, firewall, Ollama security |
| `desktop-dev` | Developer workstation | Fast keys, Finder paths, Dock auto-hide |
| `minimal` | Battery-focused laptop | Aggressive sleep, reduced motion |
| `presentation` | Meetings/demos | caffeinate, no notifications |

## Workflow

### 1. Detect macOS Version

Before applying any settings, detect the version:

```bash
sw_vers -productVersion
```

- **15.x** = Sequoia
- **26.x** = Tahoe

Some settings differ between versions. Skip deprecated settings silently.

### 2. Answer Questions

**Check references first** — read the relevant file from `references/`:

| Topic | Reference File |
|-------|----------------|
| Power/sleep/wake | [pmset.md](references/pmset.md) |
| defaults write patterns | [defaults.md](references/defaults.md) |
| Temporary sleep prevention | [caffeinate.md](references/caffeinate.md) |
| Version differences | [gotchas.md](references/gotchas.md) |
| Common problems | [troubleshooting.md](references/troubleshooting.md) |
| Verify settings worked | [verification.md](references/verification.md) |
| Factory reset to out-of-box | [reset-factory.md](references/reset-factory.md) |

### 3. Apply Presets

When user asks to apply a preset:

1. **Show what will change** — list the commands
2. **Confirm** — "This will run X commands and restart Finder/Dock. Proceed?"
3. **Execute** — run each command
4. **Restart affected apps** — `killall Finder Dock SystemUIServer`
5. **Verify** — run verification commands

Preset files are in `references/presets/`:
- [server.md](references/presets/server.md)
- [desktop-dev.md](references/presets/desktop-dev.md)
- [minimal.md](references/presets/minimal.md)
- [presentation.md](references/presets/presentation.md)

### 4. Reset to Defaults

To reset a specific domain:
```bash
defaults delete com.apple.finder ShowPathbar
```

To reset all settings from a preset, delete each key that was set.

Always restart affected apps after reset:
```bash
killall Finder Dock SystemUIServer
```

### 5. Export Scripts

When user wants a script for dotfiles:

1. Generate the script with header comment (version, date, preset name)
2. Include verification commands at the end
3. Offer to:
   - Copy to clipboard
   - Write to specified path
   - Show in response

### 6. Research Unknown Settings

If a question isn't covered in reference docs:

1. **Acknowledge**: "I don't have that in my references. Let me check..."
2. **Search trusted sources**:
   - `site:support.apple.com` — Official Apple docs
   - `site:developer.apple.com` — Technical details
   - `site:ss64.com/mac` — Man pages (pmset, defaults)
   - `site:osxdaily.com` — Tutorials
   - `site:eclecticlight.co` — Deep macOS internals
3. **Cite the source**: Always show where you found it
4. **Offer to add**: "Want me to remember this for next time?"

**Never guess** at defaults write commands — wrong values can break things.

## Response Guidelines

- **Always show the command** — users should see exactly what will run
- **Explain what it does** — not just the command, but the effect
- **Warn about side effects** — "This requires Finder restart"
- **Cite sources** — reference file or URL where you found it
- **Version-aware** — note if a setting only works on Sequoia or Tahoe

## Examples

### Example 1: Question

```
User: How do I make my Mac never sleep?

Skill: [Reads references/pmset.md]

For permanent sleep prevention (survives reboot):

sudo pmset -a sleep 0          # System sleep: never
sudo pmset -a displaysleep 0   # Display sleep: never
sudo pmset -a disksleep 0      # Disk sleep: never

For temporary prevention (while a command runs):

caffeinate -i my-long-running-script.sh

The -a flag applies to all power sources (AC + battery).
Verify with: pmset -g

Source: references/pmset.md
```

### Example 2: Apply Preset

```
User: Switch to server preset

Skill: [Reads references/presets/server.md]

Server preset will apply 25+ settings:

**Remote Access:**
- Enable SSH (systemsetup -setremotelogin on)
- Enable Screen Sharing
- Enable Remote Management (ARD)

**Energy:**
- Disable all sleep (pmset -a sleep 0)
- Wake on LAN enabled
- Auto-restart after power failure

**Security:**
- Firewall enabled with stealth mode
- Automatic updates disabled (you control reboots)

**Headless UI:**
- Screensaver disabled
- Bluetooth Setup Assistant disabled
- Crash reporter dialogs disabled

This will restart Finder, Dock, and SystemUIServer.

Proceed? [y/n]
```

### Example 3: Export Script

```
User: Export desktop-dev preset to my dotfiles

Skill: [Generates script from references/presets/desktop-dev.md]

Written to: ~/code/dotfiles/config/macos/presets/desktop-dev.sh

The script includes:
- 47 defaults write commands
- Verification commands at the end
- Header with generation date and macOS version

Run with: ./desktop-dev.sh
```

### Example 4: Research Unknown

```
User: How do I disable the new Liquid Glass transparency in Tahoe?

Skill: I don't have that in my references. Let me check...

[WebSearch: "macOS Tahoe disable Liquid Glass transparency defaults write site:apple.com"]

Found it! On Tahoe 26.x, you can reduce Liquid Glass effects:

System Settings > Accessibility > Display > Reduce Transparency

Or via CLI:
defaults write com.apple.universalaccess reduceTransparency -bool true

This is the same setting that worked in Sequoia — Apple kept compatibility.

Source: discussions.apple.com/thread/256136125

Want me to add this to the desktop-dev preset?
```

### Example 5: Factory Reset

```
User: I want to wipe this Mac and start fresh

Skill: [Reads references/reset-factory.md]

I'll help you factory reset your Mac. First, let me check your system:

[Runs: system_profiler SPHardwareDataType | grep -E "Model|Chip"]
[Runs: sw_vers -productVersion]

You have an M4 Mac running Tahoe 26.x — perfect, you can use the easy method.

**Recommended: "Erase All Content and Settings"**

This wipes all data but keeps macOS installed. Fastest option.

**Before you begin:**
1. Backup important data (Time Machine, iCloud, or manual)
2. Sign out of iCloud: System Settings → Apple ID → Sign Out
3. Deauthorize apps if needed (Adobe, etc.)

**To reset:**
System Settings → General → Transfer or Reset → Erase All Content and Settings

The Mac will restart and show the setup assistant, like out of the box.

**Alternative: Full wipe via Recovery Mode**
If you want to also reinstall macOS fresh:
1. Shut down, hold power button until "Options" appears
2. Select Options → Disk Utility → Erase "Macintosh HD"
3. Quit Disk Utility → Reinstall macOS

Which method would you like to use?
```

## Allowed Tools

This skill can use:
- `Read` — to read reference files
- `Bash` — to run defaults/pmset commands and detect macOS version
- `WebSearch` — to research unknown settings
- `WebFetch` — to scrape Apple documentation
- `Write` — to export scripts to files