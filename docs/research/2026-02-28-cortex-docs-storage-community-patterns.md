---
created: 2026-02-28
title: "Community Patterns for Docs Storage and Version Control"
type: research
tags: [cortex, version-control, xdg, dotfiles, obsidian, pkm, claude-code-plugins, hooks]
project: cortex-plugin
status: draft
---

## Summary

Researched community patterns for storing and version-controlling markdown knowledge bases, and how Claude Code plugin authors handle first-run setup and config bootstrapping. Key findings: git + plain markdown is the dominant developer PKM pattern, `~/.config/` (XDG) is the right default for tool data, and SessionStart hooks are the cleanest bootstrap mechanism for Claude Code plugins (with a known bug for local marketplaces).

## Key Findings

- **Git is winning for developer PKM** -- plain markdown in a folder + git is the dominant pattern. Obsidian Git plugin has 6K+ GitHub stars.
- **No consensus on "where do global notes live"** -- `~/.config/`, `~/Notes/`, `~/Documents/`, dedicated repo all in play. XDG is standard for tool configs but community treats knowledge/notes separately.
- **AI config versioning is a hot new pattern** -- GNU Stow symlinks and chezmoi+age are the two approaches for CLAUDE.md/MCP configs. HN thread on Claude-Config signals growing demand.
- **Syncthing competes with git for sync** -- reliable if you never edit the same file on two devices simultaneously. Git is the only method with true version history.
- **Mobile is the Achilles heel** -- git workflows break on iOS/Android. Syncthing or paid sync (Obsidian Sync) fills the gap.
- **SessionStart hooks are the cleanest plugin bootstrap** -- stdout is injected into Claude's context, fires before any skill. But bug #11509 means hooks may not fire for local marketplace plugins.
- **The `!` backtick pattern** is a first-class Claude Code feature for dynamic context injection in skills. Runs shell commands before skill content is sent to Claude.
- **Community plugin authors converge on `/setup` commands** as the primary init mechanism -- Trail of Bits, pickled-claude-plugins, everything-claude-code all use this pattern.
- **Fallback hierarchy is a proven pattern** for config resolution: env var -> project-level -> user-level -> sensible default.

## Details

### Version Control for Markdown Docs

**Git + Obsidian** is a well-established workflow with a dedicated community plugin (Vinzent03/obsidian-git). The canonical `.gitignore` excludes `.obsidian/workspace.json`, `.trash/`, `.DS_Store`. Single-user workflows sidestep merge conflicts entirely. Large binary attachments require Git LFS.

**Docs-as-code** is mature for teams. GitBook offers bi-directional GitHub/GitLab sync. Mintlify targets developers writing docs alongside code. Non-technical contributors access via GitHub web UI or WYSIWYG layers.

**Auto-commit vs manual commit** -- no consensus. Scheduled commits (every 5 min) vs intentional semantic commits. Most developer workflows lean manual.

### AI Config Versioning

**GNU Stow symlinks:** Dotfiles repo with `stow *` creating `~/.claude/` symlinked back. Public configs in git, private in separate unversioned file. Nathan's dotfiles use this pattern -- `~/.config/` is symlinked wholesale to `~/code/dotfiles/config/`.

**chezmoi + age encryption:** `~/.claude/commands/` encrypted with age, stored as `.age` files in git. Limitation: encrypted files aren't diffable.

### Claude Code Plugin Bootstrap Patterns

**SessionStart hooks:** Stdout is injected into Claude's context. Can bootstrap directories and inject config values. But [#11509](https://github.com/anthropics/claude-code/issues/11509) -- hooks don't fire for local marketplace plugins. Still open Feb 2026. Workaround: clear `~/.claude/plugins/cache` and reinstall.

**`!` backtick pattern:** `!`command`` runs shell commands before skill content is sent to Claude. Output replaces the placeholder. Can be used for config-checking: `!`cat config.yaml 2>/dev/null || echo "NOT_CONFIGURED"``. Reliable but adds maintenance overhead (duplicated in every skill).

**`/setup` slash commands:** Community standard for first-run. Trail of Bits' plugin "detects what you already have and self-installs". Sidesteps the hook bug entirely.

**`user-invocable: false` skills:** Stay out of the `/` menu but Claude can auto-invoke based on description matching. Could be used for background config guards.

### XDG Convention Adoption

Tools using `~/.config/<tool>/`: Raycast, Karabiner, Ghostty, Atuin, Claude context files, lazygit, bat. The pattern is well-established on macOS despite not being a macOS native convention. Cortex docs blur the line between "tool config" and "human-readable notes" -- but since they're agent-consumed, `~/.config/` is appropriate.

## Sources

- [Obsidian Git plugin](https://github.com/Vinzent03/obsidian-git) -- 6K+ stars, actively maintained
- [How to sync Obsidian vault using GitHub](https://dev.to/padiazg/how-to-sync-your-obsidian-vault-using-github-a-complete-guide-2l08) -- dev.to
- [Git and Markdown for team docs](https://xebia.com/blog/use-git-and-markdown-to-store-your-teams-documentation-and-decisions/) -- xebia.com
- [Dotfiles + Claude Code config workshop](https://www.hsablonniere.com/dotfiles-claude-code-my-tiny-config-workshop--95d5fr/) -- hsablonniere.com
- [Sync Claude Code with chezmoi and age](https://www.arun.blog/sync-claude-code-with-chezmoi-and-age/) -- arun.blog
- [Show HN: Claude-Config](https://news.ycombinator.com/item?id=46653896) -- news.ycombinator.com
- [Logseq: Is git the only reliable self-hosted sync?](https://discuss.logseq.com/t/discussion-is-git-the-only-truly-reliable-self-hosted-sync-for-multiple-devices-in-2025/33502) -- discuss.logseq.com
- [SessionStart hook bug #11509](https://github.com/anthropics/claude-code/issues/11509) -- anthropics/claude-code
- [Claude Code Skills docs](https://code.claude.com/docs/en/skills) -- official
- [Claude Code Hooks reference](https://code.claude.com/docs/en/hooks) -- official
- [Trail of Bits claude-code-config](https://github.com/trailofbits/claude-code-config) -- github.com
- [technicalpickles/pickled-claude-plugins](https://github.com/technicalpickles/pickled-claude-plugins) -- github.com
- [XDG Base Directory Spec](https://wiki.archlinux.org/title/XDG_Base_Directory) -- wiki.archlinux.org

## Open Questions

- Will hook bug #11509 be fixed before this marketplace goes public?
- Should we add a `/cortex:setup` fallback command alongside the hook, for robustness?
- Is there value in supporting `CORTEX_CONFIG_DIR` env var as an override (common community pattern)?
