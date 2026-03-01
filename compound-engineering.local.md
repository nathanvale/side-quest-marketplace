---
review_agents: [kieran-typescript-reviewer, code-simplicity-reviewer, security-sentinel, performance-oracle]
plan_review_agents: [kieran-typescript-reviewer, code-simplicity-reviewer]
---

# Review Context

- This is a Claude Code plugin marketplace monorepo with the cortex-engineering plugin
- TypeScript hooks run via `bun run` -- no node_modules, uses Bun runtime
- Skills are markdown files (SKILL.md), not executable code -- review for Claude instruction quality
- Plugin hooks must be self-contained (no imports from plugin source)
- Single biome.json at root -- never create nested configs
