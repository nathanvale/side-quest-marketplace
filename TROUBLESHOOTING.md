# Troubleshooting Guide

Common issues and solutions for the SideQuest Marketplace.

---

## Validation Fails

```bash
# See detailed errors
claude plugin validate plugins/my-plugin

# Validate all plugins
bun run validate
```

**Common issues:**
- Missing plugin.json fields
- Referenced files don't exist (commands, skills, hooks)
- Invalid command/skill/hook structure
- TypeScript compilation errors

---

## Workspace Dependencies Not Resolving

```bash
# From project root
bun install

# Clear lock and reinstall
rm bun.lock
bun install
```

**Common causes:**
- Didn't run `bun install` from root after adding deps
- Missing `workspace:*` protocol for cross-plugin deps
- Circular dependencies between plugins

---

## MCP Server Not Loading

```bash
# Check .mcp.json syntax
cat plugins/my-plugin/.mcp.json

# Test server directly
bun run plugins/my-plugin/mcp-servers/my-server/index.ts

# Check Claude Code logs
claude logs
```

**Common causes:**
- Invalid JSON in `.mcp.json`
- Missing package.json in MCP server directory
- Server crashes on startup (run manually to see errors)
- Tool name doesn't match expected pattern

---

## TypeScript Errors

```bash
# Check all workspace packages
bun typecheck

# Check specific plugin
cd plugins/my-plugin
bun run typecheck
```

**Common causes:**
- Missing `tsconfig.json` extending base
- Missing `bun-types` in package.json
- Strict mode violations (null checks, implicit any)

---

## Tests Failing

```bash
# Run all tests
bun test

# Run specific plugin tests
bun --filter my-plugin test

# Run single test file
bun test plugins/my-plugin/src/index.test.ts
```

**Common causes:**
- Missing test dependencies
- Async test not awaiting
- Mock setup issues

---

## Hooks Not Running

```bash
# Check hooks.json syntax
cat plugins/my-plugin/hooks/hooks.json

# Verify hook file exists and is executable
ls -la plugins/my-plugin/hooks/
```

**Common causes:**
- Invalid JSON in hooks.json
- Hook script path is wrong
- Missing shebang in shell scripts
- Exit code not 0 or 2

---

## Pre-commit Hook Blocks Commit

The pre-commit hook runs validation automatically. If it fails:

```bash
# See what's failing
bun run validate

# Fix issues, then commit again
git add .
git commit -m "fix(plugin): resolve validation errors"
```

**Common causes:**
- Plugin validation failures
- Biome lint/format errors
- TypeScript type errors

---

## Commit Message Rejected

Commitlint enforces conventional commit format.

**Format:** `<type>(<scope>): <subject>`

**Valid types:** `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `chore`

**Examples:**
```bash
# Good
git commit -m "feat(git): add commit search tool"
git commit -m "fix(bun-runner): resolve race condition"

# Bad - will be rejected
git commit -m "added new feature"
git commit -m "Fixed bug"
```

---

## Quick Diagnostic Commands

| Issue | Command |
|-------|---------|
| Validation status | `bun run validate` |
| TypeScript errors | `bun typecheck` |
| Lint issues | `bun run check` |
| Test failures | `bun test` |
| Full CI check | `bun run ci:full` |
| Plugin-specific validation | `claude plugin validate plugins/<name>` |
