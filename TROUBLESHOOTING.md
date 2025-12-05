# Troubleshooting

## Quick Diagnostics

| Problem | Command |
|---------|---------|
| Validation fails | `claude plugin validate plugins/<name>` |
| TypeScript errors | `bun typecheck` |
| Lint issues | `biome_lintFix` (MCP) or `bun run check` |
| Test failures | `bun_testFile` (MCP) or `bun test` |
| Full check | `bun run validate` |

---

## Common Fixes

| Issue | Fix |
|-------|-----|
| **Deps not resolving** | `cd root && bun install` (always from root) |
| **Deps still broken** | `rm -rf node_modules bun.lockb && bun install` |
| **Cross-plugin dep fails** | Use `"workspace:*"` not version numbers |
| **MCP server won't load** | Test directly: `bun run plugins/<p>/mcp/<s>/index.ts` |
| **MCP paths broken** | Use `${CLAUDE_PLUGIN_ROOT}` in .mcp.json |
| **Pre-commit blocks** | Run `bun run validate`, fix errors shown |
| **Commit rejected** | Format: `<type>(<scope>): <subject>` — see @./GIT_WORKFLOW.md |
| **Hooks not running** | Check `hooks/hooks.json` syntax, verify files exist |

---

## Debug Commands

```bash
# MCP server logs
claude logs

# Test MCP server directly
bun run plugins/my-plugin/mcp/my-server/index.ts

# Validate single plugin
claude plugin validate plugins/my-plugin

# Check .mcp.json syntax
cat plugins/my-plugin/.mcp.json | jq .
```
