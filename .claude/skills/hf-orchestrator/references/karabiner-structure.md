# Karabiner Configuration Structure

## File Location

`config/karabiner/karabiner.json`

## JSON Schema Overview

```json
{
  "profiles": [
    {
      "name": "Default profile",
      "complex_modifications": {
        "rules": [
          {
            "description": "Rule description",
            "manipulators": [...]
          }
        ]
      }
    }
  ]
}
```

## HyperKey Binding Pattern

Each HyperFlow shortcut uses this manipulator structure:

```json
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
```

## Key Components

### from.key_code

Valid values: `a-z`, `0-9`, `spacebar`, `return_or_enter`, `escape`, `left_arrow`, `right_arrow`,
`up_arrow`, `down_arrow`, `grave_accent_and_tilde`, `backslash`, `open_bracket`, `close_bracket`,
etc.

### from.modifiers.mandatory

For Hyper key bindings, always use:

```json
["left_control", "left_option", "left_command", "left_shift"]
```

### to.shell_command

The command to execute. Must be absolute path:

```bash
"/Users/USERNAME/bin/hyperflow <argument>"
```

## Example: Adding Hyper+G Binding

```json
{
  "description": "Hyper+G → Launch Messages",
  "manipulators": [
    {
      "from": {
        "key_code": "g",
        "modifiers": {
          "mandatory": ["left_control", "left_option", "left_command", "left_shift"]
        }
      },
      "to": [
        {
          "shell_command": "/Users/nathanvale/bin/hyperflow m"
        }
      ],
      "type": "basic"
    }
  ]
}
```

## Navigation Bindings (Hyper+HJKL → Arrows)

These use `key_code` in the `to` field instead of `shell_command`:

```json
{
  "description": "Hyper+H → Left Arrow",
  "manipulators": [
    {
      "from": {
        "key_code": "h",
        "modifiers": {
          "mandatory": ["left_control", "left_option", "left_command", "left_shift"]
        }
      },
      "to": [
        {
          "key_code": "left_arrow"
        }
      ],
      "type": "basic"
    }
  ]
}
```

## Common Pitfalls

1. **Missing comma**: JSON requires commas between array/object items
2. **Trailing comma**: Last item in array/object must NOT have comma
3. **Relative paths**: Shell commands must use absolute paths
4. **Username hardcoded**: Update `~/bin/` paths when copying examples
5. **Invalid key_code**: Use Karabiner-EventViewer to find correct key names

## Validation

After editing `karabiner.json`:

```bash
# Check JSON syntax
python3 -c "import json; json.load(open('config/karabiner/karabiner.json'))"

# Karabiner will auto-reload on file save
# Check for errors in Console.app (search "karabiner")
```

## Finding Existing Bindings

To see what's currently bound:

```bash
# Extract all Hyper key bindings
jq '.profiles[0].complex_modifications.rules[] |
  select(.manipulators[0].from.modifiers.mandatory |
  contains(["left_control", "left_option", "left_command", "left_shift"])) |
  {description, key: .manipulators[0].from.key_code}' \
  config/karabiner/karabiner.json
```
