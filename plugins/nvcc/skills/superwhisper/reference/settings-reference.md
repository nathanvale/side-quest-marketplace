# SuperWhisper Settings Reference

**✅ VERIFIED FORMAT** - Based on actual SuperWhisper files.

## Important: Where Settings Are Stored

SuperWhisper stores configuration in **three places**:

1. **`~/Documents/superwhisper/settings/settings.json`** - Global app settings (verified below)
2. **`~/Documents/superwhisper/modes/*.json`** - Individual mode configurations (see
   custom-modes.md)
3. **`~/Library/Preferences/com.superduper.superwhisper.plist`** - UI preferences (keyboard
   shortcuts, window position, etc.)

**Recommended**:

- Use SuperWhisper's UI (Settings menu) for most configuration
- Only edit JSON files if you know what you're doing
- Always back up before editing

## Settings File Location

**Path**: `~/Documents/superwhisper/settings/settings.json`

**How to Edit**:

```bash
# Open in your default text editor
open ~/Documents/superwhisper/settings/settings.json

# Or edit directly with VS Code
code ~/Documents/superwhisper/settings/settings.json
```

**Backup Before Editing**:

```bash
# Create timestamped backup
cp ~/Documents/superwhisper/settings/settings.json \
   ~/Documents/superwhisper/settings/settings.json.backup-$(date +%Y%m%d-%H%M%S)

# Or backup entire SuperWhisper directory
cp -r ~/Documents/superwhisper ~/Backups/superwhisper-$(date +%Y%m%d)
```

**Restore from Backup**:

```bash
# List backups
ls -lt ~/Documents/superwhisper/settings/settings.json.backup-*

# Restore specific backup
cp ~/Documents/superwhisper/settings/settings.json.backup-20250108-143000 \
   ~/Documents/superwhisper/settings/settings.json

# Restart SuperWhisper
killall -9 superwhisper && sleep 2 && open -a SuperWhisper
```

---

## Actual settings.json Format (Verified)

**Structure**:

```json
{
  "modeKeys": ["default", "melanie", "custom-mode-key"],
  "replacements": [
    {
      "from": "gee pee tee",
      "to": "GPT"
    }
  ],
  "vocabulary": ["Kubernetes", "TypeScript", "Anthropic"]
}
```

### Field Descriptions

| Field          | Type             | Description                                                |
| -------------- | ---------------- | ---------------------------------------------------------- |
| `modeKeys`     | array of strings | List of mode keys (matches `key` field in mode JSON files) |
| `replacements` | array of objects | Text replacements applied after transcription              |
| `vocabulary`   | array of strings | Custom vocabulary terms for better recognition             |

### modeKeys

**Purpose**: Tracks which modes exist in your `~/Documents/superwhisper/modes/` directory.

**Format**:

```json
{
  "modeKeys": ["default", "email", "code-review", "obsidian-quick"]
}
```

**Notes**:

- Automatically updated when you create/delete modes in the UI
- Must match the `key` field in each mode's JSON file
- Order doesn't matter

### replacements

**Purpose**: Find-and-replace text transformations applied after voice transcription, before AI
processing.

**Format**:

```json
{
  "replacements": [
    {
      "from": "react jay ess",
      "to": "React.js"
    },
    {
      "from": "gee pee tee",
      "to": "GPT"
    }
  ]
}
```

**Usage**:

- Applied to all modes
- Case-sensitive matching
- Useful for technical terms often misheard
- Alternative to custom vocabulary (replacements are more flexible)

**Example Replacements**:

```json
{
  "replacements": [
    { "from": "kubernetes", "to": "Kubernetes" },
    { "from": "type script", "to": "TypeScript" },
    { "from": "view jay ess", "to": "Vue.js" },
    { "from": "anthropic", "to": "Anthropic" },
    { "from": "claude", "to": "Claude" }
  ]
}
```

### vocabulary

**Purpose**: Custom vocabulary terms to improve voice recognition accuracy.

**Format**:

```json
{
  "vocabulary": ["Kubernetes", "TypeScript", "GraphQL", "Anthropic", "Claude", "Next.js"]
}
```

**Usage**:

- One term per array element
- Applied during voice processing (before AI)
- Helps recognize technical terms, product names, proper nouns
- Case-sensitive

**Best Practices**:

- Add frequently misheard technical terms
- Include both variations if applicable ("Kubernetes" and "kubernetes")
- Add acronyms and abbreviations
- Keep list focused (too many terms can decrease accuracy)

**Example Vocabulary Lists**:

**For Software Development**:

```json
{
  "vocabulary": [
    "React",
    "TypeScript",
    "JavaScript",
    "Python",
    "Kubernetes",
    "Docker",
    "GraphQL",
    "REST",
    "API",
    "OAuth",
    "JWT",
    "CORS",
    "GitHub",
    "GitLab",
    "Bitbucket"
  ]
}
```

**For AI/ML Work**:

```json
{
  "vocabulary": [
    "Anthropic",
    "Claude",
    "ChatGPT",
    "GPT-4",
    "LLM",
    "RAG",
    "embeddings",
    "fine-tuning",
    "PyTorch",
    "TensorFlow",
    "scikit-learn"
  ]
}
```

---

## UI Preferences (plist)

**Location**: `~/Library/Preferences/com.superduper.superwhisper.plist`

**⚠️ Warning**: The plist file uses a binary format. Use `plutil` or `defaults` command to edit, or
use SuperWhisper's UI.

### Verified plist Settings

| Setting                             | Type          | Description                                            |
| ----------------------------------- | ------------- | ------------------------------------------------------ |
| `activeModeKey`                     | string        | Currently active mode key (e.g., "default", "melanie") |
| `showApplicationInDock`             | boolean       | Show SuperWhisper icon in macOS Dock                   |
| `menubarClickStartsRecording`       | boolean       | Click menu bar icon to start recording immediately     |
| `alwaysShowMiniRecorder`            | boolean       | Always show mini recording window                      |
| `closeRecordingViewEnabled`         | boolean       | Auto-close recording window after recording            |
| `isMinimized`                       | boolean       | Recording window is minimized                          |
| `KeyboardShortcuts_toggleRecording` | string (JSON) | Keyboard shortcut to toggle recording                  |
| `KeyboardShortcuts_changeMode`      | string (JSON) | Keyboard shortcut to change mode                       |
| `KeyboardShortcuts_cancelRecording` | string (JSON) | Keyboard shortcut to cancel recording                  |

### Reading plist Settings

```bash
# Read all settings
plutil -p ~/Library/Preferences/com.superduper.superwhisper.plist

# Read specific setting
defaults read com.superduper.superwhisper activeModeKey
defaults read com.superduper.superwhisper showApplicationInDock
```

### Modifying plist Settings

**⚠️ Always use SuperWhisper's UI when possible!**

```bash
# Show/hide in Dock
defaults write com.superduper.superwhisper showApplicationInDock -bool true
defaults write com.superduper.superwhisper showApplicationInDock -bool false

# Menu bar click behavior
defaults write com.superduper.superwhisper menubarClickStartsRecording -bool true
defaults write com.superduper.superwhisper menubarClickStartsRecording -bool false

# Restart SuperWhisper after changes
killall -9 superwhisper && sleep 2 && open -a SuperWhisper
```

---

## Mode-Specific Settings

For voice models, AI models, context settings, and mode-specific configuration, see:

- **custom-modes.md** - Complete mode JSON format documentation
- Each mode's JSON file in `~/Documents/superwhisper/modes/`

**Example**: Settings for the "melanie" mode are in `~/Documents/superwhisper/modes/melanie.json`

---

## Deprecated/Removed Sections

The following sections have been removed as they documented settings that don't exist in the actual
files:

- ❌ `voice_model` - This is per-mode, not global (see mode JSON files)
- ❌ `ai_model` - This is per-mode, not global (see mode JSON files)
- ❌ `voice_model_active_duration` - Not found in settings.json or plist
- ❌ `silence_removal` - Not found in settings.json or plist
- ❌ Most other snake_case settings were from outdated documentation

**If you need these settings**, they may be:

1. Configured per-mode (in mode JSON files)
2. UI-only settings (not stored in files)
3. No longer supported in current SuperWhisper versions

---

## Quick Reference

**To configure SuperWhisper**:

1. **Modes**: Edit `~/Documents/superwhisper/modes/*.json` or use UI
2. **Vocabulary/Replacements**: Edit `~/Documents/superwhisper/settings/settings.json`
3. **UI/Shortcuts**: Use SuperWhisper Settings menu
4. **Always backup before editing JSON files**

**Backup command**:

```bash
cp -r ~/Documents/superwhisper ~/Backups/superwhisper-$(date +%Y%m%d)
```
