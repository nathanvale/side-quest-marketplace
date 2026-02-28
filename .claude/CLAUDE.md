# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

A Claude Code plugin marketplace -- a monorepo containing the `cortex` plugin, an agent-native knowledge system with research, brainstorm, and knowledge capture skills. Each plugin lives under `plugins/<name>/` and is registered in `.claude-plugin/marketplace.json`.

## Commands

```bash
bun run check              # Biome lint + format (write mode)
bun run typecheck          # TypeScript type checking (tsc --noEmit)
bun run validate:marketplace  # Marketplace structure validation
bun run validate           # Full gate: check + typecheck + marketplace validation
bun run lint               # Biome lint only (no auto-fix)
bun run lint:fix           # Biome lint with auto-fix
bun run format             # Biome format with write
bun run format:check       # Biome format check only
```

Always run `bun run validate` before pushing.

## Architecture

### Plugin Anatomy

Every plugin requires this minimum structure:

```
plugins/<name>/
  .claude-plugin/
    plugin.json        # Manifest (name, version, commands, skills, agents)
  README.md            # Required
```

Optional components:

- `commands/*.md` -- slash commands (YAML frontmatter + markdown body)
- `skills/<skill-name>/SKILL.md` -- auto-activated skills (YAML frontmatter + markdown)
- `skills/<skill-name>/references/` -- conditional context loaded by flag/mode/tool detection
- `agents/*.md` -- sub-agent definitions for multi-agent plugins
- `hooks/hooks.json` -- lifecycle hook config (SessionStart, PreToolUse, PostToolUse, PreCompact, Stop)
- `hooks/*.ts` -- TypeScript hook implementations (run via `bun run`)

### Marketplace Registry

`.claude-plugin/marketplace.json` is the source of truth for available plugins. Each entry needs:

```json
{
  "name": "my-plugin",
  "source": "./plugins/my-plugin",
  "description": "What it does in one sentence",
  "category": "development|productivity|security|learning",
  "tags": ["relevant", "tags"]
}
```

The validation script (`scripts/validate-marketplace.ts`) enforces:
- Kebab-case names matching the source directory basename
- Source paths resolve to a directory containing `.claude-plugin/plugin.json`
- No duplicate names
- Valid category enum
- Version bump enforcement on PRs (minor for additions, major for removals, patch for metadata changes)

### Plugin Manifest

`.claude-plugin/plugin.json` inside each plugin:

```json
{
  "name": "my-plugin",
  "description": "One sentence, present tense, no trailing period",
  "version": "1.0.0",
  "author": { "name": "Nathan Vale" },
  "keywords": ["search", "terms"],
  "license": "MIT",
  "commands": ["./commands/my-command.md"],
  "skills": ["./skills/my-skill"],
  "agents": ["./agents/my-agent.md"]
}
```

All paths are relative to the plugin root and validated by `claude plugin validate .`.

### Progressive Disclosure Pattern

Skills use a references/ subdirectory for conditional context loading. The main SKILL.md is always loaded (~2,000 tokens). References are loaded only when relevant flags, modes, or tools are detected. This keeps default token cost low.

### Hook Config

`hooks/hooks.json` maps lifecycle events to commands:

```json
{
  "hooks": {
    "SessionStart": [{ "matcher": "*", "hooks": [{ "type": "command", "command": "bun run \"${CLAUDE_PLUGIN_ROOT}/hooks/my-hook.ts\"", "timeout": 5 }] }]
  }
}
```

Available events: `SessionStart`, `PreToolUse`, `PostToolUse`, `PostToolUseFailure`, `PreCompact`, `Stop`

## Conventions

- **Files:** kebab-case (`my-plugin.ts`)
- **Functions:** camelCase
- **Types:** PascalCase
- **Exports:** named only (no defaults)
- **Formatting:** Biome -- tabs, single quotes, 80-char line width
- **Single biome.json at root** -- NEVER create nested configs
- **Commits:** Conventional Commits (`feat(scope): subject`)
- **Branches:** `type/description` (e.g., `feat/add-cortex`)
- **Hook TypeScript:** always include a self-destruct timer as the first executable line for safety

## Key References

- `scripts/validate-marketplace.ts` -- marketplace validation logic
- `scripts/validate-marketplace.test.ts` -- marketplace validation tests
