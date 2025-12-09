---
description: Bulk frontmatter validation across your Obsidian vault
argument-hint: [--dir path] [--type noteType] [--format md|json]
allowed-tools: Bash(bun:*)
---

# Validate Frontmatter

Validate frontmatter across all notes in your vault or specific directories.

## Execution

Run the para-obsidian CLI bulk validation command:

!`cd "${CLAUDE_PLUGIN_ROOT}" && bun run src/cli.ts frontmatter validate-all $ARGUMENTS --format json`

## Usage Examples

```bash
# Validate all notes in default search directories
/para-obsidian:validate

# Validate specific directories
/para-obsidian:validate --dir 01_Projects
/para-obsidian:validate --dir 01_Projects,02_Areas

# Validate only notes of a specific type
/para-obsidian:validate --type project
/para-obsidian:validate --type area --dir 02_Areas

# Get markdown output instead of JSON
/para-obsidian:validate --format md
```

## What Gets Validated

For each note, the validation checks:
- **Required fields** - Based on note type (project, area, resource, task, etc.)
- **Field types** - Ensures values match expected types (string, number, date, array, enum)
- **Enum values** - Validates against allowed values (e.g., status must be "active", "on-hold", or "completed")
- **Template version** - Checks if note needs migration to latest template version
- **Filename format** - Validates Title Case and checks for invalid characters
- **Title prefixes** - Ensures filenames match expected prefixes for note types (if configured)

## Output Format

**JSON mode (default for slash commands):**
```json
{
  "summary": {
    "total": 42,
    "valid": 38,
    "invalid": 4,
    "byType": {
      "project": { "total": 15, "valid": 14, "invalid": 1 },
      "area": { "total": 8, "valid": 8, "invalid": 0 }
    }
  },
  "issues": [
    {
      "file": "01_Projects/My Project.md",
      "type": "project",
      "valid": false,
      "errors": [
        { "field": "status", "message": "missing required field" },
        { "field": "template_version", "message": "outdated (found 1, expected 2)" }
      ]
    }
  ]
}
```

**Markdown mode:**
```
4 of 42 file(s) have issues (38 valid)

By type:
  ✗ project: 14/15 valid
  ✓ area: 8/8 valid

Files with issues:

01_Projects/My Project.md:
  - status: missing required field
  - template_version: outdated (found 1, expected 2)
```

## Follow-up Actions

After validation, you can fix issues using the para-obsidian CLI:

### Fix Individual Files

```bash
# Update specific frontmatter fields
bun run src/cli.ts frontmatter set <file> key=value

# Example: Fix status and priority
bun run src/cli.ts frontmatter set "Tasks/My Task.md" status=in-progress priority=high

# Remove fields
bun run src/cli.ts frontmatter set <file> --unset field1,field2
```

### Migrate Template Versions

```bash
# Migrate single file to latest template version
bun run src/cli.ts frontmatter migrate <file>

# Bulk migrate all notes of a specific type
bun run src/cli.ts frontmatter migrate-all --type project

# Dry-run to preview changes
bun run src/cli.ts frontmatter migrate-all --type project --dry-run
```

### Fix Filename Issues

```bash
# Rename files to Title Case with proper prefixes
bun run src/cli.ts rename "old-name.md" "New Name.md"
```

## Default Search Directories

Validation scans PARA-managed folders by default (configured in `.paraobsidianrc`):
- `00_Inbox`
- `01_Projects`
- `02_Areas`
- `03_Resources`
- `04_Archives`
- `Tasks`
