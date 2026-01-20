---
description: Scan plugin for patterns extractable to @sidequest/core
argument-hint: <plugin-name>
---

# Core Consolidate

Scan `plugins/$ARGUMENTS` for code patterns that should be extracted into `@sidequest/core`.

## Instructions

1. Validate the plugin exists at `plugins/$ARGUMENTS`
2. Launch 4 parallel `core-consolidator` agents, each scanning one domain:
   - **FS**: File I/O, path handling, directory walking
   - **Concurrency**: Locks, transactions, atomic operations
   - **MCP**: Response building, error formatting
   - **Util**: Validation, helpers, general-purpose functions
3. Collect results from all agents
4. Synthesize into a unified consolidation report

## Output Format

```markdown
## Consolidation Report: <plugin>

### Summary
- Total candidates: X
- High priority: X
- Workstreams: X

### By Domain
| Function | Location | Target Core Module | Priority |
|----------|----------|-------------------|----------|

### Recommended Workstreams
1. **Name** - functions → `core/src/module/`
```
