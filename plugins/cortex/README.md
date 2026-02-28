# cortex

Agent-native knowledge system. Research topics and capture findings as structured markdown documents with YAML frontmatter.

## Install

```bash
claude plugin install cortex@cortex
```

## Commands

### `/cortex:research <topic>`

Research a topic and save findings as a Cortex document. Checks existing knowledge first, then dispatches external research, and saves a structured doc.

### `/cortex:add [topic]`

Capture research from the current conversation as a Cortex document. Use after a research-heavy session to save findings before they disappear.

### `/cortex:brainstorm <topic>`

Brainstorm an idea, building on existing Cortex knowledge. Checks for prior research and brainstorms, then runs a collaborative brainstorming session.

## Skills

- **cortex-frontmatter** -- Knows the frontmatter contract for all doc types. Other skills delegate to this for correct doc structure.
- **producing-research-documents** -- Workflow skill for research. Checks cortex first, dispatches research, synthesizes findings.
- **brainstorming-with-cortex** -- Workflow skill for brainstorming. Builds on existing knowledge, runs collaborative brainstorm sessions.

## CLI

The cortex CLI tool is available when the repo is linked:

```bash
cortex list                          # List all docs
cortex list --type research --json   # Filtered JSON output
cortex search "frontmatter"          # Search across all sources
cortex open "yaml-frontmatter"       # Open in configured viewer
```

## Requirements

- Claude Code with plugin support
- Bun runtime (for CLI)
