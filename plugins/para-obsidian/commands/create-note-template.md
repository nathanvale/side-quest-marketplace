---
description: Create custom Templater-compatible note templates via interactive wizard
argument-hint: [template-name]
allowed-tools: AskUserQuestion, Write, Read
---

# Create Note Template

**Create custom Templater-compatible note templates via interactive wizard.**

---

## Overview

The `/para-obsidian:create-note-template` command helps you create new note templates for non-inbox note types like projects, areas, resources, or custom workflows.

Unlike inbox classifiers (which process incoming documents), these templates are for manually creating notes via the `create --template` command or MCP tools.

---

## When to Use

Use this command to create templates for:

- **PARA core types**: project, area, resource notes
- **Journal types**: daily notes, weekly reviews, retrospectives
- **Custom workflows**: meeting notes, book summaries, habit trackers
- **Any structured note type** you create regularly

---

## Wizard Flow

The command runs an interactive wizard with these steps:

### 1. Template Metadata

```
Template name (kebab-case): custom-project
Display name: Custom Project
Note type (frontmatter type field): custom-project
Template version: 1
```

### 2. Frontmatter Fields

For each field, specify:

- **Field name**: camelCase identifier (e.g., `projectStatus`)
- **Display name**: Human-readable prompt text (e.g., "Project Status")
- **Type**: string, number, date, array, wikilink, or enum
- **Required**: Whether field is mandatory
- **Default value**: For optional fields
- **Auto-fill**: For computed fields (e.g., current date)
- **Enum values**: For enum type (comma-separated list)

**Example field definitions:**

```typescript
{
  name: "title",
  displayName: "Title",
  type: "string",
  required: true
}

{
  name: "created",
  displayName: "Created",
  type: "date",
  required: true,
  autoFill: 'tp.date.now("YYYY-MM-DD")'
}

{
  name: "status",
  displayName: "Status",
  type: "enum",
  required: true,
  enumValues: ["active", "on-hold", "completed"],
  default: "active"
}

{
  name: "area",
  displayName: "Area",
  type: "wikilink",
  required: true
}
```

### 3. Body Sections

For each section, specify:

- **Heading**: Section heading text (e.g., "Why This Matters")
- **Has prompt**: Whether to include interactive prompt
- **Prompt text**: Text to show user (if has prompt)

**Example section definitions:**

```typescript
{
  heading: "Why This Matters",
  hasPrompt: true,
  promptText: "What is the goal?"
}

{
  heading: "Success Criteria",
  hasPrompt: true,
  promptText: "How will you know it's done?"
}

{
  heading: "Next Actions",
  hasPrompt: false  // Static section, no prompt
}
```

---

## Generated Template

### Example Output

Given the configuration above, the wizard generates:

```markdown
---
title: "<% tp.system.prompt("Title") %>"
created: <% tp.date.now("YYYY-MM-DD") %>
status: "<% tp.system.prompt("Status", "active") %>"
area: "[[<% tp.system.prompt("Area") %>]]"
template_version: 1
---

# <% tp.system.prompt("Title") %>

## Why This Matters

<% tp.system.prompt("What is the goal?") %>

## Success Criteria

<% tp.system.prompt("How will you know it's done?") %>

## Next Actions

```

### Template Syntax

The generated templates use **Templater** plugin syntax:

- **Interactive prompts**: `<% tp.system.prompt("Label", "default?") %>`
- **Auto-fill dates**: `<% tp.date.now("YYYY-MM-DD") %>`
- **Wikilinks in YAML**: Quoted to preserve `[[` `]]` brackets

---

## Validation

After generation, the template is validated for:

- ✅ Valid YAML frontmatter (with `---` delimiters)
- ✅ Balanced Templater tags (`<% %>`)
- ✅ Balanced quotes in frontmatter
- ✅ Balanced wikilink brackets (`[[` `]]`)
- ✅ Valid Templater function calls

**Warnings** (non-blocking):

- ⚠️ Missing `template_version` field (recommended for migrations)

---

## File Location

Templates are saved to your vault's Templates directory:

```
${PARA_VAULT}/Templates/{template-name}.md
```

**Overwrite behavior**: If a template with the same name exists, you'll be prompted to confirm overwrite.

---

## Usage After Creation

### Via CLI

```bash
bun run src/cli.ts create --template custom-project "My New Project"
```

### Via MCP Tool

```typescript
await para_create({
  path: "Projects/My New Project.md",
  template: "custom-project"
});
```

---

## Field Types Reference

| Type | Description | Example |
|------|-------------|---------|
| **string** | Text value | `"My Project"` |
| **number** | Numeric value | `42` |
| **date** | Date string | `2025-12-16` |
| **array** | Comma-separated list | `["tag1", "tag2"]` |
| **wikilink** | Note reference | `[[Area/Health]]` |
| **enum** | Predefined values | `"active"` or `"on-hold"` |

---

## Best Practices

### Frontmatter Fields

- ✅ Use `type` field to match note type
- ✅ Include `created` date with auto-fill
- ✅ Add `template_version` for migration support
- ✅ Use wikilinks for relationships (area, projects)
- ✅ Use enums for status/state fields

### Body Sections

- ✅ Start with context section (Why This Matters)
- ✅ Include outcome definition (Success Criteria)
- ✅ Add action tracking (Next Actions, Tasks)
- ✅ Keep prompts focused and actionable
- ✅ Use static sections for structured content (no prompt)

### Template Naming

- ✅ Use kebab-case: `custom-project`, `weekly-review`
- ✅ Match template name to note type
- ✅ Be specific: `client-meeting` not just `meeting`

---

## Examples

### Minimal Template

```typescript
// Metadata
name: "simple-note"
displayName: "Simple Note"
noteType: "note"
version: 1

// Fields
[
  { name: "title", displayName: "Title", type: "string", required: true },
  { name: "created", displayName: "Created", type: "date", required: true,
    autoFill: 'tp.date.now("YYYY-MM-DD")' }
]

// Sections
[
  { heading: "Notes", hasPrompt: true, promptText: "Content" }
]
```

### Rich Project Template

```typescript
// Metadata
name: "project"
displayName: "Project"
noteType: "project"
version: 2

// Fields
[
  { name: "title", displayName: "Project Title", type: "string", required: true },
  { name: "created", displayName: "Created", type: "date", required: true,
    autoFill: 'tp.date.now("YYYY-MM-DD")' },
  { name: "status", displayName: "Status", type: "enum", required: true,
    enumValues: ["planning", "active", "on-hold", "completed", "cancelled"],
    default: "planning" },
  { name: "area", displayName: "Area", type: "wikilink", required: true },
  { name: "dueDate", displayName: "Target Completion (YYYY-MM-DD)",
    type: "date", required: false },
  { name: "tags", displayName: "Tags", type: "array", required: false }
]

// Sections
[
  { heading: "Why This Matters", hasPrompt: true,
    promptText: "What is the desired outcome?" },
  { heading: "Success Criteria", hasPrompt: true,
    promptText: "How will you know it's done?" },
  { heading: "Context & Background", hasPrompt: true,
    promptText: "What's the background or motivation?" },
  { heading: "Resources & References", hasPrompt: false },
  { heading: "Next Actions", hasPrompt: false },
  { heading: "Notes", hasPrompt: false }
]
```

---

## Troubleshooting

### Template Not Found

**Error**: `Template "my-template" not found`

**Solution**: Ensure template exists in `${PARA_VAULT}/Templates/` directory.

### Templater Prompts Don't Appear

**Problem**: When creating notes, Templater doesn't show prompts.

**Solutions**:

1. Enable Templater plugin in Obsidian
2. Configure Templater: Settings → Templater → Template folder location → `Templates`
3. Ensure Obsidian Templater is set to trigger on manual file creation

### Invalid YAML

**Error**: Template validation fails with quote/bracket errors.

**Solution**: Check the generated template for:

- Unbalanced quotes in frontmatter
- Missing `[[` or `]]` in wikilinks
- Unclosed `<% %>` tags

### Wikilinks Not Working

**Problem**: Area/project links don't resolve in Obsidian.

**Solution**: Ensure wikilink fields use proper quoting:

```yaml
# ✅ Correct (quoted)
area: "[[<% tp.system.prompt("Area") %>]]"

# ❌ Wrong (unquoted)
area: [[<% tp.system.prompt("Area") %>]]
```

---

## Related Commands

- `/para-obsidian:create` - Create a note from template
- `/para-obsidian:create-classifier` - Create inbox classifier with template
- `/para-obsidian:list-templates` - View available templates
- `/para-obsidian:validate-template` - Validate existing template syntax

---

## See Also

- [Templater Documentation](https://silentvoid13.github.io/Templater/)
- [PARA Method Guide](https://fortelabs.com/blog/para/)
- [Obsidian YAML Frontmatter](https://help.obsidian.md/Editing+and+formatting/Properties)
