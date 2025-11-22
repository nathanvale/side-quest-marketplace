# HyperFlow Architecture

## Overview

HyperFlow is the orchestration layer that ties together multiple productivity tools into a seamless
keyboard-driven workflow.

## Component Flow

```
USER INTERACTION (Hold Right Command + Letter OR Control + Number)
                    ↓
KARABINER-ELEMENTS (Keyboard Remapping Layer)
• Maps Right Command → Hyper Key (Ctrl+Opt+Cmd+Shift) for letters
• Maps Caps Lock → Control (Escape if alone) preserving muscle memory
• Maps Control+1-7 → App launcher, Hyper+Letters → Apps/Actions
• Translates shortcuts → Shell commands
• Provides conflict-free shortcut namespace
                    ↓
HYPERFLOW.SH (Orchestration Layer)
• Routes shortcuts to appropriate handlers
• Launches/focuses applications
• Triggers SuperWhisper mode switching
         ↓              ↓              ↓
    macOS Apps    SuperWhisper    Raycast
                  Mode Switcher    Window Mgmt

```

## Key Components

### 1. Karabiner-Elements (Keyboard Remapping)

- **Location**: `config/karabiner/karabiner.json`
- **Function**: Converts Caps Lock to Hyper key, routes Hyper+Key to shell commands
- **Complex modification**: "Caps Lock → Hyper Key (⌃⌥⇧⌘) (Caps Lock if alone)"

### 2. HyperFlow Scripts (Orchestration)

- **Main launcher**: `apps/hyperflow/hyperflow.sh` (via `bin/hyperflow` shim)
- **Mode switcher**: `apps/hyperflow/superwhisper-mode-switch.sh`
- **Function**: Coordinates app launching and mode switching with debouncing

### 3. SuperWhisper (Voice Input)

- **Modes**: default, casual-text, professional-engineer, email
- **Function**: Context-aware AI voice dictation that switches based on active app
- **Integration**: Maintains focus after mode switches

### 4. Raycast (Window Management)

- **Function**: Native macOS window positioning
- **Hotkeys**: Set directly in Raycast (not through Karabiner)

## Data Flow Example

```
User: Presses Control + 2
    ↓
Karabiner: Detects Control+2 → Runs ~/bin/hyperflow 2 (shim → apps/hyperflow/hyperflow.sh)
    ↓
HyperFlow: Case "2" → open_and_activate "Visual Studio Code"
    ↓
macOS: Activates VS Code (or opens if not running)
    ↓
HyperFlow: Triggers SuperWhisper mode switcher in background
    ↓
SuperWhisper: Switches to "default" mode, restores VS Code focus
    ↓
Result: VS Code focused, SuperWhisper in coding mode, ready to work
```

## File Locations

| Component             | File Path                                             |
| --------------------- | ----------------------------------------------------- |
| Karabiner Config      | `config/karabiner/karabiner.json`                     |
| Main Launcher         | `apps/hyperflow/hyperflow.sh` (shim: `bin/hyperflow`) |
| SuperWhisper Switcher | `apps/hyperflow/superwhisper-mode-switch.sh`          |
| Documentation         | `apps/hyperflow/README.md`                            |
| Debug Logs            | Console.app (filter: "hyperflow" or "superwhisper")   |

## Design Principles

- **Separation of concerns**: Each tool does one thing well
- **Composability**: Components can be swapped/upgraded independently
- **No daemon overhead**: Scripts run on-demand via keyboard events
- **Conflict-free**: Hyper key rarely used by any app/system
- **Fast**: Direct shell execution, no IPC overhead
