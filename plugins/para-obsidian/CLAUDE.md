# Para Obsidian

**CLI + MCP server for PARA-style Obsidian vault management** with frontmatter validation, template versioning, LLM-assisted content injection, and git auto-commit.

---

## Quick Reference

**Type:** Claude Code Plugin (CLI + MCP Server)
**Language:** TypeScript (strict mode)
**Runtime:** Bun
**Test Framework:** Bun test (`*.test.ts` alongside source)
**Linter:** Biome (inherits from monorepo root)

---

## Commands

```bash
bun test --recursive     # Run all tests
bun typecheck            # TypeScript type checking
bun run check            # Biome lint + format (auto-fix)
bun run lint             # Biome lint only
bun run format           # Biome format only
```

**CLI Usage:**
```bash
bun run src/cli.ts <command> [options]
```

---

## Directory Structure

```
para-obsidian/
├── src/
│   ├── cli.ts                 # CLI entry point (19 commands)
│   ├── cli/                   # CLI command handlers
│   │   ├── index.ts           # Barrel exports
│   │   ├── config.ts          # Config/info commands
│   │   ├── create.ts          # Note creation
│   │   ├── frontmatter/       # Frontmatter subcommands
│   │   ├── git.ts             # Git integration
│   │   ├── links.ts           # Link management
│   │   ├── notes.ts           # CRUD operations
│   │   ├── process-inbox.ts   # Inbox processing
│   │   └── search.ts          # Search commands
│   ├── mcp-handlers/          # MCP tool implementations (6 modules)
│   │   ├── config.ts          # para_config, para_templates
│   │   ├── files.ts           # para_list, para_read, para_create, etc.
│   │   ├── frontmatter.ts     # para_frontmatter_*, para_hints
│   │   ├── indexer.ts         # para_index_*, para_list_*
│   │   ├── links.ts           # para_rewrite_links
│   │   └── search.ts          # para_search, para_semantic
│   ├── inbox/                 # Inbox processing framework
│   │   ├── core/              # Engine, operations, staging
│   │   ├── classify/          # LLM classification, converters
│   │   ├── scan/              # Content extractors (md, pdf, image)
│   │   ├── execute/           # Suggestion execution
│   │   ├── registry/          # Processed item tracking
│   │   └── ui/                # Interactive CLI adapter
│   ├── frontmatter/           # Frontmatter utilities
│   │   ├── parse.ts           # YAML parsing
│   │   ├── validate.ts        # Type-specific validation
│   │   ├── migrate.ts         # Template version migrations
│   │   └── update.ts          # Field updates
│   ├── llm/                   # LLM orchestration
│   │   ├── client.ts          # Ollama client
│   │   ├── orchestration.ts   # Conversion workflows
│   │   ├── prompt-builder.ts  # Prompt templates
│   │   └── constraints.ts     # Output constraints
│   ├── notes/                 # Note CRUD operations
│   ├── links/                 # Link rewriting, orphan detection
│   ├── search/                # Text/semantic search
│   ├── templates/             # Template loading, migrations
│   ├── config/                # Configuration management
│   ├── git/                   # Git operations, auto-commit
│   ├── attachments/           # Attachment handling
│   ├── shared/                # Shared utilities (fs, logger)
│   ├── testing/               # Test utilities
│   └── utils/                 # General utilities
├── mcp/
│   ├── index.ts               # MCP server entry point
│   └── utils.ts               # MCP utilities
├── commands/                  # Slash commands
│   ├── create.md
│   ├── search.md
│   ├── validate.md
│   └── commit.md
├── skills/                    # Claude skills
│   ├── template-assistant/    # Template selection skill
│   └── field-suggestions/     # Field value suggestion skill
├── hooks/
│   └── hooks.json             # Plugin hooks
├── docs/                      # Documentation
│   ├── SPEC.md                # Working specification
│   ├── STATUS.md              # Feature status
│   └── ROADMAP.md             # Planned features
└── .claude-plugin/
    └── plugin.json            # Plugin manifest
```

---

## Key Files

| File | Purpose |
|------|---------|
| `src/cli.ts` | CLI entry point with 19 commands |
| `mcp/index.ts` | MCP server entry (20+ tools) |
| `src/config/defaults.ts` | Default frontmatter rules, templates |
| `src/inbox/core/engine.ts` | Inbox processing engine |
| `src/frontmatter/validate.ts` | Frontmatter validation rules |

---

## Architecture

### Entry Points

1. **CLI** (`src/cli.ts`)
   - Command pattern with domain-organized handlers
   - 19 commands: config, list, read, search, create, insert, rename, delete, frontmatter (6 subcommands), git, process-inbox, etc.

2. **MCP Server** (`mcp/index.ts`)
   - 20+ tools via `@sidequest/core/mcp`
   - Tool modules register via side-effect imports
   - Tool naming: `mcp__para-obsidian_para-obsidian__<tool_name>`

### Module Organization

- **cli/** - Command handlers (barrel exported via `index.ts`)
- **inbox/** - 5-stage inbox processing framework
- **frontmatter/** - Parse, validate, update, migrate
- **llm/** - Ollama-based content extraction/conversion
- **mcp-handlers/** - MCP tool implementations

### Inbox Processing Pipeline

```
scan → classify → suggest → review → execute
  ↓        ↓         ↓         ↓         ↓
Extract  LLM      Build    User      Create
content  detect   suggestions approve  notes
```

---

## Configuration

**Environment Variables:**
- `PARA_VAULT` (required) - Path to Obsidian vault
- `PARA_OBSIDIAN_CONFIG` (optional) - Custom config path

**Config Files (merged in order):**
1. Built-in defaults
2. `~/.config/para-obsidian/config.json`
3. `.para-obsidianrc` (project root)
4. Environment overrides

---

## MCP Tools

The plugin provides 20+ MCP tools organized by domain:

| Domain | Tools |
|--------|-------|
| Config | `para_config`, `para_templates`, `para_template_fields` |
| Files | `para_list`, `para_read`, `para_create`, `para_insert`, `para_rename`, `para_delete` |
| Search | `para_search`, `para_semantic` |
| Index | `para_index_prime`, `para_index_query`, `para_list_areas`, `para_list_tags` |
| Frontmatter | `para_frontmatter_get`, `para_frontmatter_validate`, `para_frontmatter_set`, `para_hints` |
| Links | `para_rewrite_links`, `para_find_orphans` |

**Tool Response Format:** Always include `response_format: "json"` for token efficiency.

---

## Testing

- **Pattern:** `*.test.ts` alongside source files
- **Framework:** Bun test native
- **Utilities:** `src/testing/utils.ts` (createTestVault, setupTestVault)

```bash
bun test                     # All tests
bun test src/inbox           # Inbox tests only
bun test --watch             # Watch mode
```

---

## Git Workflow

- **Commits:** Conventional format `type(para-obsidian): subject`
- **Hooks:** Pre-commit runs monorepo validation
- **Auto-commit:** Supported for vault operations (optional)

---

## Dependencies

**Runtime:**
- `@sidequest/core` - Shared utilities (workspace dependency)
- `@inquirer/prompts` - Interactive CLI prompts
- `date-fns` - Date utilities
- `yaml` - YAML parsing
- `nanospinner` - CLI spinners
- `p-limit` - Concurrency control

---

## Notes

- Inherits TypeScript config from monorepo root (`extends: "../../tsconfig.json"`)
- Inherits Biome config from monorepo root
- Uses `workspace:*` protocol for `@sidequest/core`
- MCP server requires `PARA_VAULT` environment variable
- LLM features require local Ollama instance
