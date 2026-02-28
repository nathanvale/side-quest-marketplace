---
created: 2026-02-28
title: "Cortex Global Docs Storage Location"
type: brainstorm
tags: [cortex, storage, xdg, dotfiles, global-docs, config]
project: cortex-plugin
status: draft
---

## Context

The original Cortex brainstorm (docs/brainstorms/2026-02-27-cortex-brainstorm.md) decided global docs would live at `~/code/my-agent-cortex/docs/`. But since then, Cortex has moved from a standalone repo into the side-quest-marketplace as a community plugin. This breaks the assumption -- you can't ship personal knowledge docs inside a community plugin, and users who install Cortex need somewhere for their own global docs.

The core question: when there's no project context, where do Cortex docs go?

## Questions

1. Should global docs live inside the plugin repo, a dedicated repo, or a dot-directory?
2. How do we handle version control (git) without forcing it on users?
3. Should users be locked into a specific location?
4. What patterns does the community already use for this?

## Approaches

### Approach 1: `~/code/my-agent-cortex/docs/` (original decision)

Cortex gets its own repo, docs live alongside plugin code.

- Pros: Git history for free, can push to GitHub
- Cons: Plugin is now in side-quest-marketplace -- mixing plugin code with personal docs no longer makes sense. Community users would clone your personal docs. Plugin updates would conflict with personal knowledge.
- Effort: N/A (rejected due to architecture drift)

### Approach 2: `~/.cortex/docs/` (dedicated dot-directory)

Custom dot-directory in user's home, like `~/.claude/`.

- Pros: Convention matches `~/.claude/`, always exists regardless of project
- Cons: No git by default, doesn't follow XDG, another custom dot-directory

### Approach 3: `~/.config/cortex/docs/` (XDG convention)

Store under the XDG config directory, alongside other tool configs.

- Pros: Follows XDG convention used by Raycast, Karabiner, Ghostty, Atuin, Claude context files. Works automatically with dotfiles managers that symlink `~/.config/` (Stow, chezmoi). Clean separation -- plugin code in marketplace, user data in config dir.
- Cons: Community considers `~/.config/` for tool config not human-readable notes. Though Cortex docs are agent-consumed, not meant for Finder browsing.
- Effort: Minimal -- `cortex init` creates the directory and a config.yaml

### Approach 4: User chooses (configurable, with sensible default)

Default to `~/.config/cortex/docs/` but make it a single config line to change.

- Pros: Zero lock-in. Sensible default that works with dotfiles setups. Power users point it wherever they want (Dropbox, dedicated repo, iCloud, etc.)
- Cons: Slightly more complexity in the config file
- Effort: Minimal -- one field in config.yaml

## Decision

**Approach 4: Configurable with `~/.config/cortex/` as the sensible default.**

The reasoning:

1. **XDG is the right default** -- Raycast, Karabiner, Claude, Ghostty, Atuin all use `~/.config/<tool>/`. It's the established macOS/Linux convention for tool data. Users with dotfiles managers (like Nathan's Stow-based `~/.config/` symlink) get git versioning for free with zero extra setup.

2. **No lock-in** -- a single `docs_path` field in `config.yaml` lets users point their global docs anywhere. Dropbox, dedicated git repo, iCloud -- Cortex doesn't care.

3. **Clean separation** -- plugin code lives in side-quest-marketplace. User knowledge lives in `~/.config/cortex/`. Installing the plugin never touches your docs. Your docs never ship with the plugin.

4. **`cortex init` is zero-friction** -- creates `~/.config/cortex/config.yaml` and `~/.config/cortex/docs/` with no questions asked. Works immediately. Power users customise after.

### Config structure

```yaml
# ~/.config/cortex/config.yaml
docs_path: ~/.config/cortex/docs    # default, change to whatever
sources:
  - path: ./docs                     # project docs (auto-detected)
    scope: project
  - path: ~/.config/cortex/docs      # global docs
    scope: global
```

### Directory structure

```
~/.config/cortex/
  config.yaml          # source registry, preferences
  docs/                # global knowledge docs
    research/
    brainstorms/
    plans/
    decisions/
    meetings/
```

## Community Research

Newsroom research (2026-02-28) on version control for markdown docs found:

- **Git is winning for developer PKM** -- plain markdown in a folder + git is the dominant pattern (Obsidian Git plugin: 6K+ stars)
- **No consensus on "where do global notes live"** -- `~/.config/`, `~/Notes/`, `~/Documents/`, dedicated repo all in play
- **AI config versioning is a hot pattern** -- GNU Stow symlinks and chezmoi+age are the two approaches for CLAUDE.md/MCP configs
- **Syncthing competes with git for sync** -- but git is the only method with true version history
- **The XDG convention** (`~/.config/`) is standard for tool configs, but community treats knowledge/notes separately. Cortex docs blur this line since they're agent-consumed.

Key sources: Obsidian Git plugin (6K stars), Logseq community git-vs-Syncthing debate, HN thread on Claude-Config framework, chezmoi+age blog posts.

## Next Steps

- [ ] Create a plan for implementing `cortex init` with `~/.config/cortex/` as default
- [ ] Update the cortex-frontmatter skill's "File Location" table to reference config.yaml instead of hardcoded `~/code/my-agent-cortex/docs/`
- [ ] Update the original Cortex brainstorm's "Key Decisions" section to note this architecture change
- [ ] Consider: should `cortex init --git` auto-init a git repo at the docs_path?
