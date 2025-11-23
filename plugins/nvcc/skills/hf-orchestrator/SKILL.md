---
name: hf-orchestrator
description:
  Manages HyperFlow keyboard orchestration system including Hyper key architecture, Karabiner
  configuration, app launcher modifications, SuperWhisper mode integration, and debugging. This
  skill should be used when adding new keyboard shortcuts, modifying the hyperflow.sh launcher,
  configuring SuperWhisper modes, debugging race conditions, or when mentioned 'hyperflow', 'hyper
  key', 'keyboard workflow', 'karabiner', 'add shortcut'.
---

# HF-Orchestrator

## Overview

HyperFlow is a keyboard-driven productivity system that uses the Hyper key (Right Command =
Ctrl+Opt+Cmd+Shift) as a conflict-free namespace for custom letter shortcuts, while Control+Number
keys handle primary app launching (preserving muscle memory). The system orchestrates multiple
components: Karabiner-Elements for keyboard remapping, hyperflow.sh for app launching, SuperWhisper
for context-aware voice dictation, and Raycast for window management.

This skill provides comprehensive knowledge of the HyperFlow architecture and procedural guidance
for common modifications.

## When to Use This Skill

Use this skill when:

- Adding new Hyper key shortcuts to Karabiner configuration
- Modifying the hyperflow.sh app launcher (adding/removing apps)
- Configuring SuperWhisper mode integration with apps
- Debugging race conditions or focus issues
- Understanding the HyperFlow architecture
- Validating Karabiner JSON configuration
- Listing current keyboard bindings

## Core Capabilities

### 1. Understanding Architecture

To understand the HyperFlow system flow and component responsibilities:

**Read** `references/architecture.md` for:

- Complete component flow diagram
- Data flow example (user keypress → final result)
- File locations for all components
- Design principles and rationale

Key insight: HyperFlow uses on-demand script execution (no daemon) triggered by Karabiner keyboard
events, coordinating app launching with automatic SuperWhisper mode switching.

### 2. Adding Hyper Key Shortcuts

To add a new keyboard shortcut:

**Step 1:** Determine the key and action

- Choose an unbound key (check existing with `scripts/list_bindings.sh`)
- Define the action (app launch, mode switch, script execution)

**Step 2:** Update Karabiner configuration

- **Read** `references/karabiner-structure.md` for JSON schema and examples
- Edit `config/karabiner/karabiner.json`
- Add manipulator following the pattern:

```json
{
  "description": "Hyper+KEY → Action Description",
  "manipulators": [
    {
      "from": {
        "key_code": "KEY_HERE",
        "modifiers": {
          "mandatory": ["left_control", "left_option", "left_command", "left_shift"]
        }
      },
      "to": [
        {
          "shell_command": "/Users/USERNAME/bin/hyperflow ARGUMENT"
        }
      ],
      "type": "basic"
    }
  ]
}
```

**Step 3:** Validate JSON syntax

```bash
python3 -c "import json; json.load(open('config/karabiner/karabiner.json'))"
```

**Step 4:** Test the shortcut

- Karabiner auto-reloads on file save
- Press Hyper+KEY to verify action executes
- Check Console.app for any errors (filter: "karabiner")

### 3. Modifying App Launcher

To add or remove apps from hyperflow.sh:

**Step 1:** Locate the launcher script

- File: `apps/hyperflow/hyperflow.sh`
- Shim: `bin/hyperflow`
- Structure: Case statement mapping arguments to app names

**Step 2:** Add new app case

```bash
"ARGUMENT")
  open_and_activate "App Name"
  ;;
```

**Step 3:** Get correct app name

```bash
osascript -e 'tell application "System Events" to get name of every application process'
```

**Step 4:** Add corresponding Karabiner binding

- Follow "Adding Hyper Key Shortcuts" process above
- Use the new ARGUMENT in shell_command

**Step 5:** Update documentation

- Edit `apps/hyperflow/README.md` with new binding

### 4. Configuring SuperWhisper Modes

To integrate SuperWhisper mode switching with an app:

**Step 1:** Understand mode mappings

- **Read** `references/superwhisper-modes.md` for:
  - Available modes (default, casual-text, professional-engineer, email)
  - Current app-to-mode mappings
  - Deep link format

**Step 2:** Edit mode switcher

- File: `apps/hyperflow/superwhisper-mode-switch.sh`
- Add case to switch statement:

```bash
"App Name")
  mode="mode-name"
  ;;
```

**Step 3:** Verify mode JSON exists

- Check `config/superwhisper/modes/MODE_NAME.json` exists
- Create if needed following existing mode structure

**Step 4:** Test mode switching

```bash
# Launch app via HyperFlow
# Verify mode switches in SuperWhisper UI
# Check logs if issues: log show --predicate 'eventMessage CONTAINS "superwhisper"' --last 5m
```

### 5. Debugging Issues

To debug HyperFlow problems:

**Read** `references/debugging.md` for:

- Common issues (shortcuts not working, race conditions, focus problems)
- Debug steps for each issue
- Console.app filtering patterns
- Command-line log streaming
- Performance troubleshooting

**Quick debugging workflow:**

```bash
# 1. Validate Karabiner JSON
python3 -c "import json; json.load(open('config/karabiner/karabiner.json'))"

# 2. Check HyperFlow logs
log show --predicate 'eventMessage CONTAINS "hyperflow"' --last 5m --style compact

# 3. Test components individually
~/code/dotfiles/bin/hyperflow ARGUMENT
~/code/dotfiles/apps/hyperflow/superwhisper-mode-switch.sh
```

**Race condition debugging:**

- Increase sleep duration in `superwhisper-mode-switch.sh`
- Review timing logs in Console.app
- Verify focus restoration happens after mode switch

### 6. Listing Current Bindings

To see all Hyper key bindings:

**Execute** `scripts/list_bindings.sh`:

```bash
.claude/skills/hf-orchestrator/scripts/list_bindings.sh
```

Output shows:

- Hyper+KEY combinations
- Mapped actions (shell commands or key remaps)
- Descriptions
- Total binding count

Use this before adding new shortcuts to avoid conflicts.

### 7. Validating Configuration

To check configuration integrity:

**Karabiner JSON validation:**

```bash
python3 -c "import json; json.load(open('config/karabiner/karabiner.json'))"
```

**HyperFlow script validation:**

```bash
bash -n apps/hyperflow/hyperflow.sh
bash -n apps/hyperflow/superwhisper-mode-switch.sh
```

**Check for common issues:**

- Duplicate key bindings (use `list_bindings.sh`)
- Missing shell command paths
- Hardcoded usernames in paths
- Trailing commas in JSON

## File Locations Reference

| Component          | Path                                                     |
| ------------------ | -------------------------------------------------------- |
| Karabiner Config   | `config/karabiner/karabiner.json`                        |
| Main Launcher      | `apps/hyperflow/hyperflow.sh` (via `bin/hyperflow` shim) |
| Mode Switcher      | `apps/hyperflow/superwhisper-mode-switch.sh`             |
| SuperWhisper Modes | `config/superwhisper/modes/*.json`                       |
| Documentation      | `apps/hyperflow/README.md`                               |

## Resources

### scripts/

- **list_bindings.sh** - Extract and display all Hyper key bindings from Karabiner config

### references/

- **architecture.md** - Complete HyperFlow system architecture and component flow
- **karabiner-structure.md** - Karabiner JSON schema, binding patterns, validation
- **superwhisper-modes.md** - Mode definitions, app mappings, deep link format
- **debugging.md** - Common issues, debug steps, log filtering, performance tips

## Quick Start Examples

**Add Hyper+G to launch Messages:**

1. Check if G is available: `scripts/list_bindings.sh | grep "Hyper+G"` or `grep "G"`
2. Add to `config/karabiner/karabiner.json`:

```json
{
  "description": "Hyper+G → Launch Messages",
  "manipulators": [
    {
      "from": {
        "key_code": "g",
        "modifiers": { "mandatory": ["control", "option", "command", "shift"] }
      },
      "to": [{ "shell_command": "/Users/USERNAME/bin/hyperflow/hyperflow.sh m" }],
      "type": "basic"
    }
  ]
}
```

3. Validate: `python3 -c "import json; json.load(open('config/karabiner/karabiner.json'))"`
4. Test: Press Right Command+G (Hyper+G)

**Map Messages app to casual-text mode:**

1. Edit `bin/hyperflow/superwhisper-mode-switch.sh`
2. Add to case statement:

```bash
"Messages")
  mode="casual-text"
  ;;
```

3. Test: Launch Messages, verify mode switches

**Debug shortcuts not working:**

1. Validate JSON: `python3 -c "import json; json.load(open('config/karabiner/karabiner.json'))"`
2. Check logs: `log show --predicate 'process CONTAINS "karabiner"' --last 5m`
3. Review `references/debugging.md` for specific issue
