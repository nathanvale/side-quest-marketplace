---
created: 2026-03-07
title: "Arena: Terminal-Native vs VS Code Minimal vs Native App Hybrid (Markdown Workflow)"
type: research
status: complete
method: adversarial arena research (3 parallel beat reporters + judge synthesis)
sources: [reddit, x-twitter, web, github]
tags: [arena, yazi, glow, mdr, vs-code, markview, terminal, tmux, ghostty, markdown, mermaid, developer-tools]
project: side-quest-marketplace
---

## Summary

Three-way adversarial arena match on the optimal markdown viewing and file browsing workflow for agentic coding. **Terminal-Native (Yazi + Glow + mdr) wins at 21/25**, followed by Native App Hybrid at 19/25, and VS Code Minimal at 17/25. The hard data is overwhelming: VS Code consumes 7-12GB RAM idle while Yazi + Glow use ~15MB combined. The Ghostty + tmux + Yazi + Claude Code stack is crystallizing as a recognizable pattern across the developer community. However, Mermaid diagrams don't render in a terminal, so the pragmatic answer is Terminal-Native foundation + a lightweight native viewer (mdr or MarkView) for Mermaid rendering.

## Key Findings

- **VS Code RAM is indefensible** -- documented at 12GB idle (screenshot proof, 399 likes on X), Go debugging grew from 1GB to 4.5GB in one update triggering OS OOM kills. Microsoft closed the regression issue as "not planned."
- **Yazi has 33,000+ GitHub stars** and a documented productivity study showing 86 hours/year saved on file navigation
- **The Ghostty + Yazi + Lazygit + Claude Code stack is going viral** -- @dani_avila7's setup tweet got 572 likes, Turkish/Chinese tutorials exist, multiple independent developers converging on the same pattern
- **Mermaid is the terminal's Achilles heel** -- no terminal tool renders Mermaid diagrams. Glow shows raw code blocks. This is the gap the Hybrid camp exploits.
- **Three native markdown viewers launched in 30 days** (MarkView, Meva, Mrkd) -- all with the same origin story: "I got tired of opening VS Code to preview markdown"
- **mdr (Clever Cloud, Rust)** is the strongest multi-backend option -- TUI/GUI/WebView, Mermaid support, live reload, 480 likes on X announcement
- **MarkView has MCP server integration** -- Claude Code can programmatically tell it to open/preview files

## Details

### Round-by-Round Scoring

| Round | Terminal-Native (A) | VS Code Minimal (B) | Native App Hybrid (C) | Key Evidence |
|-------|:--:|:--:|:--:|--------------|
| Hard Data | 5 | 2 | 4 | VS Code 12GB idle vs Yazi ~10MB; devtechinsights benchmark quantifies Electron Tax |
| Production Proof | 4 | 4 | 3 | @dani_avila7 572 likes (Ghostty+Yazi); @code_kartik returns to VS Code (283 likes); MarkView/Meva are weeks old |
| Ecosystem Momentum | 5 | 4 | 3 | Yazi 33K stars, cmux 2,038 likes; VS Code 50K extensions; Hybrid fragmented (6 competing tools) |
| Developer Experience | 3 | 4 | 4 | Terminal UX has paper cuts (@jxmnop 235 likes); VS Code has visual diff; Hybrid gets both |
| Future Trajectory | 4 | 3 | 5 | Agentic wave is terminal-native; Electron unfixable; MarkView MCP integration is the future |
| **Total** | **21** | **17** | **19** | |

### Team A (Terminal-Native) -- Strongest Arguments

**The RAM indictment.** @lunaperegrinaa (399 likes): "VS Code using 12GB RAM with NOTHING running." @dream_make_play: VS Code grew from 1GB to 4.5GB on Go debugging in a single update, causing OS OOM kills. Microsoft closed the issue "not planned." Meanwhile Yazi uses ~10MB and Glow ~5MB -- three orders of magnitude less.

**The stack is crystallizing.** @dani_avila7 (572 likes) replaced Claude Code's `--worktree` command with Ghostty + Lazygit + Yazi. @chongdashu (307 likes) posted the canonical layout: "claude / codex on the side, file explorer in middle, git and diff view on the right. Tools: ghostty yazi lazygit." @TugserOkur published a Turkish-language setup guide (57 likes). The pattern is going international.

**The "IDE is dead" sentiment is real.** @sdrzn (318 likes): "i'm not joking and this isn't funny. the new models have killed the ide for me." Claude Code Cheatsheet thread (1,582 pts on r/ClaudeCode) is entirely terminal-native -- not one VS Code shortcut in sight.

**Yazi's ecosystem.** 33,000+ GitHub stars. Piper plugin for markdown preview via glow. Git status plugin. Async Rust architecture never blocks UI even in 10K+ file directories. Documented 86 hours/year saved on file navigation (stephenvantran.com).

### Team B (VS Code Minimal) -- Strongest Arguments

**The "went back" pattern.** @code_kartik (283 likes, March 6): "i am back to vscode. i have uninstalled cursor after 1.5 years." VS Code + Claude Code as first-class agent (v1.109) is a real workflow.

**MEO markdown editor** (473 pts on r/vscode, 114 comments) brings Obsidian-grade live/source toggle to VS Code. Multiple commenters: "I forgot this wasn't the default vscode experience."

**Terminal UX failures are documented.** @jxmnop (235 likes): "claude code, codex, etc. are incredible products but they are exceptionally bad *terminals*. screen flashes, scrolling doesn't work, pasting often fails."

**VS Code is shipping fast.** Weekly stable releases (announced by @pierceboggan, 267 likes). v1.109 added multi-agent orchestration, Claude as first-class agent, inline Mermaid rendering in chat. v1.110 added agent plugins, fork-chat, debug panel.

### Team C (Native App Hybrid) -- Strongest Arguments

**Three indie apps in 30 days with the same origin story.** MarkView (r/MacOSApps, 17 pts): "I was literally opening folders on my IDE to just preview the content of MD files." Meva (r/SideProject): "Built this because I kept generating markdown with Claude and ChatGPT and had no good way to actually read it." Mrkd (Show HN): native macOS, ~1MB binary, TextKit 2, zero web tech.

**mdr is the strongest single tool.** Clever Cloud (Rust), three backends: TUI (SSH/terminal), WebView (OS-native WebKit, GitHub-quality rendering), egui (GPU-rendered). Mermaid support. Live reload. 480 likes on X announcement.

**MarkView has MCP server integration.** Claude Code can programmatically tell it to open/preview files. Native Swift/SwiftUI, file watching via DispatchSource, bidirectional scroll sync, full Mermaid support. `brew install --cask paulhkang94/markview/markview`.

**The Electron Tax is benchmarked.** devtechinsights.com (Feb 2026): "To edit a JavaScript file, you are essentially launching an instance of Google Chrome... the architectural equivalent of towing a separate generator for every appliance in your house."

### The Pragmatic Stack Recommendation

For a developer on Ghostty + tmux + Claude Code (M4 Pro, 24GB RAM):

```bash
brew install yazi glow
```

- **Yazi** -- daily driver file explorer with fuzzy find, tree view, preview pane
- **Glow** -- quick terminal markdown reads (`glow docs/architecture/prd.md`)
- **mdr or MarkView** -- for Mermaid diagrams and GitHub-exact rendering
- **Grip** -- occasional "how will this look on GitHub?" checks (`brew install grip`)

tmux keybinding for glow preview:
```bash
# tmux.conf
bind C-n split-window -h -c "#{pane_current_path}" "glow"
```

## Sources

### Team A (Terminal-Native)
- [@dani_avila7 -- Ghostty + Yazi + Lazygit replacing Claude Code worktree](https://x.com/dani_avila7/status/2026161210950119888) (572 likes, 36 reposts)
- [@sdrzn -- "the new models have killed the ide for me"](https://x.com/sdrzn/status/2022382188361363843) (318 likes)
- [@0xSero -- "VSCode performs like shit... Ghostty has everything prebuilt"](https://x.com/0xSero/status/2027053481253654788) (339 likes)
- [@lunaperegrinaa -- "VS Code using 12GB RAM with NOTHING running"](https://x.com/lunaperegrinaa/status/2024468296951615543) (399 likes)
- [@chongdashu -- canonical terminal layout screenshot](https://x.com/chongdashu/status/2019729118875828675) (307 likes)
- [@lawrencecchen -- cmux: terminal built for coding agents](https://x.com/lawrencecchen/status/2026729219154378912) (2,038 likes)
- [r/ClaudeCode -- Claude Code Cheatsheet](https://www.reddit.com/r/ClaudeCode/comments/1revj4g/claude_code_cheatsheet/) (1,582 pts, 105 comments)
- [How Yazi Saved Me 3 Hours Weekly](https://stephenvantran.com/posts/2025-09-12-yazi-terminal-file-manager-productivity/)
- [Yazi Terminal File Manager Guide](https://blog.starmorph.com/blog/yazi-terminal-file-manager-guide)
- [Terminal-Based Agent Engineering -- SitePoint](https://www.sitepoint.com/terminal-based-agent-engineering-the--claude-code--workflow/)
- [VS Code Issue #251437 -- RAM regression](https://github.com/microsoft/vscode/issues/251437)

### Team B (VS Code Minimal)
- [@code_kartik -- "i am back to vscode"](https://x.com/code_kartik/status/2029826568273678380) (283 likes)
- [@elormkdaniel -- "VS Code is lightweight, customizable"](https://x.com/elormkdaniel/status/2021665229848162554) (1,647 likes)
- [@jxmnop -- terminal AI tools have bad UX](https://x.com/jxmnop/status/2021633739097563167) (235 likes)
- [@pierceboggan -- weekly stable releases](https://x.com/pierceboggan/status/2022057092631183819) (267 likes)
- [MEO markdown editor for VS Code](https://www.reddit.com/r/vscode/comments/1ray1gp/meo_a_markdown_editor_for_vs_code_with_livesource/) (473 pts, 114 comments)
- [VS Code v1.109 -- agent orchestration](https://htek.dev/articles/vscode-january-2026-copilot-update-roundup/)
- [VS Code v1.110 -- agent plugins](https://dev.to/hamidrazadev/visual-studio-code-february-2026-update-version-1110-a-developer-friendly-breakdown-4eeb)

### Team C (Native App Hybrid)
- [MarkView -- macOS native + MCP server](https://www.reddit.com/r/MacOSApps/comments/1rjs9eg/i_built_markview_a_lightweight_macos_app_mcp/) (17 pts)
- [MarkView -- GitHub](https://github.com/paulhkang94/markview)
- [mdr -- Rust markdown reader, TUI/WebView/egui](https://github.com/CleverCloud/mdr)
- [@waxzce -- mdr announcement](https://x.com/waxzce/status/2025939405240693125) (480 likes)
- [Meva -- native markdown viewer](https://www.reddit.com/r/SideProject/comments/1ri86b9/i_built_a_native_markdown_viewer_because_i_got/)
- [Mrkd -- native macOS, TextKit 2](https://news.ycombinator.com/item?id=47210261)
- [VS Code is Bloatware -- benchmark](https://devtechinsights.com/vscode-vs-sublimetext-2026-benchmark/)
- [Obsidian + Claude Code workflow -- XDA](https://www.xda-developers.com/claude-code-inside-obsidian-and-it-was-eye-opening/)
- [Grip -- GitHub-exact markdown preview](https://github.com/joeyespo/grip)

## Open Questions

1. **Ghostty + tmux passthrough for inline images** -- Ghostty supports Kitty graphics protocol, but does it work through tmux with `allow-passthrough on`? If yes, glowm could render Mermaid inline in the terminal.
2. **mdr vs MarkView** -- mdr is more mature (Clever Cloud, multi-backend), but MarkView has MCP server integration. Which matters more for an agentic workflow?
3. **Will VS Code ship a "viewer mode"?** -- The Japanese fork "Kotori" suggests demand. If Microsoft ships a lightweight viewer mode, the VS Code camp gets new life.
