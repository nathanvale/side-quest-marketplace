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
| task | `07_Tasks` |
| daily, weekly-review, capture, booking, checklist, itinerary-day, trip-research | `00_Inbox` |

---

## Quick Reference

**Type:** CLI + MCP Server | **Runtime:** Bun | **Language:** TypeScript (strict mode)
**Dependencies:** yaml, @sidequest/core | **Test Framework:** Bun test (216 tests passing)

### Directory Structure

```
para-obsidian/
├── src/                           # Core CLI logic (150 symbols)
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
│   ├── templates.ts              # Templater arg substitution
│   ├── fs.ts                     # Vault-scoped file operations
│   └── format.ts                 # Colored CLI output
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
bun test --recursive       # Run all tests (209 passing)
bun run typecheck          # Type checking
bun run check              # Biome lint + format

# CLI Usage (requires PARA_VAULT env var)
para-obsidian config                           # Show resolved config
para-obsidian list [dir]                       # List vault files
para-obsidian read <file>                      # Read note contents
para-obsidian search <query> [--dir] [--tag]   # Search with filters
para-obsidian semantic <query> [--dir]         # Semantic search via Kit
para-obsidian create <type> [args...] [--content JSON]  # Create from template with optional content injection
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

### Git Integration

Safety guards before writes:
1. Check vault is git repository
2. Verify clean working tree (no uncommitted changes)
3. Optionally auto-commit after successful write (`--auto-commit` flag)
4. Auto-discover attachments for inclusion in commits

---

## Testing

```bash
bun test --recursive              # All tests (209 passing)
bun test src/frontmatter.test.ts  # Frontmatter operations
bun test src/git.test.ts          # Git safety guards
bun test src/migrations.test.ts   # Template migrations
bun test src/create.test.ts       # Note creation + section injection
bun test src/cli.test.ts          # CLI integration tests
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
- ✅ 216 tests passing

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
