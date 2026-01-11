---
description: Export and manage Obsidian Web Clipper JSON templates
argument-hint: [export|help]
allowed-tools: Bash(node:*), Bash(rm:*), Bash(mkdir:*), Bash(cat:*), Read
---

# Web Clipper Templates

Manage Obsidian Web Clipper JSON templates - export, edit, debug.

## Usage

```
/para-obsidian:webclipper export    # Export all templates
/para-obsidian:webclipper help      # Show filter syntax help
```

## Instructions

When the user invokes this command:

### `export` (default)

Run the export script to generate individual JSON template files:

```bash
rm -rf ~/Downloads/webclipper-templates && \
mkdir ~/Downloads/webclipper-templates && \
node ${CLAUDE_PLUGIN_ROOT}/skills/webclipper-templates/references/export-script.cjs
```

Then tell the user:
1. Templates exported to `~/Downloads/webclipper-templates/`
2. Open Obsidian Web Clipper settings > Templates > Import
3. Select the JSON files

### `help`

Read and summarize the skill's SKILL.md:
`${CLAUDE_PLUGIN_ROOT}/skills/webclipper-templates/SKILL.md`

Focus on:
- Critical rules (URL regex syntax, escaping, trim)
- Quick reference for filter syntax
- Link to official docs

### Debugging Template Issues

If user reports import failures:

1. Read the troubleshooting guide:
   `${CLAUDE_PLUGIN_ROOT}/skills/webclipper-templates/references/troubleshooting.md`

2. Check for URLs in replace filters - they need regex syntax

3. Validate JSON: `cat template.json | jq .`

4. Test with minimal template first, add fields incrementally

### Filter Syntax Reference

For detailed filter documentation:
`${CLAUDE_PLUGIN_ROOT}/skills/webclipper-templates/references/filter-syntax.md`
