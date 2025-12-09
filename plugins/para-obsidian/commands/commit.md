---
description: Commit uncommitted notes in your Obsidian vault
argument-hint: "[file]"
allowed-tools: Bash(bun:*)
---

# Commit Vault Notes

Commit uncommitted markdown files in your Obsidian vault.

## Execution

Run the para-obsidian CLI git commit command:

```bash
bun ${CLAUDE_PLUGIN_ROOT}/src/cli.ts git commit $ARGUMENTS --format json
```

## Usage Examples

```bash
# Commit all uncommitted notes
/para-obsidian:commit

# Commit a specific file
/para-obsidian:commit "02 Areas/Pet Care - Muffin.md"
```

## What It Does

- **No arguments**: Commits all uncommitted `.md` files in PARA folders
- **With file**: Commits only the specified file

Each note is committed with a message following the pattern: `docs: <note title>`
