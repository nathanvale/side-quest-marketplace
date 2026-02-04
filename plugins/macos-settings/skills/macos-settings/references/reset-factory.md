# Factory Reset — Restore macOS to Out-of-Box State

How to completely reset a Mac to factory settings, as if it just came out of the box.

## Quick Reference

| Method | When to Use | Keeps macOS? | Requires |
|--------|-------------|--------------|----------|
| Erase All Content and Settings | Quick reset, same macOS version | ✓ Yes | Apple Silicon or T2 chip, Monterey+ |
| Recovery Mode + Disk Utility | Full wipe, reinstall macOS | ✗ No | Any Mac |
| Internet Recovery | Disk corrupted, no local recovery | ✗ No | Internet connection |

---

## Method 1: Erase All Content and Settings (Recommended)

**Requirements:**
- Apple Silicon (M1/M2/M3/M4) OR Intel Mac with T2 Security Chip
- macOS Monterey (12.0) or later

This is the fastest method — keeps macOS installed, wipes everything else.

### GUI Method

**Sequoia (15.x) / Tahoe (26.x):**
```
System Settings → General → Transfer or Reset → Erase All Content and Settings
```

**Monterey / Ventura / Sonoma:**
```
System Preferences → Erase All Content and Settings (in menu bar under System Preferences)
```

### What It Erases

- All user accounts and data
- All apps (except built-in macOS apps)
- All settings and preferences
- Touch ID fingerprints
- Apple Pay cards
- Activation Lock (signs out of iCloud)

### What It Keeps

- macOS (current version stays installed)
- System apps (Safari, Mail, etc.)
- Recovery partition

### Command Line (Enterprise Only)

**Note:** CLI access requires MDM enrollment. Not available for standalone Macs.

```bash
# Check if available (must be MDM enrolled)
which erase-install

# MDM can trigger via:
# - Jamf Pro: "Erase Device" MDM command
# - Other MDM: Send EraseDevice command
```

---

## Method 2: Recovery Mode + Disk Utility (Any Mac)

For Macs without T2 chip, or when you want to reinstall macOS fresh.

### Step 1: Boot to Recovery Mode

**Apple Silicon (M1/M2/M3/M4):**
1. Shut down completely
2. Press and hold power button until "Loading startup options" appears
3. Select "Options" → Continue

**Intel Mac:**
1. Restart
2. Immediately hold `Cmd + R` until Apple logo appears

**Intel Mac (Internet Recovery):**
- `Cmd + Option + R` — Latest compatible macOS
- `Shift + Cmd + Option + R` — Original macOS that came with Mac

### Step 2: Erase the Disk

1. Select **Disk Utility** from Recovery menu
2. Click **View** → **Show All Devices**
3. Select the top-level disk (e.g., "Apple SSD" not "Macintosh HD")
4. Click **Erase**
5. Settings:
   - **Name:** Macintosh HD
   - **Format:** APFS
   - **Scheme:** GUID Partition Map
6. Click **Erase**

### Step 3: Reinstall macOS

1. Quit Disk Utility
2. Select **Reinstall macOS [version]**
3. Follow prompts
4. Wait for installation (30-60 minutes)

### Terminal Method (From Recovery)

If Disk Utility fails, use Terminal from Recovery:

```bash
# Open Terminal from Utilities menu in Recovery

# List all disks
diskutil list

# Find your internal disk (usually disk0 or disk3 on Apple Silicon)
# Look for "internal, physical" or "synthesized"

# Erase entire disk (DESTROYS ALL DATA)
diskutil eraseDisk APFS "Macintosh HD" GPT disk0

# For Apple Silicon with multiple internal volumes:
diskutil apfs deleteContainer disk3
diskutil eraseDisk APFS "Macintosh HD" GPT disk0
```

---

## Method 3: Secure Erase (Before Selling)

Modern SSDs with T2/Apple Silicon use hardware encryption. "Erase All Content and Settings" destroys the encryption key, making data unrecoverable.

For older Macs without T2:

```bash
# From Recovery Terminal - secure erase (slower)
diskutil secureErase 0 disk0

# Levels:
# 0 = Single-pass zeros
# 1 = Single-pass random
# 2 = 7-pass (DoD 5220.22-M)
# 3 = 35-pass (Gutmann)
```

**Note:** Secure erase on SSDs is often unnecessary due to TRIM and wear leveling. Hardware encryption (T2/Apple Silicon) is more effective.

---

## Pre-Reset Checklist

Before factory resetting:

1. [ ] **Backup data** — Time Machine, iCloud, or manual copy
2. [ ] **Sign out of iCloud** — System Settings → Apple ID → Sign Out
3. [ ] **Sign out of iMessage** — Messages → Settings → iMessage → Sign Out
4. [ ] **Deauthorize apps** — iTunes/Music, Adobe, etc.
5. [ ] **Unpair Bluetooth** — Remove Bluetooth devices
6. [ ] **Note network settings** — WiFi passwords, VPN configs
7. [ ] **Export passwords** — Keychain, 1Password export

### Sign Out of Everything

```bash
# Check iCloud status (should show "not signed in" after logout)
defaults read MobileMeAccounts

# List Find My status (should be disabled)
nvram -p | grep fmm-mobileme-token-FMM
```

---

## Troubleshooting

### "Erase All Content and Settings" Not Available

**Causes:**
1. Mac doesn't have T2/Apple Silicon
2. macOS older than Monterey
3. FileVault still encrypting/decrypting

**Solution:** Use Recovery Mode + Disk Utility method instead.

### Disk Utility Won't Erase

**Cause:** Disk is mounted or in use.

**Solution from Recovery Terminal:**
```bash
# Force unmount
diskutil unmountDisk force disk0

# Then erase
diskutil eraseDisk APFS "Macintosh HD" GPT disk0
```

### Activation Lock After Reset

If Mac asks for previous owner's Apple ID after reset:

1. Previous owner must remove from iCloud: icloud.com → Find My → Remove device
2. Or: Contact Apple Support with proof of purchase

### Recovery Mode Not Working

**Apple Silicon:**
- Try holding power button longer (10+ seconds)
- Try DFU mode: Connect to another Mac with Apple Configurator 2

**Intel:**
- Reset NVRAM: `Cmd + Option + P + R` at boot
- Try Internet Recovery: `Cmd + Option + R`

---

## Version-Specific Notes

### Tahoe (26.x)

- Liquid Glass UI in Settings
- Same "Erase All Content and Settings" location
- FileVault remote unlock via SSH (helps with remote reset)

### Sequoia (15.x)

- System Settings → General → Transfer or Reset
- "Erase All Content and Settings" in submenu

### Older Versions

| Version | Method |
|---------|--------|
| Sonoma (14.x) | System Settings → General → Transfer or Reset |
| Ventura (13.x) | System Settings → General → Transfer or Reset |
| Monterey (12.x) | System Preferences menu bar → Erase All Content |
| Big Sur and earlier | Recovery Mode only |

---

## Automation (Enterprise)

For IT/MDM environments:

### Jamf Pro

```bash
# Send MDM command
jamf eraseDevice

# Or via Jamf Pro console:
# Computers → [select Mac] → Management → Erase Device
```

### Apple Business Manager / Configurator

1. Device must be supervised
2. Send "Erase All Content and Settings" MDM command
3. Device resets and re-enrolls automatically (if DEP enabled)

### Scripts (Pre-Reset Prep)

```bash
#!/bin/bash
# pre-reset-prep.sh — Run before factory reset

echo "=== Pre-Reset Checklist ==="

# Sign out of iCloud (requires user interaction)
echo "1. Sign out of iCloud manually in System Settings"

# Deauthorize computer
echo "2. Deauthorize in Music/iTunes if needed"

# Check FileVault status
if fdesetup status | grep -q "On"; then
    echo "⚠️  FileVault is ON — disable before reset or use 'Erase All Content'"
fi

# Check Find My status
if nvram -p 2>/dev/null | grep -q "fmm-mobileme"; then
    echo "⚠️  Find My Mac is ON — sign out of iCloud first"
fi

# Backup reminder
echo ""
echo "3. Ensure you have backups:"
echo "   - Time Machine: $(tmutil listbackups 2>/dev/null | tail -1 || echo 'No backups found')"

echo ""
echo "Ready to reset? Use System Settings → Erase All Content and Settings"
```

---

## Quick Commands Reference

```bash
# Check Mac model (T2/Apple Silicon?)
system_profiler SPHardwareDataType | grep -E "Model|Chip"

# Check macOS version
sw_vers -productVersion

# Check FileVault status
fdesetup status

# Check iCloud signed in
defaults read MobileMeAccounts 2>/dev/null | grep -q AccountID && echo "Signed in" || echo "Not signed in"

# List disks (for Recovery Terminal)
diskutil list

# Erase disk (FROM RECOVERY ONLY)
diskutil eraseDisk APFS "Macintosh HD" GPT disk0
```
