# Para Obsidian

**CLI + MCP server for PARA-style Obsidian vault management** with frontmatter validation, template versioning, LLM-assisted content injection, and git auto-commit.

---

## Quick Reference

**Type:** Claude Code Plugin (CLI + MCP Server)
**Language:** TypeScript (strict mode)
**Runtime:** Bun
**Test Framework:** Bun test (`*.test.ts` alongside source)
**Linter:** Biome (inherits from monorepo root)

**Slash Commands:**
- `/create` - Create new notes with template selection
- `/create-classifier` - Create inbox classifiers with template integration
- `/create-note-template` - Create standalone Templater templates
- `/search` - Search notes by content or metadata
- `/validate` - Validate frontmatter and templates
- `/commit` - Git commit with auto-staging

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
bun run src/debug-llm.ts           # Debug LLM classification chain
bun run src/cli.ts create-classifier    # Classifier creation wizard
bun run src/cli.ts create-note-template # Template creation wizard
```

---

## Directory Structure

```
para-obsidian/
├── src/
│   ├── cli.ts                 # CLI entry point (19 commands)
│   ├── debug-llm.ts           # LLM classification debug script
│   ├── cli/                   # CLI command handlers
│   │   ├── index.ts           # Barrel exports
│   │   ├── config.ts          # Config/info commands
│   │   ├── create.ts          # Note creation
│   │   ├── frontmatter/       # Frontmatter subcommands
│   │   ├── git.ts             # Git integration
│   │   ├── links.ts           # Link management
│   │   ├── notes.ts           # CRUD operations
│   │   ├── process-inbox.ts   # Inbox processing (with execute command)
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
│   │   ├── classify/          # LLM classification, converters, classifiers
│   │   │   ├── classifiers/   # NEW: Classifier registry system
│   │   │   │   ├── definitions/  # Built-in classifiers (invoice, booking, etc.)
│   │   │   │   ├── registry.ts   # Schema versioning
│   │   │   │   ├── loader.ts     # Classifier matching
│   │   │   │   └── migrations/   # Schema migrations
│   │   │   ├── converters/    # Legacy converter system (being phased out)
│   │   │   └── detection/     # Content processors (PDF, etc.)
│   │   ├── scan/              # Content extractors (md, pdf, image)
│   │   ├── execute/           # Suggestion execution (with filename collision handling)
│   │   ├── registry/          # Processed item tracking
│   │   └── ui/                # Interactive CLI adapter (with inline warnings)
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
│   ├── create-classifier.md   # Classifier creation guide
│   ├── create-note-template.md # Template creation guide
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
│   ├── ROADMAP.md             # Planned features
│   └── USAGE_EXAMPLES.md      # Command usage examples
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
| `src/cli/create-classifier.ts` | Classifier creation wizard |
| `src/cli/create-note-template.ts` | Template creation wizard |
| `src/inbox/classify/classifiers/generator.ts` | Classifier code generation |
| `src/inbox/classify/classifiers/registry-updater.ts` | AST-based registry updates |
| `src/templates/wizard.ts` | Template configuration wizard |
| `src/templates/generator.ts` | Template file generation |
| `src/shared/atomic-fs.ts` | Atomic file operations |
| `src/shared/transaction.ts` | Transaction with rollback |
| `src/shared/file-lock.ts` | File locking for concurrency |

---

## Architecture

### Entry Points

1. **CLI** (`src/cli.ts`)
   - Command pattern with domain-organized handlers
   - 19 commands: config, list, read, search, create, insert, rename, delete, frontmatter (6 subcommands), git, process-inbox (scan/execute), etc.
   - Debug tooling: `src/debug-llm.ts` for testing LLM classification chain

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
Extract  Classifier Build    User      Create
content  Registry  suggestions approve  notes
(Git guard) (Schema versioning) (LLM fallback) (Inline warnings) (Collision safe)
```

**New Features:**
- **Classifier Registry**: Modular classifier definitions with schema versioning and migrations
- **Git Guard**: Checks for uncommitted changes before LLM processing
- **LLM Fallback Transparency**: Shows which fields used LLM vs heuristics
- **Filename Collision Handling**: Automatic deduplication when creating notes
- **Enhanced CLI**: Execute command, inline warnings, improved UX
- **Classifier Creation Wizard**: Interactive classifier generation with template integration
- **Template Creation Wizard**: Standalone Templater template generation

### Reliability Features

**Atomic Operations:**
- All file writes use temp+rename pattern for crash safety
- Ensures no partial writes or corrupted files
- Template and classifier generation are atomic

**Transaction System:**
- Multi-step operations wrapped in transactions with rollback
- Automatic cleanup on failure (removes partial files)
- Used for classifier creation (code + registry + template)

**Concurrency Protection:**
- File locking prevents concurrent modifications to critical files
- Registry updates are serialized to prevent corruption
- Lock cleanup on process exit or crash

**Input Validation:**
- Path traversal prevention (blocks `../` patterns)
- ReDoS protection (validates regex patterns before use)
- Sanitizes user input for file names and code generation

---

## Configuration

**Environment Variables:**
- `PARA_VAULT` (required) - Path to Obsidian vault
- `PARA_OBSIDIAN_CONFIG` (optional) - Custom config path

**Config Files (merged in order):**
1. Built-in defaults (autoCommit: true by default)
2. `~/.config/para-obsidian/config.json`
3. `.para-obsidianrc` (project root)
4. Environment overrides

**Git Integration:**
- Auto-commit enabled by default for vault operations
- Git guard checks for uncommitted changes before LLM processing
- Attachments folder excluded from git guard checks

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

## Resources

| Resource | Location |
|----------|----------|
| Usage Examples | `@./docs/USAGE_EXAMPLES.md` |
| Security Guide | `@./docs/SECURITY.md` |
| Troubleshooting | `@./docs/TROUBLESHOOTING.md` |
| Roadmap | `@./docs/ROADMAP.md` |
| Spec | `@./docs/SPEC.md` |

---

## Notes

- Inherits TypeScript config from monorepo root (`extends: "../../tsconfig.json"`)
- Inherits Biome config from monorepo root
- Uses `workspace:*` protocol for `@sidequest/core`
- MCP server requires `PARA_VAULT` environment variable
- LLM features require local Ollama instance

**Security Mitigations:**
- Path traversal prevention in all file operations
- ReDoS protection for user-provided regex patterns
- Concurrent modification protection via file locking
- Registry corruption prevention through atomic updates
- Input sanitization for code generation (prevents injection)
- Transaction rollback prevents partial state on failures
