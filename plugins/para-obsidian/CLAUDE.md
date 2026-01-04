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
- `/slo` - Monitor SLO health and performance metrics
- `/trace` - Trace operation logs by correlation ID

**Key Features:**
- Intelligent inbox processing with LLM-assisted classification
- **Type A/B Document Processing** - DOCX files with mammoth/turndown for text & markdown extraction
- **Enrichment Pipeline with Strategy Pattern** - YouTube transcript enrichment, bookmark content enrichment
- **Routing Module** - Move processed notes from inbox to PARA destinations based on frontmatter
- **SLO Tracking & Performance Monitoring** - 7 SLOs with burn rate analysis and alerting
- **Session-based Correlation Tracking** - Track operations across async boundaries with W3C trace context
- Web bookmark management via Obsidian Web Clipper integration
- **Registry Restricted to Attachments** - Deduplication now tracks only attachment processing (breaking change)
- PARA-based organization (Projects/Areas/Resources/Archives)
- Template versioning and migration system
- Atomic operations with transaction rollback

**Breaking Changes (v2.0):**
- Removed interactive destination assignment - destinations now derived from frontmatter area/project
- Removed tags feature in favor of Obsidian properties

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
# Inbox processing (shorter aliases)
para scan                          # Scan inbox for new files
para execute                       # Execute approved suggestions
para move                          # Move notes to PARA destinations based on frontmatter
para export                        # Export bookmarks to browser format
para init [--quick]                # Create new classifier (wizard)
para registry list|remove|clear    # Manage processed items registry

# Full commands (also work)
para process-inbox [--auto] [--preview] [--dry-run]
para inbox move                    # Move notes from inbox to PARA folders
para export-bookmarks [--filter type:bookmark]
para create-classifier
para create-note-template

# Enrichment commands
para enrich youtube --all          # Enrich all YouTube bookmarks with transcripts
para enrich youtube "<file.md>"    # Enrich specific file
para enrich-bookmark <file.md>     # Enrich bookmark with Firecrawl

# Performance & Observability
para slo [slo-name|--breaches]     # Monitor SLO health, burn rates, violations
para trace <correlation-id>         # Trace operation logs with parent-child relationships

# Migration
para migrate:remove-tags [--dry-run]  # Remove tags in favor of properties
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
│   │   ├── create-classifier.ts # Classifier creation wizard (--quick flag)
│   │   ├── export-bookmarks.ts  # Export bookmarks to browser format
│   │   ├── frontmatter/       # Frontmatter subcommands
│   │   ├── git.ts             # Git integration
│   │   ├── links.ts           # Link management
│   │   ├── notes.ts           # CRUD operations
│   │   ├── process-inbox.ts   # Inbox processing (visual progress bars)
│   │   ├── registry.ts        # Registry management (list, remove, clear)
│   │   ├── search.ts          # Search commands
│   │   └── shared/            # Shared CLI utilities
│   │       ├── session.ts     # Session tracking with correlation IDs
│   │       └── index.ts       # Barrel exports
│   ├── mcp-handlers/          # MCP tool implementations (6 modules)
│   │   ├── config.ts          # para_config, para_templates
│   │   ├── files.ts           # para_list, para_read, para_create, etc.
│   │   ├── frontmatter.ts     # para_frontmatter_*, para_hints
│   │   ├── indexer.ts         # para_index_*, para_list_*
│   │   ├── links.ts           # para_rewrite_links
│   │   └── search.ts          # para_search, para_semantic
│   ├── inbox/                 # Inbox processing framework
│   │   ├── core/              # Engine, operations, staging
│   │   │   └── testing/       # DRY test helpers (initGitRepo, createTestEngine, createVaultStructure)
│   │   ├── classify/          # LLM classification, converters, classifiers
│   │   │   ├── classifiers/   # Classifier registry system
│   │   │   │   ├── definitions/  # Built-in classifiers (invoice, booking, bookmark, medical-statement, cv, letter, employment-contract, document)
│   │   │   │   ├── registry.ts   # Schema versioning
│   │   │   │   ├── loader.ts     # Classifier matching
│   │   │   │   ├── services/     # Pattern builder, scoring calculator, field mapper
│   │   │   │   └── migrations/   # Schema migrations
│   │   │   ├── converters/    # Legacy converter system (being phased out)
│   │   │   └── detection/     # Content processors (PDF, etc.)
│   │   ├── scan/              # Content extractors (md, pdf, image, docx)
│   │   │   └── extractors/    # File type handlers with DOCX support (mammoth/turndown)
│   │   ├── enrich/            # Enrichment pipeline (Strategy Pattern)
│   │   │   ├── strategies/    # YouTube strategy, Bookmark strategy
│   │   │   ├── pipeline.ts    # Enrichment orchestration
│   │   │   └── types.ts       # Enrichment types and errors
│   │   ├── routing/           # Move notes from inbox to PARA destinations
│   │   │   ├── scanner.ts     # Find routable notes
│   │   │   ├── resolver.ts    # Resolve destinations from frontmatter
│   │   │   └── executor.ts    # Execute moves with colocate support
│   │   ├── execute/           # Suggestion execution (with filename collision handling)
│   │   ├── registry/          # Processed item tracking
│   │   ├── ui/                # Interactive CLI adapter (with inline warnings)
│   │   └── shared/            # Cross-cutting concerns
│   │       ├── errors.ts      # InboxError types
│   │       ├── context.ts     # Inbox context types
│   │       ├── slos.ts        # 7 SLO definitions and tracking
│   │       ├── slos-persistence.ts  # JSONL-based SLO event storage
│   │       ├── thresholds.ts  # Performance thresholds
│   │       └── index.ts       # Public exports
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
│   │   ├── atomic-fs.ts       # Atomic file operations
│   │   ├── transaction.ts     # Transaction with rollback
│   │   ├── file-lock.ts       # File locking
│   │   ├── instrumentation.ts # Performance tracking
│   │   ├── logger.ts          # Structured logging
│   │   ├── resource-metrics.ts # LLM token usage tracking
│   │   └── validation.ts      # Input validation
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
│   ├── commit.md
│   ├── slo.md                 # SLO monitoring command
│   └── trace.md               # Trace analysis command
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
| `src/cli.ts` | CLI entry point with 30+ commands (including aliases) |
| `mcp/index.ts` | MCP server entry (20+ tools) |
| `src/config/defaults.ts` | Default frontmatter rules, templates |
| `src/inbox/core/engine.ts` | Inbox processing engine |
| `src/frontmatter/validate.ts` | Frontmatter validation rules |
| `src/cli/create-classifier.ts` | Classifier creation wizard (--quick flag) |
| `src/cli/create-note-template.ts` | Template creation wizard |
| `src/cli/process-inbox.ts` | Scan/execute with visual progress bars |
| `src/cli/export-bookmarks.ts` | Export bookmarks to browser format |
| `src/cli/registry.ts` | Registry management (list, remove, clear) |
| `src/inbox/classify/classifiers/generator.ts` | Classifier code generation |
| `src/inbox/classify/classifiers/registry-updater.ts` | AST-based registry updates |
| `src/inbox/classify/classifiers/definitions/bookmark.ts` | Web bookmark classifier |
| `src/inbox/enrich/pipeline.ts` | Enrichment pipeline with Strategy Pattern |
| `src/inbox/enrich/strategies/youtube-strategy.ts` | YouTube transcript enrichment |
| `src/inbox/routing/executor.ts` | Move notes from inbox to PARA destinations |
| `src/inbox/scan/extractors/docx.ts` | DOCX extraction with mammoth/turndown |
| `src/inbox/core/testing/helpers.ts` | DRY test utilities (initGitRepo, createTestEngine) |
| `src/templates/wizard.ts` | Template configuration wizard |
| `src/templates/generator.ts` | Template file generation |
| `src/shared/atomic-fs.ts` | Atomic file operations |
| `src/shared/transaction.ts` | Transaction with rollback |
| `src/shared/file-lock.ts` | File locking for concurrency |
| `src/shared/resource-metrics.ts` | LLM token usage and resource tracking |
| `commands/slo.md` | SLO health monitoring slash command |
| `commands/trace.md` | Correlation ID trace analysis command |
| `src/cli/shared/session.ts` | Session tracking and lifecycle management |
| `src/inbox/shared/slos.ts` | 7 SLO definitions (latency, success, availability) |
| `src/inbox/shared/slos-persistence.ts` | JSONL-based SLO event storage |
| `src/inbox/shared/thresholds.ts` | Performance threshold constants |

---

## Architecture

### Entry Points

1. **CLI** (`src/cli.ts`)
   - Command pattern with domain-organized handlers
   - 23 commands with shorter aliases: scan, execute, export, init, registry
   - Visual progress bars for scan/execute operations
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
scan → enrich → classify → suggest → review → execute → route
  ↓       ↓         ↓          ↓         ↓        ↓        ↓
Extract  YouTube  Classifier  Build    User    Create   Move to
content  transcripts Registry  suggestions approve notes  PARA
(Git guard) (Firecrawl) (Schema ver) (LLM fallback) (Warnings) (Collision safe) (Colocate)
```

**Recent Features:**
- **Type A/B Document Processing**: DOCX files with mammoth/turndown for text & markdown
- **Enrichment Pipeline**: Strategy Pattern for YouTube transcripts, bookmark content
- **Routing Module**: Move processed notes from inbox to PARA destinations
- **Colocate Support**: Auto-creates folders for file-only areas/projects
- **DRY Test Helpers**: Shared `initGitRepo`, `createTestEngine`, `createVaultStructure`
- **New Classifiers**: cv, letter, employment-contract, document (in addition to existing)
- **Classifier Services**: Pattern builder, scoring calculator, field mapper
- **Classifier Registry**: Modular classifier definitions with schema versioning and migrations
- **Bookmark Classifier**: Web bookmark classification from Obsidian Web Clipper
- **Export Bookmarks**: Export vault bookmarks to browser-compatible format
- **Git Guard**: Checks for uncommitted changes before LLM processing
- **LLM Fallback Transparency**: Shows which fields used LLM vs heuristics
- **Filename Collision Handling**: Automatic deduplication when creating notes
- **Timestamped Attachments**: Unique attachment filenames prevent collisions
- **Enhanced CLI UX**: Visual progress bars, shorter command aliases
- **Enhanced Review Commands**: Approve-all (A), back (b), list (l) navigation
- **Quick-Start Wizard**: `--quick` flag for fast classifier creation
- **Registry Management**: List, remove, clear processed items

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

**Observability & Tracing:**
- **OpenTelemetry-compatible correlation IDs** following W3C Trace Context specification
- **Three-tier ID hierarchy** for distributed tracing:
  - `sessionCid` (trace_id): Session-level identifier present in ALL logs
  - `cid` (span_id): Unique operation identifier for each logical unit of work
  - `parentCid` (parent_span_id): Links child operations to their parent
- **Structured logging** with consistent fields across all subsystems
- **End-to-end traceability** across async operations (scan → classify → enrich → execute)
- **Maturity level: 4/5 (Adaptive)** - Full trace correlation with parent-child relationships
- See `@./OBSERVABILITY_IMPROVEMENTS.md` for implementation details and trace examples

**Log Message Pattern (REQUIRED):**

All log messages MUST follow the `{domain}:{verb}:{status}` pattern using tagged template literals:

```typescript
// Pattern: domain:verb:status key=${value}
logger.info`inbox:scan:start cid=${cid} sessionCid=${sessionCid}`;
logger.info`inbox:scan:complete filesFound=${count} durationMs=${ms}`;
logger.error`inbox:process:error cid=${cid} file=${path} error=${err.message}`;
```

| Domain | Example Messages |
|--------|------------------|
| `voice` | `voice:transcribe:success`, `voice:process:error` |
| `inbox` | `inbox:scan:start`, `inbox:process:success`, `inbox:llm:fallback` |
| `routing` | `routing:scan:start`, `routing:move:success`, `routing:skip:noDestination` |
| `enrich` | `enrich:youtube:start`, `enrich:youtube:complete` |
| `classify` | `classify:match:filename`, `classify:match:notFound` |
| `cli` | `cli:clipper:start`, `cli:review:command` |
| `fs` | `fs:insert:start`, `fs:insert:success`, `fs:insert:headingNotFound` |

**Rules:**
1. Use tagged template literals: `logger.info\`domain:verb:status\``
2. Dynamic values in template expressions: `${variable}` (not string interpolation)
3. Status words: `start`, `success`, `error`, `skip`, `complete`, `found`, `notFound`
4. Low cardinality - no unique IDs in message text, put in attributes
5. Preserve correlation IDs: `cid`, `sessionCid`, `parentCid`

**Example Trace Hierarchy:**
```
acdfe223 (Session: para scan, 3.2s)
├─ e400fff2: inbox:scan (parent: acdfe223)
│  ├─ df2b9fd7: inbox:processPdf (parent: e400fff2, session: acdfe223)
│  ├─ eae519bd: enrich:bookmark (parent: e400fff2, session: acdfe223)
│  └─ 45c84df0: inbox:skipFastPath (parent: e400fff2, session: acdfe223)
```

**SLO Tracking & Performance Monitoring:**
- **7 Production SLOs** with automated tracking and alerting:
  1. `scan_latency` - 95% scans under 60s (30d window)
  2. `execute_success` - 99% executions succeed (7d window)
  3. `llm_availability` - 80% LLM calls succeed (24h window)
  4. `execute_latency` - 95% executions under 30s (30d window)
  5. `extraction_latency` - 95% extractions under 5s (7d window)
  6. `enrichment_latency` - 95% enrichments under 5s (7d window)
  7. `llm_latency` - 90% LLM calls under 10s (24h window)
- **Burn Rate Analysis** - Error budget consumption tracking
- **JSONL Event Log** - Persistent SLO violation history at `~/.claude/logs/slo-events.jsonl`
- **Dashboard Command** - `/para-obsidian:slo` for real-time health monitoring
- **Trace Analysis** - `/para-obsidian:trace <cid>` for debugging slow operations

**Session Management:**
- Every CLI command gets a unique session correlation ID (displayed in prompt)
- All operations emit structured logs with `sessionCid`, `cid`, and `parentCid`
- Session summary shows total duration and performance thresholds
- Resource metrics track LLM token usage per session

**SLO Alerting:**
- Threshold checks on every operation emit warnings when exceeded
- Error budget tracking prevents silent degradation
- Breach dashboard shows recent violations
- Configurable per-SLO targets and windows

---

## Configuration

**Environment Variables:**
- `PARA_VAULT` (required) - Path to Obsidian vault
- `PARA_OBSIDIAN_CONFIG` (optional) - Custom config path
- `PARA_LLM_MODEL` (optional) - Override LLM model (e.g., "qwen2.5:14b", "haiku")
- `PARA_LLM_FALLBACK_MODEL` (optional) - Fallback model when Claude fails
- `PARA_LLM_TIMEOUT_MS` (optional) - Override LLM timeout in milliseconds

**Config Files (merged in order):**
1. Built-in defaults (autoCommit: true, restrictRegistryToAttachments: true)
2. `~/.config/para-obsidian/config.json`
3. `.para-obsidianrc` (project root)
4. Environment overrides

**Registry Behavior (Breaking Change - See CHANGELOG.md):**
- `restrictRegistryToAttachments: true` (default) - Registry only tracks attachment processing
- Previous behavior tracked all inbox items - now only attachment moves are deduplicated
- Rationale: Reduces registry bloat and aligns with actual use case (prevent duplicate attachment moves)
- Set to `false` in config to restore legacy behavior (tracks all processed inbox items)
- **Migration guide:** See `@./CHANGELOG.md` for detailed migration instructions and rationale

**LLM Timeout Configuration (priority order, highest wins):**
1. `PARA_LLM_TIMEOUT_MS` env var
2. `llmTimeoutMs` in config files
3. Model-aware defaults: 60s (Claude) / 10 min (Ollama)

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
- `mammoth` - DOCX text extraction
- `turndown` - HTML to Markdown conversion

---

## Resources

| Resource | Location |
|----------|----------|
| Usage Examples | `@./docs/USAGE_EXAMPLES.md` |
| Bookmark Workflow | `@./docs/BOOKMARK_WORKFLOW.md` |
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
