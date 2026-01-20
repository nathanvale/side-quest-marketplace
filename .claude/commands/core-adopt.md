---
description: Find opportunities to use @sidequest/core utilities in a plugin
argument-hint: <plugin-name>
---

# Core Adopt

Scan `plugins/$ARGUMENTS` for places to replace custom code with `@sidequest/core` utilities.

## Instructions

1. If no plugin specified or plugin doesn't exist:
   - List available plugins from `plugins/` directory
   - Ask user to choose one
   - Exit until they provide a valid plugin name
2. Validate the plugin exists at `plugins/$ARGUMENTS`
3. Check current `@sidequest/core` imports in the plugin
4. Launch 4 parallel `core-adopter` agents, each scanning one domain:
   - **FS**: `@sidequest/core/fs` adoption
   - **Concurrency**: `@sidequest/core/concurrency` adoption
   - **Instrumentation**: `@sidequest/core/instrumentation` adoption
   - **MCP**: `@sidequest/core/mcp-response` adoption
4. Collect results from all agents
5. Dedupe and synthesize into adoption report

## Output Format

```markdown
## Adoption Report: <plugin>

### Summary
- Direct replacements: X
- Refactoring needed: X
- Already using core: X modules ✓

### Current Core Usage
- `@sidequest/core/fs` ✓ (location)

### Direct Replacements
| Current Code | Location | Replace With | Benefit |
|--------------|----------|--------------|---------|

### Refactoring Required
| Pattern | Files | Core Utility | Notes |
|---------|-------|--------------|-------|
```
