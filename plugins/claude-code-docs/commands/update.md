---
description: Update local Claude Code documentation from code.claude.com
allowed-tools: Bash(cd:*), Bash(bun:*)
---

Update local Claude Code documentation from code.claude.com.

The documentation is fetched via sitemap and saved to the plugin's docs directory with automatic change detection.

Run the documentation updater:

```bash
cd "${CLAUDE_PLUGIN_ROOT}" && bun run scripts/cli.ts
```
