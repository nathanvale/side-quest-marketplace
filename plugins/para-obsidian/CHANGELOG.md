# Changelog

All notable changes to the para-obsidian plugin will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2025-12-21

### BREAKING CHANGES

- **Removed tags field from frontmatter** - Tags are no longer supported in note frontmatter. The `tags` field has been completely removed from all validation rules, note types, and processing pipelines.

### Why This Change?

Based on PARA methodology research and second brain best practices:
- **Properties are more powerful** - Frontmatter properties like `type`, `area`, and `project` provide better structured data for queries
- **Dataview handles all filtering** - No need for tags when Dataview can filter by any property
- **Semantic search covers discovery** - ChromaDB and semantic search handle fuzzy recall better than tags
- **Reduces cognitive load** - One less decision point when capturing notes
- **Eliminates taxonomy maintenance** - No need to maintain tag hierarchies or deal with tag sprawl

### Migration Required

**You MUST run the migration script to remove tags from your existing notes:**

```bash
# Preview changes first (dry-run)
para-obsidian migrate:remove-tags --dry-run --verbose

# Apply changes to your vault
para-obsidian migrate:remove-tags --verbose
```

The migration script will:
- Scan all markdown files in your vault
- Remove the `tags` field from frontmatter
- Preserve all other frontmatter fields
- Report what was changed

### Removed

**Core Validation & Configuration:**
- `DEFAULT_SUGGESTED_TAGS` constant (27 predefined tags)
- `tags` field from all frontmatter validation rules (project, area, resource, task, daily, weekly-review, capture, checklist, booking, itinerary, research, trip, session, invoice, medical-statement, bookmark)
- `includes` validation constraint (was only used for tags)

**Search & Indexing:**
- `tags` field from `IndexEntry` interface
- `listTags()` function from indexer
- `scanTags()` function from indexer
- Tag filtering from search queries (CLI, MCP, programmatic)

**CLI Commands:**
- `para-obsidian list-tags` command
- `para-obsidian scan-tags` command

**Template System:**
- `ensureRequiredTags()` function from template migrations
- Tags field from Templater prompts

**LLM Integration:**
- Tag validation documentation from LLM prompts
- `extractTags()` function from markdown scanner

**Bookmark Workflow:**
- Tags field from bookmark classifier
- Tag merging logic (no longer auto-adds "bookmarks" tag)
- Topic tag extraction from web bookmarks

**MCP Tools:**
- Tag filtering from `para_list` and `para_index_query` tools

### Added

**Migration Script:**
- `para-obsidian migrate:remove-tags` command
  - `--dry-run` flag - Preview changes without modifying files
  - `--verbose` flag - Show detailed progress and changes
  - Comprehensive error handling for invalid YAML
  - Detailed reporting of files scanned, modified, and errors

### Recommended Workflow Changes

**Instead of tags, use:**
- `type` property - Already exists, identifies note type (project, area, resource, etc.)
- `area` property - Link to area note using `[[Area Name]]`
- `project` property - Link to project note using `[[Project Name]]`
- Custom properties - Add domain-specific fields as needed

**For filtering and search:**
- Dataview queries: `WHERE type = "project" AND area = [[Health]]`
- MCP tools: `para_index_query` with property filters
- Semantic search: Use ChromaDB for meaning-based discovery

**For organization:**
- PARA folder structure (Projects/Areas/Resources/Archives)
- Wiki-style links between notes
- Backlinks panel for discovering connections

## [0.1.0] - 2025-12-XX

### Added
- Initial release with PARA-compliant vault management
- Inbox processing framework
- Template system with frontmatter validation
- MCP server integration
- CLI commands for note management
