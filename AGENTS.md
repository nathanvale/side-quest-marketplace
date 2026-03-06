# AGENTS.md

## Tool Routing -- NEVER use shell commands when MCP tools are available

| Need | MCP Tool (preferred) | Fallback (shell) |
|------|---------------------|-----------------|
| Run tests | `bun_runTests()` | `bun run test` |
| Run single test file | `bun_testFile()` | `bun test path/to/file` |
| Test coverage | `bun_testCoverage()` | `bun run test --coverage` |
| Lint + format check | `biome_lintCheck()` | `bun run check` |
| Lint with auto-fix | `biome_lintFix()` | `bun run lint:fix` |
| Type check | `tsc_check()` | `bun run typecheck` |

Always pass `response_format: "json"` to all runner MCP tools.
