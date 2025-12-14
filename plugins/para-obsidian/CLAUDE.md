# Para Obsidian

**PARA-compliant Obsidian vault management CLI + MCP server** - Create notes with AI-powered metadata extraction, validate frontmatter, manage templates, and process inbox items with security-hardened automation.

---

## CRITICAL RULES

**Security & Safety:**
- **NEVER** execute shell commands via string interpolation - always use `Bun.spawn` with array args
- **ALWAYS** validate file existence before AND after processing (TOCTOU mitigation)
- **ALWAYS** use atomic writes (temp file + rename) for registry updates
- **ALWAYS** validate inputs: SHA256 hashes (64 chars), ISO8601 timestamps, non-empty paths
- **ALWAYS** sanitize user prompts to prevent injection attacks

**Environment Configuration:**
- **YOU MUST** set `PARA_VAULT` environment variable (absolute path to Obsidian vault)
- Optional: `PARA_OBSIDIAN_CONFIG` for custom config path
- Config hierarchy: ENV vars → user rc (`~/.config/para-obsidian/config.json`) → project rc (`.para-obsidianrc`) → defaults

**Git Integration:**
- **ALWAYS** check git repo status before write operations
- Auto-commit feature requires clean working tree
- Attachment discovery auto-includes vault attachments in commits

**Testing:**
- **YOU MUST** write tests alongside implementation (TDD preferred)
- Test files use pattern `*.test.ts` alongside source files
- Run `bun test --recursive` before committing

**Architecture:**
- Engine/Interface separation - core logic independent of UI
- Suggestions, not actions - processing returns suggestions requiring human approval
- Idempotent processing - SHA256 registry prevents duplicate processing

---

## Quick Reference

**Type:** Claude Code Plugin (CLI + MCP server) | **Package:** `@sidequest/para-obsidian`
**Language:** TypeScript (strict mode) | **Runtime:** Bun | **Test Framework:** Bun test
**Dependencies:** @inquirer/prompts, date-fns, nanospinner, p-limit, yaml, @sidequest/core

### Directory Structure

```
para-obsidian/
├── src/
│   ├── cli/                   # Modular CLI handlers (12 modules)
│   │   ├── config.ts         # Config display and management
│   │   ├── create.ts         # Note creation with AI extraction
│   │   ├── frontmatter/      # Frontmatter operations (7 submodules)
│   │   │   ├── get.ts        # Get frontmatter values
│   │   │   ├── set.ts        # Set/edit frontmatter
│   │   │   ├── validate.ts   # Validation commands
│   │   │   ├── migrate.ts    # Migration commands
│   │   │   ├── plan.ts       # Plan commands
│   │   │   ├── hints.ts      # Field suggestion helpers
│   │   │   └── index.ts      # Main dispatcher
│   │   ├── git.ts            # Git auto-commit integration
│   │   ├── links.ts          # Link rewriting (rename/move operations)
│   │   ├── notes.ts          # Basic note operations (list/read)
│   │   ├── process-inbox.ts  # Inbox processing entry point
│   │   ├── search.ts         # Search operations (text/semantic)
│   │   └── utils.ts          # Shared CLI utilities
│   ├── inbox/                 # Inbox processing framework (479 tests)
│   │   ├── classify/         # Document classification & converters
│   │   │   ├── converters/   # Template-specific converters
│   │   │   ├── detection/    # PDF extraction + heuristics
│   │   │   └── llm-classifier.ts # AI type detection + field extraction
│   │   ├── core/             # Core engine + utilities
│   │   │   ├── engine.ts     # Processing engine (crash-safe atomic operations)
│   │   │   └── engine-utils.ts # Filename generation utilities
│   │   ├── execute/          # Suggestion execution
│   │   │   ├── executor.ts   # Main execution coordinator
│   │   │   ├── note-creator.ts # Note creation from suggestions
│   │   │   └── attachment-mover.ts # Attachment handling
│   │   ├── registry/         # Idempotency tracking
│   │   │   └── processed-registry.ts # SHA256-based deduplication
│   │   ├── scan/             # Content extraction
│   │   │   └── extractors/   # Pluggable extractor system
│   │   ├── shared/           # Shared utilities
│   │   │   ├── errors.ts     # Error taxonomy (23 error codes)
│   │   │   └── logger.ts     # Structured logging
│   │   └── ui/               # User interface
│   │       └── cli-adapter.ts # Interactive terminal UI
│   ├── attachments/           # Attachment operations
│   │   ├── index.ts          # Attachment discovery and linking
│   │   └── link.ts           # Attachment link utilities
│   ├── config/                # Configuration management
│   │   ├── index.ts          # Configuration loader
│   │   └── defaults.ts       # Default templates and rules
│   ├── frontmatter/           # Frontmatter operations
│   │   ├── parse.ts          # YAML frontmatter parsing
│   │   ├── validate.ts       # Frontmatter validation
│   │   ├── migrate.ts        # Template migration
│   │   └── update.ts         # Frontmatter updates
│   ├── git/                   # Git operations
│   │   └── index.ts          # Git guard and auto-commit
│   ├── links/                 # Link operations
│   │   ├── index.ts          # Link utilities
│   │   ├── rewrite.ts        # Link rewriting for rename/move
│   │   ├── orphans.ts        # Orphaned link detection
│   │   └── clean.ts          # Link cleanup
│   ├── llm/                   # LLM integration utilities
│   │   ├── client.ts         # LLM client abstraction
│   │   ├── orchestration.ts  # AI workflow orchestration
│   │   ├── prompt-builder.ts # Structured prompt generation
│   │   └── constraints.ts    # Field constraints for extraction
│   ├── notes/                 # Note operations
│   │   ├── create.ts         # Note creation engine
│   │   ├── delete.ts         # Safe note deletion
│   │   └── insert.ts         # Content insertion (heading/block)
│   ├── search/                # Search operations
│   │   ├── index.ts          # Text search with filters
│   │   ├── indexer.ts        # Lightweight vault indexing
│   │   └── semantic.ts       # Kit-powered semantic search
│   ├── shared/                # Shared utilities
│   │   ├── fs.ts             # Filesystem utilities
│   │   └── logger.ts         # Structured logging
│   ├── templates/             # Template operations
│   │   ├── index.ts          # Template loading and processing
│   │   └── migrations.ts     # Template versioning and migration
│   ├── testing/               # Test utilities
│   │   └── utils.ts          # Test helpers
│   ├── utils/                 # General utilities
│   │   ├── title.ts          # Title formatting
│   │   └── wikilinks.ts      # Wikilink parsing
│   ├── cli.ts                 # Main CLI entry point
│   └── indexer.ts             # Vault indexer (deprecated, use search/indexer.ts)
├── mcp/
│   ├── index.ts               # MCP server (20 tools, 78KB)
│   ├── frontmatter-hints.ts   # AI-powered frontmatter suggestions
│   └── tools.meta.ts          # Tool metadata registry
├── commands/                  # Slash commands (4 commands)
│   ├── create.md             # AI-powered note creation
│   ├── search.md             # Vault search
│   ├── validate.md           # Frontmatter validation
│   └── commit.md             # Git auto-commit
├── skills/                    # Claude Code skills (2 skills)
│   ├── template-assistant/   # Template creation assistant
│   └── field-suggestions/    # Frontmatter field suggestions
├── STATUS.md                  # Development progress tracker
├── SPEC.md                    # Original specification
├── ROADMAP.md                 # Future enhancements
└── package.json               # CLI binary + scripts
```

---

## Commands

**CLI (via `para-obsidian` binary):**
```bash
# Configuration
para-obsidian config                           # Show resolved config

# Note Operations
para-obsidian list [dir]                       # List notes
para-obsidian read <path>                      # Read note
para-obsidian create --template <type>         # Create from template
para-obsidian create --template <type> --source-text <desc>  # AI extraction
para-obsidian delete <path> [--dry-run]        # Delete note
para-obsidian rename <old> <new> [--dry-run]   # Rename with link rewrite

# Search
para-obsidian search <query>                   # Text search
para-obsidian search <query> --tag <tag>       # Filter by tag
para-obsidian search <query> --frontmatter status=active  # Filter by field
para-obsidian semantic <query>                 # Semantic search (Kit)

# Frontmatter
para-obsidian frontmatter get <path>           # Get frontmatter
para-obsidian frontmatter validate <path>      # Validate against rules
para-obsidian frontmatter set <path> <key>=<val>  # Set field
para-obsidian frontmatter migrate <path>       # Migrate to latest version
para-obsidian frontmatter migrate-all          # Bulk migration
para-obsidian frontmatter plan <type> --to <v> # Plan version bump
para-obsidian frontmatter apply-plan <plan.json>  # Execute migration plan

# Index
para-obsidian index prime                      # Build index
para-obsidian index query --tag <tag>          # Query by tag

# Inbox Processing
para-obsidian process-inbox                    # Interactive inbox processing

# Templates
para-obsidian templates                        # List configured templates
```

**Test:**
```bash
bun test --recursive             # All tests
bun test src/inbox/              # Inbox module tests
bun test src/frontmatter.test.ts # Specific file
```

**Development:**
```bash
bun typecheck                    # TypeScript check
bun run check                    # Biome lint + format
```

---

## Key Modules

### 1. CLI (`src/cli.ts` + `src/cli/`)

Main entry point (`src/cli.ts`, 642 lines) orchestrates 12 modular command handlers:

**Handler Modules:**
- `config.ts` - Display resolved configuration
- `create.ts` - Note creation with AI extraction
- `frontmatter.ts` - Frontmatter get/set/validate/migrate operations
- `git.ts` - Git auto-commit integration
- `links.ts` - Link rewriting for rename/move
- `notes.ts` - Basic CRUD (list/read)
- `process-inbox.ts` - Inbox processing workflow
- `search.ts` - Text and semantic search
- `utils.ts` - Shared formatter utilities

**Key Features:**
- Modular command routing
- Colored terminal output (via @sidequest/core/terminal)
- Auto-discovered attachments for git commits
- Frontmatter hints and field suggestions
- Dry-run support for destructive operations

### 2. Inbox Processing (`src/inbox/`)

**Security-hardened automation framework** for processing inbox items with AI.

**Core Components:**
- `engine.ts` (33KB) - Main processing engine factory
- `registry.ts` (13KB) - SHA256-based idempotency tracking with file locking
- `pdf-processor.ts` (17KB) - PDF extraction with security hardening
- `llm-detection.ts` (12KB) - AI type detection and field extraction
- `cli-adapter.ts` (15KB) - Interactive terminal UI
- `errors.ts` (9KB) - 23 error codes with recovery strategies

**Architecture:**
- **Suggestions, not actions** - Never mutates state, returns suggestions
- **Human approval required** - Nothing executes without consent
- **Idempotent processing** - SHA256 registry prevents duplicate work
- **Extensible converters** - Plugin system for custom file types

**Test Coverage:** 246 tests across 10 test files

**Usage Pattern:**
```typescript
const engine = createInboxEngine({ vaultPath: "/path/to/vault" });
const suggestions = await engine.scan();          // Generate suggestions
const updated = await engine.editWithPrompt(id, prompt);  // Refine with AI
const results = await engine.execute([id1, id2]); // Execute approved
```

See `src/inbox/CLAUDE.md` for comprehensive documentation.

### 3. Frontmatter Management (`src/frontmatter.ts`)

**Core module** (41KB) for frontmatter parsing, validation, and migration.

**Capabilities:**
- Parse/serialize YAML frontmatter
- Validate against type-specific rules
- Template version tracking
- Migration with hooks (tag backfills, status normalization)
- Field suggestions based on note type
- Strict mode with warnings-as-errors

**Default Template Versions:** All templates at version 2

**Supported Note Types:**
- project, area, resource, task
- daily, weekly-review, capture, checklist
- booking, itinerary, trip-research

**Validation Rules:**
```typescript
{
  project: {
    required: ["type", "created", "modified", "status", "project_area"],
    statusEnum: ["active", "on-hold", "completed", "archived"]
  },
  area: {
    required: ["type", "created", "modified", "status", "area_responsibility"],
    statusEnum: ["active", "inactive", "delegated"]
  }
  // ... (9 more types)
}
```

### 4. MCP Server (`mcp/index.ts`)

**20 MCP tools** for vault operations (78KB):

| Tool | Purpose |
|------|---------|
| `para_config` | Get resolved configuration |
| `para_list` | List notes in directory |
| `para_read` | Read note content |
| `para_search` | Text search with filters |
| `para_semantic_search` | Kit-powered semantic search |
| `para_index_prime` | Build vault index |
| `para_index_query` | Query index by tag/frontmatter |
| `para_create` | Create note from template |
| `para_insert` | Insert content at heading/block |
| `para_rename` | Rename with link rewriting |
| `para_delete` | Delete note (with confirm) |
| `para_frontmatter_get` | Get frontmatter |
| `para_frontmatter_validate` | Validate frontmatter |
| `para_frontmatter_set` | Set frontmatter field |
| `para_frontmatter_migrate` | Migrate single note |
| `para_frontmatter_migrate_all` | Bulk migration |
| `para_frontmatter_plan` | Plan version bump |
| `para_frontmatter_apply_plan` | Execute migration plan |
| `para_templates` | List templates |
| `para_suggest_frontmatter` | AI field suggestions |

**All tools support:**
- `response_format: "json" | "markdown"` (default: markdown)
- Error responses with `isError: true` flag

### 5. LLM Integration (`src/llm/`)

**AI-powered metadata extraction** for note creation and inbox processing.

**Modules:**
- `orchestration.ts` (25KB) - Multi-stage AI workflows
- `prompt-builder.ts` (15KB) - Structured prompt construction
- `constraints.ts` (13KB) - Field-level constraints for extraction

**Uses @sidequest/core/llm** for model routing (Claude headless CLI or Ollama API).

### 6. Template System (`src/templates.ts`)

**Template loader** with Templater-style variable substitution (19KB).

**Features:**
- Load from `<vault>/06_Metadata/Templates`
- Title Case filename generation
- Variable substitution (`tp.file.title`, `tp.date.now()`)
- Version tracking in frontmatter
- Default template versions configured in `src/defaults.ts`

**Template Catalog:**
- project, area, resource, task
- daily, weekly-review, capture, checklist
- booking, itinerary, trip-research

### 7. Link Rewriting (`src/rewrite-links.ts`)

**Link rewriting engine** for rename/move operations (9KB).

**Supports:**
- Wikilinks: `[[Note]]`, `[[Note|Alias]]`
- Markdown links: `[text](path.md)`
- Dry-run mode
- Vault-scoped rewrites only

### 8. Search & Indexing

**Text Search** (`src/search.ts` - 8KB):
- Ripgrep-based text search
- Frontmatter filters: `status=active`, `type=project`
- Tag filters: `--tag work`
- Multi-directory scoping

**Semantic Search** (`src/semantic.ts` - 8KB):
- Kit-powered vector search
- Directory-aware results
- Fallback to text search if Kit unavailable

**Indexer** (`src/indexer.ts` - 9KB):
- Lightweight index (frontmatter/tags/headings)
- Build/save/load from `.para-obsidian-index.json`
- Fast queries without full vault scan

### 9. Git Integration (`src/git.ts`)

**Git operations** with safety checks (19KB).

**Features:**
- Repo presence check
- Clean status validation
- Auto-commit after write operations
- Attachment auto-discovery
- Custom commit message templates

**Auto-commit Flow:**
```typescript
await gitAutoCommit({
  vaultPath: "/path/to/vault",
  paths: ["01_Projects/My Note.md"],
  attachments: ["attachments/image.png"], // Auto-discovered if omitted
  commitMessage: "feat: add note via para-obsidian"
});
```

---

## Configuration

**Environment Variables:**
```bash
export PARA_VAULT="/Users/you/vault"           # REQUIRED
export PARA_OBSIDIAN_CONFIG="/custom/config"   # Optional
```

**Config File Locations** (priority order):
1. `$PARA_OBSIDIAN_CONFIG` (if set)
2. `~/.config/para-obsidian/config.json` (user config)
3. `.para-obsidianrc` (project config in vault root)
4. Built-in defaults

**Config Schema:**
```json
{
  "vault": "/Users/you/vault",
  "templatesDir": "06_Metadata/Templates",
  "indexPath": ".para-obsidian-index.json",
  "defaultSearchDirs": ["01_Projects", "02_Areas"],
  "autoCommit": false,
  "gitCommitMessageTemplate": "chore: update notes",
  "suggestedTags": ["project", "area", "resource", "task", "daily"],
  "frontmatterRules": {
    "project": {
      "required": ["type", "status"],
      "statusEnum": ["active", "on-hold", "completed"]
    }
  },
  "templateVersions": {
    "project": 2,
    "area": 2
  }
}
```

---

## Slash Commands

**4 slash commands** for Claude Code:

| Command | Purpose | Example |
|---------|---------|---------|
| `/para-obsidian:create` | Create note with AI extraction | `/para-obsidian:create area I need to manage my dog Muffin` |
| `/para-obsidian:search` | Search vault | `/para-obsidian:search vacation plans` |
| `/para-obsidian:validate` | Validate frontmatter | `/para-obsidian:validate 01_Projects/My Project.md` |
| `/para-obsidian:commit` | Git auto-commit | `/para-obsidian:commit feat: new project note` |

---

## Skills

**2 Claude Code skills:**

1. **template-assistant** (`skills/template-assistant/SKILL.md`)
   - Interactive template creation assistant
   - Content strategies and examples
   - Template catalog with 11 note types

2. **field-suggestions** (`skills/field-suggestions/SKILL.md`)
   - AI-powered frontmatter field suggestions
   - Context-aware recommendations
   - Validation rule awareness

---

## Code Conventions

**TypeScript:**
- Strict mode enabled
- No unchecked indexed access
- Bun types included
- Path aliases: `@sidequest/core/*`

**Testing:**
- Pattern: `*.test.ts` alongside source files
- Framework: Bun test with `--recursive` flag
- Coverage: 246 tests in inbox module, comprehensive coverage across all modules

**File Naming:**
- kebab-case for files/directories
- `*.test.ts` for tests
- `CLAUDE.md` for module documentation

**Security:**
- No string interpolation for shell commands
- Atomic writes with temp files
- Input validation on all external inputs
- TOCTOU mitigation for file operations

---

## Common Patterns

### Creating a Note with AI Extraction

```bash
para-obsidian create \
  --template project \
  --source-text "Plan trip to Tasmania in January 2026 - need to book flights, accommodation, rental car"
```

**Flow:**
1. Extract metadata via LLM (title, area, project fields)
2. Load template with version tracking
3. Substitute variables
4. Generate Title Case filename
5. Write to PARA folder
6. Auto-commit if enabled

### Validating Frontmatter

```bash
# Single file
para-obsidian frontmatter validate "01_Projects/My Project.md"

# Bulk validation
para-obsidian frontmatter migrate-all --dry-run
```

### Processing Inbox

```bash
para-obsidian process-inbox
```

**Interactive Flow:**
1. Scan inbox directory
2. Generate suggestions (AI-powered)
3. Display for review
4. Prompt for edits/approvals
5. Execute approved suggestions
6. Update registry (idempotency)

### Migration Workflow

```bash
# 1. Plan version bump
para-obsidian frontmatter plan project --to 3 > plan.json

# 2. Review plan
cat plan.json | jq .

# 3. Execute migration
para-obsidian frontmatter apply-plan plan.json --auto-commit
```

---

## Troubleshooting

**Environment not set:**
```
Error: PARA_VAULT environment variable not set
Fix: export PARA_VAULT="/path/to/vault"
```

**Git errors:**
```
Error: Vault is not a git repository
Fix: cd $PARA_VAULT && git init
```

**Template not found:**
```
Error: Template 'project' not found
Fix: Check $PARA_VAULT/06_Metadata/Templates/project.md exists
```

**TypeScript errors:**
```bash
bun typecheck
```

**Test failures:**
```bash
bun test --watch  # Watch mode for debugging
bun test src/inbox/ --only  # Run specific module
```

**Kit semantic search not working:**
```bash
# Check Kit installation
which kit

# Install if missing
uv tool install cased-kit

# Prime index
para-obsidian index prime
```

---

## Development Status

See `STATUS.md` for current progress (48 passing tests, comprehensive feature coverage).

**Completed:**
- ✅ Config loader (ENV-first, rc cascade, defaults)
- ✅ Frontmatter utilities (parse/validate/migrate)
- ✅ Template loader + create-from-template
- ✅ Search (text + semantic + frontmatter/tag filters)
- ✅ Indexer (build/query lightweight index)
- ✅ Rename with link rewrite (wikilinks + MD links)
- ✅ Delete with confirm/dry-run
- ✅ Git guard + auto-commit
- ✅ Insert/append/prepend under heading/block
- ✅ Template version migration
- ✅ Inbox processing framework (246 tests)
- ✅ MCP server (20 tools)
- ✅ CLI modularization (12 handlers)
- ✅ Skills (template-assistant, field-suggestions)

**In Progress:**
- 🚧 Richer frontmatter hints for set operations
- 🚧 Interactive migration prompts
- 🚧 Per-type summaries in plan tooling

See `ROADMAP.md` for future enhancements.

---

## Notes

- **PARA Method:** Follows Tiago Forte's PARA (Projects, Areas, Resources, Archives) organization system
- **Templater Compatibility:** Variable substitution syntax mirrors Obsidian Templater plugin
- **Security Hardened:** Inbox processing uses atomic writes, file locking, input validation
- **Token Efficient:** MCP tools support JSON format for 40-60% token savings
- **Idempotent:** SHA256 registry prevents duplicate inbox processing
- **AI-Powered:** Uses @sidequest/core/llm for Claude/Ollama integration
- **Modular CLI:** Recent refactor extracted 12 command handlers for maintainability
- **Comprehensive Tests:** 246 tests in inbox module, extensive coverage across all modules

---

## Key Statistics

From file tree + Kit index:
- **Files:** 131 files total
- **Source files:** 61 TypeScript files in `src/`
- **Test files:** 40 test files (`*.test.ts`)
- **Test coverage:** 246 tests in inbox module alone
- **Complexity hotspots:**
  - `src/inbox/` - 267 symbols (91 in converters)
  - `src/frontmatter.ts` - 41KB (core module)
  - `mcp/index.ts` - 78KB (20 tools)
  - `src/llm/` - 3 modules for AI orchestration

---

## Resources

| Resource | Location |
|----------|----------|
| Development Status | `./STATUS.md` |
| Original Spec | `./SPEC.md` |
| Roadmap | `./ROADMAP.md` |
| Inbox Module Docs | `./src/inbox/CLAUDE.md` |
| Parent Project | `../../CLAUDE.md` |
| Core Utilities | `../../core/CLAUDE.md` |

---

## Getting Started

**Prerequisites:**
```bash
# 1. Set vault path
export PARA_VAULT="/Users/you/vault"

# 2. Ensure templates exist
ls "$PARA_VAULT/06_Metadata/Templates"

# 3. Init git (for auto-commit)
cd "$PARA_VAULT" && git init
```

**First Steps:**
```bash
# 1. Show config
para-obsidian config

# 2. Create a note
para-obsidian create --template task --source-text "Book dentist appointment"

# 3. Search vault
para-obsidian search "dentist"

# 4. Validate frontmatter
para-obsidian frontmatter validate "03_Resources/My Note.md"
```

**From Claude Code:**
```
/para-obsidian:create task Book plumber to fix kitchen sink
/para-obsidian:search vacation plans
/para-obsidian:validate 01_Projects/My Project.md
```

---

**For detailed plugin development, see parent @../../PLUGIN_DEV_GUIDE.md**
