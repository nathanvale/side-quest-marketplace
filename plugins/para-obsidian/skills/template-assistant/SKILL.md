---
name: template-assistant
description: Generate intelligent content for PARA Obsidian vault templates. Use when asked to create new notes (project, area, resource, task, capture, daily, weekly-review, booking, checklist, itinerary, trip-research), populate template sections with AI-generated content, or understand what fields a template requires before creation.
---

# Template Assistant Skill

## Workflow

### 0. Gather Vault Context (NEW)

Before creating notes, understand what already exists:

```bash
# List existing areas
bun src/cli.ts list-areas --format json

# List existing projects (for task linking)
bun src/cli.ts list-projects --format json

# Show allowed tags from config
bun src/cli.ts list-tags --format json
```

**Why this matters:**
- **Areas**: Prefer existing areas over creating new ones. Only suggest new areas when content doesn't fit existing.
- **Projects**: When creating tasks, link to real existing projects.
- **Tags**: Use ONLY from the allowed list - don't invent tags.

**Via MCP tools:**
- `para_list_areas` - Get existing areas
- `para_list_projects` - Get existing projects
- `para_list_tags` - Get allowed tags
- `para_scan_tags` - See tags actually in use

**For slash commands:** Use `AskUserQuestion` to present existing areas/projects as options, with "Other" for new entries.

### 1. Discover Template Structure

```bash
bun src/cli.ts template-fields project --format json
```

Returns required args, auto-filled fields, and body sections.

### 2. Gather User Context

Ask focused questions matching the template type:

| Template | Key Questions |
|----------|---------------|
| project | What's the goal? How will you know it's done? Which area does this belong to? ← CHECK existing areas first |
| area | What's your responsibility? What standards matter? |
| resource | Why does this resonate? What's the key insight? Which area is this for? ← CHECK existing areas |
| task | What's the outcome? What's the priority? Which project is this for? ← CHECK existing projects |

### 3. Generate Section Content

**Content-Heavy** (project, resource, weekly-review, daily): Generate paragraphs, bullet lists, `[[wikilinks]]`

**Metadata-Heavy** (task, booking, checklist, capture): Focus on frontmatter, minimal body content

**CRITICAL:** When generating wikilinks for frontmatter args, do NOT include quotes:
- ✅ Correct: `--arg "Area=[[Product]]"`
- ❌ Wrong: `--arg "Area=\"[[Product]]\""`

This ensures Dataview queries work correctly.

### 4. Create Note with Content

```bash
bun src/cli.ts create --template project \
  --title "Launch Dark Mode" \
  --arg "Area=[[Product]]" \
  --arg "Target completion date (YYYY-MM-DD)=2025-03-31" \
  --content '{"Why This Matters": "Dark mode reduces eye strain...", "Success Criteria": "- [ ] Theme toggle works\n- [ ] Persists across sessions"}'
```

### 5. Validate Result

```bash
bun src/cli.ts frontmatter validate "Launch Dark Mode.md" --format json
```

---

## Error Handling

| Error | Resolution |
|-------|------------|
| Template not found | Run `bun src/cli.ts templates` to list available templates |
| Missing required arg | Run `bun src/cli.ts template-fields <template>` to discover requirements |
| Section not injected | Heading may not exist in template |
| Vault not git repo | Ensure PARA_VAULT is an initialized git repository |

---

## References

Load these as needed based on the task:

- **Template details**: `./references/template-catalog.md` — Full catalog of all 11 templates with required args and body sections
- **Generation patterns**: `./references/content-strategies.md` — Template-specific content generation strategies (goal clarification, success criteria, risk identification)
- **Examples**: `./references/examples.md` — Complete CLI examples for project, area, resource, task, capture

---

## Vault-Aware Workflows

### Automatic Mode (convert command)

The convert command automatically fetches vault context and guides LLM to prefer existing areas/projects/tags:

```bash
bun src/cli.ts convert note.md --template project
# Vault context: 5 areas, 12 projects, 20 tags
# LLM picks [[Health]] area (existing) instead of creating [[Wellness]]
```

### Interactive Mode (slash commands)

For manual note creation via slash commands, use this pattern:

1. **Fetch context** via MCP tools
2. **Present options** via AskUserQuestion
3. **Create note** with user's choice

**Example:**
```typescript
// 1. Fetch existing areas
const { areas } = await para_list_areas({ response_format: "json" });

// 2. Ask user
const answer = await AskUserQuestion({
  question: "Which area should this project belong to?",
  header: "Area",
  options: areas.map(a => ({
    label: a,
    description: `Use existing area: ${a}`
  }))
});

// 3. Create with selected area
await para_create({
  template: "project",
  title: "My Project",
  args: { "Area": `[[${answer}]]` }  // No quotes!
});
```

### Tag Selection Pattern

Tags are **hard constrained** - must come from config:

```bash
# Get allowed tags
const { tags } = await para_list_tags({ response_format: "json" });

# LLM must choose from: project, area, resource, task, daily, journal...
# NO new tags allowed
```
