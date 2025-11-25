---
description: [topic] - Read Claude Code documentation with auto-sync from GitHub
---

Execute the Claude Code Docs helper script at ~/.claude-code-docs/claude-docs-helper.sh

Usage:

- /docs - List all available documentation topics
- /docs <topic> - Read specific documentation with link to official docs
- /docs -t - Check sync status without reading a doc
- /docs -t <topic> - Check freshness then read documentation
- /docs whats new - Show recent documentation changes (or "what's new")

Examples of expected output:

When reading a doc: 📚 COMMUNITY MIRROR: https://github.com/ericbuess/claude-code-docs 📖 OFFICIAL
DOCS: https://docs.anthropic.com/en/docs/claude-code

[Doc content here...]

📖 Official page: https://docs.anthropic.com/en/docs/claude-code/hooks

When showing what's new: 📚 Recent documentation updates:

• 5 hours ago: 📎 https://github.com/ericbuess/claude-code-docs/commit/eacd8e1 📄 data-usage:
https://docs.anthropic.com/en/docs/claude-code/data-usage ➕ Added: Privacy safeguards 📄 security:
https://docs.anthropic.com/en/docs/claude-code/security ✨ Data flow and dependencies section moved
here

📎 Full changelog: https://github.com/ericbuess/claude-code-docs/commits/main/docs 📚 COMMUNITY
MIRROR - NOT AFFILIATED WITH ANTHROPIC

Every request checks for the latest documentation from GitHub (takes ~0.4s). The helper script
handles all functionality including auto-updates.

Execute: ~/.claude-code-docs/claude-docs-helper.sh "$ARGUMENTS"
