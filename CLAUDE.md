# SideQuest Marketplace

**ADHD-friendly Claude Code plugin marketplace** - A curated collection of plugins extending Claude Code with MCP servers, slash commands, skills, and hooks.

---

## CRITICAL RULES

**Plugin Validation (BLOCKING):**
- **YOU MUST** pass `bun run validate` before commits
- Pre-commit hook runs validation automatically - fix failures immediately
- CI pipeline fails on any invalid plugin

**Workspace Dependencies:**
- **ALWAYS** use workspace protocol: `"dependency": "workspace:*"` for cross-plugin deps
- **ALWAYS** run `bun install` from root after adding dependencies
- **NEVER** create circular dependencies between plugins

**MCP Server Conventions:**
- Tool names: `mcp__plugin_<plugin-name>_<server-name>__<tool_name>`
- **ALWAYS** include `response_format` parameter: `"markdown"` (default) or `"json"`
- **ALWAYS** add `isError: true` flag to error responses

---

## Project Structure

```
side-quest-marketplace/
├── plugins/                    # Workspace packages (each plugin is independent)
│   ├── atuin/                 # Bash history search via Atuin MCP
│   ├── bun-runner/            # Test runner & linter integration
│   ├── claude-code-claude-md/ # CLAUDE.md initialization & management
│   ├── claude-code-docs/      # Claude Code documentation lookup
│   ├── firecrawl/             # Web scraping via Firecrawl API
│   ├── git/                   # Git intelligence MCP tools
│   ├── kit/                   # Kit CLI integration for codebase search
│   ├── mcp-manager/           # MCP server management commands
│   ├── para-brain/            # Obsidian PARA method integration
│   ├── plugin-template/       # Plugin scaffolding generator
│   └── validate-plugin/       # Plugin validation hooks
├── .claude-plugin/            # Marketplace metadata (plugin.json)
├── .husky/                    # Git hooks (commit-msg, pre-commit)
├── biome.json                 # Biome linting & formatting config
├── commitlint.config.js       # Conventional commits enforcement
├── package.json               # Root workspace configuration
├── pnpm-workspace.yaml        # Workspace package definitions
└── tsconfig.base.json         # Shared TypeScript configuration
```

---

## Commands

```bash
bun install          # Install all workspace dependencies
bun test             # Run tests across all plugins
bun typecheck        # Type check all packages
bun run check        # Biome lint + format (with --write)
bun run ci:full      # Full CI: typecheck + check + test + validate
bun run validate     # Validate all Claude plugins
```

### Plugin-Specific

```bash
bun --filter <plugin> test       # Test specific plugin
bun --filter <plugin> typecheck  # Type check specific plugin
claude plugin validate plugins/<plugin>  # Validate single plugin
```

---

## Plugin Development

Full guide with examples: @./PLUGIN_DEV_GUIDE.md

### Quick Reference

**Plugin structure:**
```
my-plugin/
├── .claude-plugin/plugin.json  # Metadata (REQUIRED)
├── commands/*.md               # Slash commands
├── hooks/hooks.json           # Event hooks
├── mcp-servers/*/index.ts     # MCP servers
├── skills/*/SKILL.md          # Agent skills
└── src/*.ts                   # TypeScript source
```

**MCP tool naming:** `mcp__plugin_<plugin>_<server>__<tool>`

**Create new plugin:**
```bash
/plugin-template:create my-plugin
```

---

## Code Conventions

### TypeScript

- Strict mode (`tsconfig.base.json` has `strict: true`)
- Bun types for runtime APIs
- `noEmit: true` (Bun handles transpilation)

### Biome

- Recommended rules with `noNonNullAssertion: off`
- Tab indentation
- Test overrides for `*.test.ts` files

### Testing

- Framework: Bun test (native)
- Pattern: `*.test.ts` alongside source
- Run: `bun test` or `bun test <file>`

### File Naming

- `kebab-case` for files and directories
- `*.test.ts` for tests
- `*.md` for docs and commands

---

## Git Workflow

### Conventional Commits (REQUIRED)

Format: `<type>(<scope>): <subject>`

| Type | Usage |
|------|-------|
| `feat` | New feature |
| `fix` | Bug fix |
| `docs` | Documentation |
| `refactor` | Code restructure |
| `test` | Tests |
| `chore` | Maintenance |

**Scopes:** Plugin name (`git`, `atuin`, `kit`) or `root` for workspace-level

**Examples:**
```bash
feat(git): add commit search MCP tool
fix(bun-runner): resolve stream race condition
chore(root): upgrade Biome to 2.3.7
```

### Hooks

- **commit-msg:** Validates conventional commit format
- **pre-commit:** Runs `bun run validate`

### Branches

- `main` - Production-ready
- `feature/*` - New features
- `fix/*` - Bug fixes

---

## Workspace Management

### Adding Dependencies

```bash
# To specific plugin
cd plugins/my-plugin && bun add <package>

# Cross-plugin dependency (in package.json)
{ "dependencies": { "other-plugin": "workspace:*" } }

# Root dev dependency
bun add -D <package>
```

### Validation Checks

- `plugin.json` schema compliance
- Referenced files exist (commands, skills, hooks)
- MCP server structure valid
- TypeScript compiles

---

## Troubleshooting

Quick solutions: @./TROUBLESHOOTING.md

| Issue | Quick Fix |
|-------|-----------|
| Validation fails | `claude plugin validate plugins/<name>` |
| Deps not resolving | `bun install` from root |
| MCP server issues | Check `.mcp.json`, test with `bun run` |
| TypeScript errors | `bun typecheck` |
| Commit rejected | Use conventional format: `type(scope): subject` |

---

## Key Files

| File | Purpose |
|------|---------|
| `tsconfig.base.json` | Shared TypeScript config (strict mode) |
| `biome.json` | Linting and formatting rules |
| `commitlint.config.js` | Commit message enforcement |
| `package.json` | Root workspace scripts |

---

## Resources

- **Plugin guide:** @./PLUGIN_DEV_GUIDE.md
- **Troubleshooting:** @./TROUBLESHOOTING.md
- **Claude Code docs:** `/claude-code-docs:help`
- **Example plugins:** `git`, `atuin`, `kit` for MCP patterns
- **Scaffolding:** `/plugin-template:create` to generate new plugins
