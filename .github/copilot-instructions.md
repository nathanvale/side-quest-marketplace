# GitHub Copilot Instructions for Nathan Vale Claude Code Marketplace

## Project Overview
This is a **Bun-based monorepo** containing plugins for the Claude Code marketplace. The core architecture revolves around **plugins**, **commands**, **skills**, and **hooks**.

## Architecture & Structure
- **Monorepo**: Managed with Bun workspaces (`plugins/*`).
- **Plugins**: Located in `plugins/<plugin-name>/`. Each is a self-contained package.
- **Commands**: Defined as **Markdown files** in `plugins/<plugin>/commands/*.md`. These serve as instructions for the AI agent.
- **Skills**: Defined as **Markdown files** in `plugins/<plugin>/skills/<skill-name>/SKILL.md`. They describe capabilities and usage patterns.
- **Hooks**: Defined in `plugins/<plugin>/hooks/hooks.json`. They map lifecycle events (e.g., `SessionStart`) to scripts.
- **MCP Servers**: Located in `plugins/<plugin>/mcp-servers/`.

## Development Workflow
- **Package Manager**: Use `bun` exclusively.
  - Install deps: `bun install`
  - Run scripts: `bun run <script>`
- **Linting & Formatting**: Use **Biome**.
  - Check: `bun run ci` (runs typecheck, biome check, and tests)
  - Format: `bun run check` (or `biome check --write .`)
- **Testing**: `bun run test` (uses Bun's built-in test runner).

## Key Conventions

### Command Definitions (`commands/*.md`)
Commands are Markdown files with frontmatter:
```markdown
---
description: Short description of the command
tags: [tag1, tag2]
---
# Command Name

## Your Responsibilities
1. Step 1
2. Step 2

## Step 1: Implementation
```bash
# Bash script to execute
```
```

### Skill Definitions (`skills/*/SKILL.md`)
Skills define AI capabilities using Markdown frontmatter and descriptive sections:
```markdown
---
name: skill-name
description: When to use this skill
---
# Skill Name
## Overview
...
## Core Capabilities
...
```

### Hooks (`hooks/hooks.json`)
Define lifecycle hooks using JSON:
```json
{
  "hooks": {
    "SessionStart": [
      {
        "type": "command",
        "command": "bun run ${CLAUDE_PLUGIN_ROOT}/hooks/script.ts"
      }
    ]
  }
}
```

## Task Management & Git Workflow
- **Worktrees**: The project uses a **git worktree** workflow for task isolation.
- **Tasks**: Tasks are defined in Markdown files (e.g., `tasks/*.md`).
- **Automation**: Use the provided VS Code tasks (e.g., "Next Task", "Merge PR") which utilize scripts in `~/.claude/scripts/`.

## Critical Files
- `package.json`: Root workspace configuration.
- `biome.json`: Linter/formatter configuration.
- `plugins/nvcc/`: Core plugin containing the main logic.
