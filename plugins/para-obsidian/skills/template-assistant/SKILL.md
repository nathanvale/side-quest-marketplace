---
name: template-assistant
description: Generate intelligent content for PARA Obsidian vault templates. Use when asked to create new notes (project, area, resource, task, capture, daily, weekly-review, booking, checklist, itinerary, trip-research), populate template sections with AI-generated content, or understand what fields a template requires before creation.
---

# Template Assistant Skill

## Workflow

### 1. Discover Template Structure

```bash
bun src/cli.ts template-fields project --format json
```

Returns required args, auto-filled fields, and body sections.

### 2. Gather User Context

Ask focused questions matching the template type:

| Template | Key Questions |
|----------|---------------|
| project | What's the goal? How will you know it's done? What's blocking you? |
| area | What's your responsibility? What standards matter? |
| resource | Why does this resonate? What's the key insight? |
| task | What's the outcome? What's the priority? |

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
