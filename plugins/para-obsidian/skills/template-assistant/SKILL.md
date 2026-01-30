---
name: template-assistant
description: Generate intelligent content for PARA Obsidian vault templates. Use when asked to create new notes (project, area, resource, task, clipping, daily, weekly-review, booking, checklist, itinerary, trip-research), populate template sections with AI-generated content, or understand what fields a template requires before creation.
user-invocable: true
allowed-tools: mcp__plugin_para-obsidian_para-obsidian__para_create, mcp__plugin_para-obsidian_para-obsidian__para_list_areas, mcp__plugin_para-obsidian_para-obsidian__para_list_projects, mcp__plugin_para-obsidian_para-obsidian__para_templates, mcp__plugin_para-obsidian_para-obsidian__para_template_fields, mcp__plugin_para-obsidian_para-obsidian__para_fm_validate, AskUserQuestion
---

# Template Assistant Skill

## Workflow

### 0. Gather Vault Context

Before creating notes, understand what already exists:

```typescript
// List existing areas
para_list_areas({ response_format: "json" })

// List existing projects (for task linking)
para_list_projects({ response_format: "json" })
```

**CRITICAL: Classification vs Invention**

When selecting areas/projects, you are CLASSIFYING content into existing categories, NOT inventing factual data:

- **Areas/Projects** = CLASSIFICATION (analytical task)
  - Analyze the content to determine which life domain or responsibility it belongs to
  - Areas are ongoing RESPONSIBILITIES or LIFE DOMAINS (Home, Work, Health, Finance, Learning, Family, etc.)
  - Projects are temporary initiatives with completion dates
  - **Example classifications:**
    - Garden shed construction → [[Home]] (ongoing home maintenance responsibility)
    - Fitness goals → [[Health]] (ongoing health management domain)
    - Work deadline → [[Work]] (professional responsibilities)

- **Factual Data** = INVENTION (requires user knowledge)
  - Dates, numbers, specific names must come from user
  - Use `null` when unknown, never guess

**Via MCP tools:**
- `para_list_areas` - Get existing areas
- `para_list_projects` - Get existing projects

**For slash commands:** Use `AskUserQuestion` to present existing areas/projects as options with descriptions of what domain they represent. Include "Other" for new classifications when content doesn't fit existing categories.

### 1. Discover Template Structure

```typescript
para_template_fields({ template: "project", response_format: "json" })
```

Returns required args, auto-filled fields, and body sections.

### 2. Gather User Context

Ask focused questions matching the template type:

| Template | Key Questions |
|----------|---------------|
| project | What's the goal? How will you know it's done? Which life domain does this belong to (analyze: Home/Work/Health/Finance/Learning/Family)? ← CLASSIFY into existing areas |
| area | What's your responsibility? What standards matter? |
| resource | Why does this resonate? What's the key insight? Which life domain is this resource for? ← CLASSIFY based on content domain |
| task | What's the outcome? What's the priority? Which project is this supporting (analyze task context)? ← CLASSIFY into existing projects or standalone |

**Classification approach:**
- Analyze note content to determine life domain or project context
- Present existing areas/projects as classification options
- Only suggest new areas/projects when content clearly doesn't fit existing categories
- Remember: Classification = analytical judgment, not data invention

### 3. Generate Section Content

**Content-Heavy** (project, resource, weekly-review, daily): Generate paragraphs, bullet lists, `[[wikilinks]]`

**Metadata-Heavy** (task, booking, checklist): Focus on frontmatter, minimal body content

**CRITICAL:** When generating wikilinks for frontmatter args, do NOT include extra quotes:
- ✅ Correct: `"Area": "[[Product]]"`
- ❌ Wrong: `"Area": "\"[[Product]]\""`

This ensures Dataview queries work correctly.

### 4. Create Note with Content

```typescript
para_create({
  template: "project",
  title: "Launch Dark Mode",
  args: {
    "Area": "[[Product]]",
    "Target completion date (YYYY-MM-DD)": "2025-03-31"
  },
  content: {
    "Why This Matters": "Dark mode reduces eye strain and improves accessibility for users who work in low-light environments.",
    "Success Criteria": "- [ ] Theme toggle works\n- [ ] Persists across sessions\n- [ ] Respects system preference"
  },
  response_format: "json"
})
```

### 5. Validate Result

```typescript
para_fm_validate({ file: "Launch Dark Mode.md", response_format: "json" })
```

---

## Error Handling

| Error | Resolution |
|-------|------------|
| Template not found | Use `para_templates({ response_format: "json" })` to list available templates |
| Missing required arg | Use `para_template_fields({ template: "<name>", response_format: "json" })` to discover requirements |
| Section not injected | Heading may not exist in template - check template structure |
| Vault not git repo | Ensure PARA_VAULT is an initialized git repository |

---

## References

Load these as needed based on the task:

- **Template details**: `./references/template-catalog.md` — Full catalog of all 11 templates with required args and body sections
- **Generation patterns**: `./references/content-strategies.md` — Template-specific content generation strategies (goal clarification, success criteria, risk identification)
- **Examples**: `./references/examples.md` — Complete CLI examples for project, area, resource, task

---

## Vault-Aware Workflows

### Automatic Mode (convert workflow)

The convert workflow uses **classification-based prompting** to intelligently populate area/project fields:

```typescript
// Read existing note content
para_read({ file: "note.md", response_format: "json" })

// Get vault context for classification
para_list_areas({ response_format: "json" })
para_list_projects({ response_format: "json" })

// Create with classified area (LLM analyzes content and classifies)
para_create({
  template: "project",
  title: "Fitness Tracking App",
  args: { "Area": "[[Health]]" },  // Classified into existing area
  response_format: "json"
})
// Example: "fitness tracking" content → [[Health]] (not "Wellness" or "Fitness")
```

**How classification works:**
1. LLM receives existing areas/projects as classification options
2. Analyzes note content to determine life domain or project context
3. Selects best-matching existing category OR suggests new one if content doesn't fit
4. Areas represent ongoing RESPONSIBILITIES (Home, Work, Health) not temporary topics
5. Projects represent temporary INITIATIVES with completion dates

**Classification examples from prompt:**
- Garden shed → [[Home]] (ongoing home maintenance responsibility)
- Fitness goals → [[Health]] (ongoing health management domain)
- Work project → [[Work]] (professional responsibilities domain)

### Interactive Mode (slash commands)

For manual note creation via slash commands, use **classification-based questioning**:

1. **Fetch context** via MCP tools
2. **Analyze content** to determine likely domain
3. **Present options** with domain descriptions via AskUserQuestion
4. **Create note** with classification

**Example:**
```typescript
// 1. Fetch existing areas
const { areas } = await para_list_areas({ response_format: "json" });

// 2. Analyze content and ask user (with domain context)
const answer = await AskUserQuestion({
  question: "This content appears to be about fitness tracking. Which life domain should it belong to?",
  header: "Area",
  options: [
    { label: "Health", description: "Ongoing health & wellness management (recommended for fitness)" },
    { label: "Personal", description: "Personal development & self-improvement" },
    { label: "Home", description: "Home responsibilities & maintenance" }
  ],
  multiSelect: false
});

// 3. Create with classified area
await para_create({
  template: "project",
  title: "My Project",
  args: { "Area": `[[${answer}]]` }  // No quotes!
});
```

**Classification guidance:**
- Frame options with domain descriptions so user understands what each area represents
- Suggest most likely classification based on content analysis
- Only offer "Other" when content clearly doesn't fit any existing domain

### Tag Selection Pattern

Tags are **hard constrained** - must come from config. When working with tags, always validate against the allowed tag list defined in your vault configuration. Tags typically include categories like: project, area, resource, task, daily, journal, etc. NO new tags are allowed outside the configured set.
