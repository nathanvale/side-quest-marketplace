# Para Obsidian Plugin

CLI + MCP server for PARA-style Obsidian vault management with frontmatter validation, template versioning, and git auto-commit.

---

## CRITICAL RULES

**Vault Path Required:**
- **YOU MUST** set `PARA_VAULT` environment variable pointing to Obsidian vault
- All operations validate vault path exists before executing
- Config resolution: ENV → user rc (`~/.config/para-obsidian/config.json`) → project rc (`.para-obsidianrc`) → defaults

**Git Safety:**
- **ALWAYS** check vault is a git repository before writes
- **ALWAYS** verify clean working tree (no uncommitted changes) before operations
- Auto-commit flag (`--auto-commit`) adds and commits changes after successful writes
- Attachment auto-discovery includes linked files in commits

**Frontmatter Validation:**
- Each note type has strict frontmatter requirements (project, area, resource, task, etc.)
- Template versions tracked via `template_version` field
- Migration required when template versions change
- Use `frontmatter validate` before manual edits
- **CRITICAL:** Wikilinks in YAML frontmatter must NOT be quoted for Dataview compatibility
  - ✅ Correct: `project: [[Building A Garden Shed]]`
  - ❌ Wrong: `project: "[[Building A Garden Shed]]"`

**Filename Conventions:**
- **ALWAYS** use Title Case with spaces (e.g., "My Project Note.md")
- **NEVER** use generic names like "Untitled" or "New Note"
- Rename operations rewrite all wikilinks and markdown links automatically

**Default Destinations:**
Notes are automatically placed in their PARA folder unless `--dest` is specified:
| Template | Default Folder |
|----------|----------------|
| project | `01_Projects` |
| area | `02_Areas` |
| resource | `03_Resources` |
| task | `Tasks` |
| daily, weekly-review, capture, booking, checklist, itinerary-day, trip-research | `00_Inbox` |

---

## Quick Reference

**Type:** CLI + MCP Server | **Runtime:** Bun | **Language:** TypeScript (strict mode)
**Dependencies:** yaml, @sidequest/core | **Test Framework:** Bun test (294 tests passing)

### Directory Structure

```
para-obsidian/
├── src/                           # Core CLI logic (200+ symbols)
│   ├── cli.ts                    # Main CLI entry (37.9 KB, 15 functions)
│   ├── config.ts                 # ENV-first config loader
│   ├── frontmatter.ts            # Parse/validate/migrate frontmatter
│   ├── create.ts                 # Template-based note creation + section injection
│   ├── search.ts                 # Text search + frontmatter filters
│   ├── semantic.ts               # Kit semantic search integration
│   ├── indexer.ts                # Build/save/load frontmatter index
│   ├── insert.ts                 # Append/prepend under heading/block
│   ├── links.ts                  # Rename with link rewrite
│   ├── delete.ts                 # Delete with confirm/dry-run
│   ├── git.ts                    # Git guard + auto-commit
│   ├── migrations.ts             # Template version migrations
│   ├── attachments.ts            # Auto-discover linked attachments
│   ├── templates.ts              # Templater arg substitution + date/section extraction
│   ├── fs.ts                     # Vault-scoped file operations
│   ├── format.ts                 # Colored CLI output
│   ├── llm.ts                    # LLM integration (HTTP client + re-exports)
│   └── llm/                      # LLM utilities (3-layer architecture)
│       ├── constraints.ts        # Constraint enforcement for deterministic extraction
│       ├── prompt-builder.ts     # Composable prompt construction
│       └── orchestration.ts      # High-level workflows (convert, suggest, batch)
├── mcp/                           # MCP server (20 tools)
│   └── index.ts                  # mcpez-based MCP server (thin CLI wrapper)
├── STATUS.md                      # Development progress tracker
├── SPEC.md                        # Working specification
└── package.json                   # Dependencies + scripts
```

---

## Commands

```bash
# Development
bun test --recursive       # Run all tests (270+ passing)
bun run typecheck          # Type checking
bun run check              # Biome lint + format

# CLI Usage (requires PARA_VAULT env var)
para-obsidian config                           # Show resolved config
para-obsidian list [dir]                       # List vault files
para-obsidian read <file>                      # Read note contents
para-obsidian search <query> [--dir] [--tag]   # Search with filters
para-obsidian semantic <query> [--dir]         # Semantic search via Kit
para-obsidian create --template <type> --title "Name"    # Create blank template
para-obsidian create --template <type> --source file.md  # AI-powered: extract metadata from source
para-obsidian create --template <type> --source file.md --preview  # Preview AI suggestions only (75% token savings)
para-obsidian create --template <type> --source file.md --model haiku  # Use specific model
para-obsidian create --template <type> --source file.md --arg "priority=high"  # Override AI suggestions
para-obsidian insert <file> <heading> <text>   # Insert under heading
para-obsidian rename <old> <new> [--dry-run]   # Rename with link rewrite
para-obsidian delete <file> [--dry-run]        # Delete with confirm
para-obsidian frontmatter get <file>           # Extract frontmatter
para-obsidian frontmatter validate <file>      # Validate against rules
para-obsidian frontmatter set <file> key=val   # Update frontmatter
para-obsidian frontmatter migrate <file>       # Migrate template version
para-obsidian frontmatter migrate-all <type>   # Bulk migrate notes
para-obsidian frontmatter plan <type> --to 2   # Plan version bump
para-obsidian frontmatter apply-plan <plan>    # Apply migration plan
para-obsidian index prime [--dir]              # Build frontmatter index
para-obsidian index query <term>               # Query cached index
para-obsidian templates                        # List template versions
```

---

## Key Files

| File | Purpose | Lines |
|------|---------|-------|
| `src/cli.ts` | Main CLI entry point with arg parsing | 37.9 KB |
| `src/frontmatter.ts` | Frontmatter operations (parse/validate/migrate) | 31.9 KB |
| `src/llm/constraints.ts` | Constraint enforcement for deterministic LLM extraction | 414 |
| `src/llm/prompt-builder.ts` | Composable, declarative prompt construction | 330 |
| `src/llm/orchestration.ts` | High-level LLM workflows (convert, suggest, batch) | 400 |
| `src/llm.ts` | LLM HTTP client + re-exports from llm/* modules | 129 |
| `src/templates.ts` | Template metadata + Templater substitution | 368 |
| `src/config.ts` | ENV-first config resolution | 7.3 KB |
| `src/search.ts` | Text + frontmatter filtering | 7.0 KB |
| `src/git.ts` | Git safety guards + auto-commit | 5.7 KB |
| `src/indexer.ts` | Lightweight frontmatter/tag/heading index | 5.5 KB |
| `src/migrations.ts` | Template version migration hooks | 9.3 KB |
| `mcp/index.ts` | MCP server (20 tools, thin CLI wrapper) | 14.7 KB |

---

## MCP Tools (20 Total)

**Configuration:**
- `config` — Load resolved configuration
- `templates` — List configured template versions
- `template_fields` — Inspect template to see required args (NEW!)

**File Operations:**
- `list` — List vault files/directories
- `read` — Read note contents
- `search` — Text search with frontmatter/tag filters
- `semantic_search` — Semantic search via Kit CLI

**Note Management:**
- `create` — Create from template with optional content injection (Templater substitution)
- `insert` — Insert text under heading/block
- `rename` — Rename with automatic link rewrite
- `delete` — Delete with confirmation

**Frontmatter:**
- `frontmatter_get` — Extract frontmatter from note
- `frontmatter_validate` — Validate against type rules
- `frontmatter_set` — Update frontmatter fields
- `frontmatter_migrate` — Migrate single note to new template version
- `frontmatter_migrate_all` — Bulk migrate notes by type
- `frontmatter_plan` — Plan template version bump
- `frontmatter_apply_plan` — Execute migration plan

**Indexing:**
- `index_prime` — Build frontmatter/tag/heading index
- `index_query` — Query cached index

---

## Tech Stack

- **Runtime:** Bun 1.3.3 (TypeScript execution, testing)
- **Language:** TypeScript 5.7.2 (strict mode: true)
- **MCP Framework:** mcpez (minimal boilerplate)
- **Dependencies:** yaml (frontmatter parsing), @sidequest/core (spawn/fs utilities)
- **Linting:** Biome 2.3.7 (recommended rules)

---

## Code Conventions

**TypeScript:** Strict mode, tab indentation, functional style
**Frontmatter:** YAML parsing via `yaml` library, strict validation per note type
**File Operations:** Vault-scoped paths, git safety checks before writes
**Testing:** Bun test framework, 216 tests covering CLI/frontmatter/migrations/MCP
**Kit ML:** Automatic installation prompt for semantic search dependencies

---

## Git Workflow

**Commits:** Conventional format `<type>(<scope>): <subject>`
**Examples:**
- `feat(para-obsidian): add semantic search integration`
- `fix(frontmatter): handle missing template_version field`
- `test(migrations): add tag backfill test cases`

---

## Architecture

### Config Resolution (ENV-first)

1. `PARA_VAULT` environment variable (required)
2. User config: `~/.config/para-obsidian/config.json`
3. Project config: `.para-obsidianrc` in vault root
4. Hardcoded defaults (templates dir, suggested tags, frontmatter rules)

### Template Field Discovery

**NEW!** Use `template_fields` tool to discover what args a template needs:

```json
// MCP call
{ "template": "project", "response_format": "json" }

// Returns
{
  "template": "project",
  "version": 2,
  "fields": {
    "required": ["Project title", "Target completion date (YYYY-MM-DD)", "Area"],
    "auto": ["created"],
    "body": []
  },
  "example": {
    "Project title": "...",
    "Target completion date (YYYY-MM-DD)": "...",
    "Area": "..."
  }
}
```

**Key insight:** The arg keys must match the **exact Templater prompt text** from the template:
- Template: `<% tp.system.prompt("Project title") %>`
- Args: `{ "Project title": "My Project" }`  ← Capital P, space included!

### Content Injection (NEW!)

Create notes AND inject content into sections in a single operation:

```bash
# CLI: Create project with content injected into body sections
para-obsidian create --template project --title "My Project" \
  --arg "Area=[[Work]]" \
  --content '{"Why This Matters": "This addresses...", "Success Criteria": "- [ ] Done"}'
```

```json
// MCP call: para_create with content parameter
{
  "template": "project",
  "title": "My Project",
  "args": { "Area": "[[Work]]" },
  "content": {
    "Why This Matters": "This project addresses a critical need.",
    "Success Criteria": "- [ ] Feature complete\n- [ ] Tests pass"
  }
}

// Returns
{
  "filePath": "My Project.md",
  "sectionsInjected": 2,
  "sectionsSkipped": [],
  "injectedHeadings": ["Why This Matters", "Success Criteria"]
}
```

**Architecture:** MCP is a thin wrapper → CLI does all heavy lifting:
- CLI creates file from template AND injects content in one operation
- Skipped sections (missing headings, empty content) are reported, not errors
- Useful for AI-assisted content generation workflows

### Frontmatter Validation

Each note type enforces strict frontmatter schema:
- **Project:** title, status, tags, dates, template_version
- **Area:** title, responsibility, tags, template_version
- **Resource:** title, type, source, tags, template_version
- **Task:** title, status, priority, project/area, template_version

Validation errors include field path, expected type, and suggestions.

### Template Version Migration

Template versions tracked via `template_version` frontmatter field:
1. `frontmatter plan <type> --to 2` — Analyze outdated notes
2. `frontmatter apply-plan plan.json` — Execute migrations
3. Migrations run hooks (tag backfills, status normalization)
4. Auto-commit includes mutated notes + attachments

### Link Rewriting

Rename operations rewrite all references:
- Wikilinks: `[[Old Name]]` → `[[New Name]]`
- Markdown links: `[text](old-name.md)` → `[text](new-name.md)`
- Scoped to vault only (no external links modified)

### AI-Powered Create Mode

**Unified `create` command** with AI-powered metadata extraction:

```bash
# Blank template (manual entry)
para-obsidian create --template task --title "Fix shed door"

# AI-powered: extract metadata from existing note
para-obsidian create --template task --source "inbox/rough-note.md"

# Preview mode: see suggestions without creating (75% token savings)
para-obsidian create --template task --source "inbox/rough-note.md" --preview

# Override specific AI suggestions
para-obsidian create --template task --source "inbox/rough-note.md" \
  --arg "priority=high" --arg "area=[[Work]]"

# Use specific model (sonnet, haiku, or Ollama models like qwen2.5:14b)
para-obsidian create --template task --source "inbox/rough-note.md" --model haiku
```

**Model Selection:**
- **Claude models** (`sonnet`, `haiku`) → Uses `claude -p` headless CLI
- **Ollama models** (`qwen2.5:14b`, `qwen:7b`, etc.) → Uses Ollama HTTP API
- Default model configurable in `.paraobsidianrc` via `defaultModel` field
- Available models validated against `availableModels` config array

### LLM Utilities Architecture (3-Layer Design)

**Purpose:** Reusable, deterministic LLM integration for AI-powered create and field suggestions.

**Layer 3: High-Level Orchestration** (`src/llm/orchestration.ts`):
- `extractMetadata()` — Full extraction pipeline for `create --source`
- `suggestFieldValues()` — Lightweight field extraction for slash commands
- `batchConvert()` — Bulk operations with shared constraints

**Layer 2: Prompt Building** (`src/llm/prompt-builder.ts`):
- `buildStructuredPrompt()` — Declarative prompt construction
- Composable sections: constraints, critical rules, few-shot examples
- Separates required vs optional fields for clarity

**Layer 3: Constraint Enforcement** (`src/llm/constraints.ts`):
- `buildConstraintSet()` — Extracts enum values, required/optional status from templates + rules
- Determinism improvements:
  - Inline enum values: `"status" REQUIRED - must be one of: active, on-hold, completed`
  - Explicit wikilink guidance: `format [[Name]], or null if not applicable`
  - Array includes: `tags MUST include: project`
  - Vault context awareness: existing areas/projects/tags constrain LLM output

**Layer 1: LLM Client** (`src/llm.ts`):
- `callOllama()` — HTTP transport to Ollama API (JSON format mode)
- `parseOllamaResponse()` — JSON parsing with markdown fence cleanup
- Re-exports from `llm/*` modules for convenient access

**Usage Example (Field Suggestions for Slash Commands)**:
```typescript
import { buildConstraintSet, buildStructuredPrompt, callOllama, parseOllamaResponse } from './llm';

// In a slash command that prompts for project metadata:
const template = getTemplate(config, 'project');
const constraints = buildConstraintSet(template, rules, vaultContext);
const prompt = buildStructuredPrompt({
  systemRole: 'Extract project metadata from user input',
  task: 'Suggest frontmatter values based on title and description',
  sourceContent: `Title: ${userTitle}\nDescription: ${userDescription}`,
  constraints
});

const response = await callOllama(prompt, 'qwen2.5:7b');
const { args, title } = parseOllamaResponse(response);

// Present suggestions to user for confirmation before creating note
```

**Benefits**:
- **Determinism**: Constraint-driven prompts reduce hallucinations
- **Reusability**: Shared utilities across convert command, slash commands, bulk operations
- **Testability**: 100% test coverage on all layers (34 + 26 + 75 = 135 new tests)
- **Maintainability**: Declarative prompts easier to update than monolithic strings

### Git Integration

Safety guards before writes:
1. Check vault is git repository
2. Verify clean working tree (no uncommitted changes)
3. Optionally auto-commit after successful write (`--auto-commit` flag)
4. Auto-discover attachments for inclusion in commits

---

## Testing

```bash
bun test --recursive                      # All tests (294 passing)
bun test src/frontmatter.test.ts          # Frontmatter operations
bun test src/git.test.ts                  # Git safety guards
bun test src/migrations.test.ts           # Template migrations
bun test src/create.test.ts               # Note creation + section injection
bun test src/cli.test.ts                  # CLI integration tests
bun test src/llm/constraints.test.ts      # Constraint enforcement (34 tests)
bun test src/llm/prompt-builder.test.ts   # Prompt building (26 tests)
bun test src/llm/orchestration.test.ts    # Orchestration workflows (4 tests)
```

**Test Coverage:**
- Frontmatter parsing/validation/migration
- Config resolution (ENV → user rc → project rc → defaults)
- Link rewriting (wikilinks + markdown links)
- Git safety guards (repo check, clean tree)
- CLI arg parsing and command execution
- Template version planning and application
- Content injection into sections (injectSections)
- CLI --content flag integration
- LLM constraint enforcement (enum values, required/optional, vault context)
- Declarative prompt construction with composable sections
- High-level orchestration workflows (convert, suggest, batch)

---

## Development Status

**Completed:**
- ✅ Config loader (ENV-first, rc files, defaults)
- ✅ File operations (list, read, vault-scoped paths)
- ✅ Frontmatter (parse, validate, get, set, migrate)
- ✅ Template creation (Templater substitution, Title Case filenames)
- ✅ Search (text + frontmatter/tag filtering)
- ✅ Indexer (build/save/load frontmatter/tags/headings)
- ✅ Rename with link rewrite (wikilinks + markdown links)
- ✅ Delete with confirm/dry-run
- ✅ Git guards (repo presence, clean check)
- ✅ Insert/append/prepend under heading/block
- ✅ Git auto-commit flag (add/commit after writes)
- ✅ Template version tracking and migration
- ✅ Bulk migration (migrate-all, plan, apply-plan)
- ✅ Attachment auto-discovery for commits
- ✅ Semantic search via Kit CLI
- ✅ MCP server (20 tools, thin CLI wrapper)
- ✅ Colored CLI output and JSON mode
- ✅ Content injection via --content flag
- ✅ Default destinations per template type (PARA folders)
- ✅ LLM utilities (3-layer architecture: constraints, prompt-builder, orchestration)
- ✅ Constraint-driven deterministic extraction
- ✅ Reusable field suggestion utilities for slash commands
- ✅ AI-powered create mode with --source, --preview, --model, --arg flags
- ✅ Model routing (Claude headless + Ollama HTTP) via @sidequest/core/llm
- ✅ 294 tests passing

**Future Enhancements Enabled by LLM Architecture:**
- Slash commands with AI-assisted field suggestions (infrastructure ready)
- Bulk conversion operations (batch utilities available)
- Few-shot learning examples (prompt-builder supports composable examples)

**Remaining:**
- Consider richer hints for frontmatter set (allowed enums)
- Extend plan tooling with per-type summaries and interactive prompts

---

## Notable Patterns

### Overloaded CLI Args

Functions accept both CLI arg arrays and parsed options:
```typescript
function parseArgs(args: string[]): ParsedArgs
function computeFrontmatterHints(file: string, type?: string): Hints
```

### Migration Hooks

Template version migrations run type-specific hooks:
```typescript
MIGRATIONS.project.v2 = (fm) => {
  fm.tags = [...new Set([...(fm.tags ?? []), "project"])];
  if (!fm.status) fm.status = "planning";
};
```

### Auto-Discovery

Attachment auto-discovery scans note for links when attachments not explicitly passed:
```typescript
withAutoDiscoveredAttachments(vault, note, explicit)
  → explicit.length > 0 ? explicit : discoverAttachments(vault, note)
```

### Git Safety

All write operations check git preconditions:
```typescript
const { isRepo, isClean } = await checkGitStatus(vault);
if (!isRepo) throw new Error("Vault must be a git repository");
if (!isClean) throw new Error("Working tree must be clean");
```

---

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PARA_VAULT` | Yes | — | Path to Obsidian vault |
| `PARA_OBSIDIAN_CONFIG` | No | `~/.config/para-obsidian/config.json` | User config path |

---

## Dependencies

- `yaml@^2.6.0` — Frontmatter parsing (YAML serialization)
- `@sidequest/core@workspace:*` — Shared spawn/fs utilities

**Dev Dependencies:**
- `@types/bun@latest` — Bun runtime types

---

## Notes

- Plugin requires Obsidian vault with PARA structure (Projects, Areas, Resources, Archives)
- Templates expected at `plugins/para-brain/templates` (project, area, resource, task, etc.)
- Frontmatter rules mirror validate-note defaults from para-brain
- Semantic search requires Kit CLI with ML dependencies (auto-prompted to install)
- Index cached at vault root (`<vault>/.para-obsidian-index.json`)
- Git auto-commit uses template: `chore(vault): <operation> <filename>`
- Suggested tags: project, area, resource, task, daily, journal, review, weekly, checklist, booking, itinerary, research, capture, inbox, travel, work, family, health, learning, finance, home, career
- Test suite validates frontmatter rules, migrations, and link rewrites
- CLI uses colored output (green for success, yellow for warnings, red for errors)
- JSON mode available via `--json` flag for machine-readable output
- Dry-run support across rename, delete, and migrate operations
- Status tracking at STATUS.md (session progress), SPEC.md (working specification)
