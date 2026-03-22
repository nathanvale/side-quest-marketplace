---
created: 2026-03-07
title: "Markdown Preview Enhanced: Community Issues Audit"
type: research
status: complete
method: newsroom investigation (beat reporter + GitHub API + web research)
sources: [reddit, x-twitter, web, github]
tags: [research, mpe, vs-code, security, cve, markdown, mermaid, developer-tools]
project: side-quest-marketplace
---

## Summary

Community audit of Markdown Preview Enhanced (MPE), the popular VS Code extension (8.5M downloads, publisher: shd101wyy). Findings: 1,392 open issues, an unpatched critical RCE vulnerability (CVE-2025-65716, CVSS 7.8), a solo maintainer who hasn't responded to security disclosures in 9+ months, and multiple reproducible bugs including the "Something is wrong" error. Last release was v0.8.20 on November 1, 2025. The extension is effectively unmaintained with active security risk.

## Key Findings

- **CVE-2025-65716 (CVSS 7.8) is unpatched** -- crafted `.md` files can execute arbitrary JavaScript in the preview webview, enabling local port enumeration and data exfiltration. Disclosed June 2025, published February 2026. Zero maintainer response. No official patch exists.
- **"Something is wrong" error is a known, reproducible bug** (GitHub #2068, open since Nov 2024) -- triggered by Single Preview mode + two editor groups + switching between markdown files. No fix, no maintainer response.
- **Mermaid rendering is broken** -- diagrams are "very very slow" (#2209) and text fails to display (#2220). No response on either issue.
- **Service accessor crash on quit** (#2218) -- a timing bug in the webview can block VS Code from quitting. Root cause is async code using a synchronous-only accessor after lifecycle ends.
- **Preview completely blank** (#2188) -- multiple users on Linux report blank preview with RangeError. One user fixed it by uninstalling deprecated IntelliCode extensions.
- **Maintenance is effectively stalled** -- 1,392 open issues, last release Nov 2025 (4 months ago), solo maintainer (shd101wyy), last push Feb 25, 2026 but no patch or statement on the CVE.
- **Community sentiment on X was massive** -- Japanese tech accounts amplified the CVE story with 2,788 and 2,220 likes respectively. Key framing: "8.5M installs, one maintainer, zero patches."

## Details

### The "Something is Wrong" Error

GitHub Issue [#2068](https://github.com/shd101wyy/vscode-markdown-preview-enhanced/issues/2068) (OPEN, assigned to shd101wyy, no fix).

**Root cause:** Webview state management bug in "Single Preview" mode. Reproducible steps:
1. Have two editor groups (left/right panes)
2. Open a preview in the right pane
3. Switch to a non-markdown file that hides the preview
4. Switch to a different markdown file
5. Try to unhide the preview

The preview loses track of which file to render and shows the error. Confirmed on Windows 10, macOS 14.5, and Linux.

**Workarounds:**
- Close preview entirely and reopen (`Cmd+Shift+V`)
- Use "Multiple Previews" mode instead of "Single Preview"
- `Cmd+Shift+P` -> "Developer: Reload Window"

A separate trigger exists via URL-encoded characters in markdown links ([#1934](https://github.com/shd101wyy/vscode-markdown-preview-enhanced/issues/1934)).

### CVE-2025-65716: Remote Code Execution

- **Severity:** CVSS 7.8 (High), some outlets report 8.8
- **Affected:** All versions of MPE
- **Attack vector:** Crafted `.md` file with `<iframe sandbox="allow-scripts allow-same-origin">` tag. MPE renders it with same-origin privileges in the preview webview.
- **Capabilities:** Arbitrary JavaScript execution, local port enumeration, network fingerprinting, data exfiltration to attacker-controlled server
- **Also affects:** Cursor and Windsurf (VS Code-compatible IDEs)
- **Disclosure timeline:** OX Security contacted maintainer June 2025. No response. CVE reserved November 2025, published February 2026. Still unpatched as of March 7, 2026.
- **Community workaround:** User @aelata (GitHub #2219, March 1, 2026) posted a `.crossnote/parser.js` patch using `onDidParseMarkdown` to strip dangerous iframes via regex. User-level mitigation only.

### Maintenance Health

| Metric | Value |
|--------|-------|
| Open issues | 1,392 |
| Last release | v0.8.20 (Nov 1, 2025) |
| Last push | Feb 25, 2026 |
| Release cadence | ~3 per year |
| Maintainer | Solo (shd101wyy) |
| CVE response | None after 9+ months |
| Stars | 1,837 |
| Forks | 218 |

### Community Sentiment

X user @exceedsystem summarized the maintenance burden charitably: "We put too much burden on OSS authors. MPE has tons of issues but very few PRs. Bug reports feel like contributions, but pull requests carry real responsibility."

The CVE disclosure triggered significant discussion in the Japanese tech community, with posts reaching thousands of likes and reposts. The framing was consistently about supply chain risk: a single developer maintaining a tool with 8.5M installs and no security response capability.

## Sources

### GitHub Issues
- [#2068 -- "Something is wrong"](https://github.com/shd101wyy/vscode-markdown-preview-enhanced/issues/2068) (2 comments, unresolved since Nov 2024)
- [#2188 -- Preview No Longer Shows](https://github.com/shd101wyy/vscode-markdown-preview-enhanced/issues/2188) (8 comments)
- [#2218 -- Service Accessor Error](https://github.com/shd101wyy/vscode-markdown-preview-enhanced/issues/2218) (0 comments)
- [#2209 -- Mermaid Very Slow](https://github.com/shd101wyy/vscode-markdown-preview-enhanced/issues/2209) (0 comments)
- [#2220 -- Mermaid Text Not Displaying](https://github.com/shd101wyy/vscode-markdown-preview-enhanced/issues/2220) (0 comments)
- [#2219 -- CVE-2025-65716 Report + Community Workaround](https://github.com/shd101wyy/vscode-markdown-preview-enhanced/issues/2219) (1 comment)
- [#1934 -- URL Encoding Preview Failure](https://github.com/shd101wyy/vscode-markdown-preview-enhanced/issues/1934)
- [MPE Releases](https://github.com/shd101wyy/vscode-markdown-preview-enhanced/releases)

### Security
- [CVE-2025-65716 -- OX Security Blog](https://www.ox.security/blog/cve-2025-65716-markdown-preview-enhanced-vscode-vulnerability/)
- [CVE-2025-65716 -- CVE Details](https://www.cvedetails.com/cve/CVE-2025-65716/)
- [Flaws in popular VSCode extensions -- BleepingComputer](https://www.bleepingcomputer.com/news/security/flaws-in-popular-vscode-extensions-expose-developers-to-attacks/)
- [Critical Flaws in Four VS Code Extensions -- The Hacker News](https://thehackernews.com/2026/02/critical-flaws-found-in-four-vs-code.html)

### X/Twitter (by engagement)
- [@yousukezan](https://x.com/yousukezan/status/2024143677908779063) (2,788 likes, 1,005 reposts) -- CVE disclosure amplification
- [@joho_no_todai](https://x.com/joho_no_todai/status/2024020729273184686) (2,220 likes, 456 reposts) -- "One developer, 72M installs, zero response"
- [@shimabu_it](https://x.com/shimabu_it/status/2024311993809981775) (413 likes, 50 reposts) -- Practical CVE advisory
- [@exceedsystem](https://x.com/exceedsystem/status/2024221309262274921) (3 likes) -- OSS maintainer burden commentary

## Open Questions

1. **Will the maintainer patch CVE-2025-65716?** -- 9 months without response suggests unlikely without community intervention (fork or PR).
2. **Should MPE be forked?** -- 1,837 stars, 218 forks, but no active community fork has emerged.
3. **What are the best alternatives?** -- See companion research: "Arena: Terminal-Native vs VS Code vs Native App Hybrid."
