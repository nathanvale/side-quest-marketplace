---
name: manage-plugins
description: Add or remove inline plugins from the ccdev function in dotfiles .zshrc
argument-hint: <add|remove> <plugin-path>
disable-model-invocation: true
allowed-tools: Read, Edit, Grep
---

# Manage ccdev Inline Plugins

Add or remove `--plugin-dir` entries from the `ccdev()` function in `~/code/dotfiles/.zshrc`.

## Arguments

- `$0` — Action: `add` or `remove`
- `$1` — Plugin directory path (e.g. `~/code/side-quest-plugins/plugins/my-plugin`)

## Steps

1. **Read** `~/code/dotfiles/.zshrc` and find the `ccdev()` function (look for `function ccdev()`)
2. **Validate** the plugin path exists on disk (use Bash `ls` to check)
3. **Check for duplicates** — if adding, confirm the `--plugin-dir` line doesn't already exist; if removing, confirm it does exist
4. **Edit** the file:
   - **add**: Insert a new `--plugin-dir` line in alphabetical order within the existing list. The lines are sorted alphabetically by full path. Maintain the existing indentation (4 spaces + `--plugin-dir`).
   - **remove**: Delete the `--plugin-dir` line for that path.
5. **Show the user** the updated `ccdev()` function so they can verify
6. **Remind the user**:

```
Done! To activate the change:
  1. Run: sz          (reloads .zshrc)
  2. Restart Claude Code with ccdev
```

## Important Rules

- NEVER modify anything outside the `ccdev()` function
- NEVER reorder existing lines — only insert/remove the single target line
- Keep `"$@"` as the last argument on its own line
- Use `~/code/` prefix (not full `/Users/nathanvale/code/`) to match existing style
