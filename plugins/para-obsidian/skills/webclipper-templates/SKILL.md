---
name: webclipper-templates
description: Export and manage Obsidian Web Clipper JSON templates. Use when creating, editing, debugging, or exporting Web Clipper templates. Covers filter syntax, special character escaping, replace filters with URLs, and the export workflow from source JSON to individual template files.
---

# Obsidian Web Clipper Templates

## CRITICAL RULES

1. **JSON templates use `{{variable}}` syntax** - NOT Dataview (`` `= this.field` ``)
2. **Special characters in `replace` filter search terms must be escaped**: `: | { } ( ) ' "`
3. **URLs in replace filters require regex syntax** - plain string replacement breaks on `://`
4. **Always add `|trim` after `|safe_name`** in noteNameFormat to prevent trailing whitespace

## Quick Reference

### Filter Syntax

```
{{variable|filter}}
{{variable|filter1|filter2}}              # Chained filters
{{variable|filter:"arg"}}                 # Filter with argument
{{variable|replace:"search":"replace"}}   # Simple replacement
{{variable|replace:"/regex/":"replace"}}  # Regex replacement
```

### Escaping Special Characters

In the **search term** of `replace` filters, escape these with backslash:
- `:` → `\:`
- `|` → `\|`
- `{` `}` → `\{` `\}`
- `(` `)` → `\(` `\)`
- `'` `"` → `\'` `\"`

### URLs in Replace Filters - USE REGEX

**WRONG** (causes import failure):
```
{{field|replace:"https://schema.org/":""}}
```

**CORRECT** (use regex to avoid colon parsing issues):
```
{{field|replace:"/https:\/\/schema\.org\//":""}}
```

In JSON, this becomes (double backslash for JSON escaping):
```json
"{{field|replace:\"/https:\\/\\/schema\\.org\\//:\"\"}}\"
```

---

## Export Workflow

### Source File
`~/code/my-second-brain/Templates/Clippings/web-clipper-all-templates.json`

### Export Script Location
`${CLAUDE_PLUGIN_ROOT}/skills/webclipper-templates/references/export-script.cjs`

### Export Command
```bash
rm -rf ~/Downloads/webclipper-templates && \
mkdir ~/Downloads/webclipper-templates && \
node ${CLAUDE_PLUGIN_ROOT}/skills/webclipper-templates/references/export-script.cjs
```

### Import Templates
1. Open Obsidian Web Clipper settings
2. Go to Templates section
3. Click Import
4. Select files from `~/Downloads/webclipper-templates/`

---

## Common Issues & Fixes

| Issue | Cause | Fix |
|-------|-------|-----|
| "Error importing template" | Special chars in replace filter | Use regex syntax for URLs |
| Trailing spaces in filename | Missing `\|trim` | Add `\|safe_name\|trim}}` |
| Markdown tables broken | Overly aggressive regex cleanup | Don't strip spaces around `\|` in table syntax |
| `#` appearing in output | Literal `#` before `{{variable}}` | Remove `#` or escape it |
| Dataview syntax in JSON | Wrong syntax for Web Clipper | Replace `` `= this.field` `` with `{{property_value}}` |

---

## Template JSON Schema

```json
{
  "schemaVersion": "0.1.0",
  "name": "Template Name",
  "behavior": "create",
  "noteNameFormat": "{{title|safe_name|trim}}",
  "path": "00 Inbox",
  "noteContentFormat": "# {{title}}\n\nContent here...",
  "properties": [
    {
      "name": "field_name",
      "value": "{{variable|filter}}",
      "type": "text"
    }
  ],
  "triggers": [
    "schema:@Article",
    "https://example.com"
  ]
}
```

### Property Types
- `text` - Plain text
- `number` - Numeric value
- `date` - Date value (use `|date:"YYYY-MM-DD"` filter)
- `multitext` - Array of values

---

## References

Load these for detailed information:

- **Filter syntax**: `./references/filter-syntax.md` - Complete filter reference with examples
- **Export script**: `./references/export-script.cjs` - The v8 export script with URL regex fix
- **Troubleshooting**: `./references/troubleshooting.md` - Detailed debugging guide

---

## Official Documentation

- Templates: https://help.obsidian.md/web-clipper/templates
- Variables: https://help.obsidian.md/web-clipper/variables
- Filters: https://help.obsidian.md/web-clipper/filters
