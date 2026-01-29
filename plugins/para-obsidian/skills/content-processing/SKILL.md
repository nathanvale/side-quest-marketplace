---
name: content-processing
description: Create notes, inject Layer 1 content, and commit to vault. Canonical pipeline shared by triage-worker agent and quick-create skill. Not user-invocable — loaded as reference knowledge.
user-invocable: false
---

# Content Processing Pipeline

Canonical pipeline for creating notes from enriched content. This skill is the single source of truth for:

1. **Note creation** — generic `para_create` pattern for all templates
2. **Layer 1 injection** — `para_replace_section` with formatting rules
3. **Commit** — `para_commit` after creation
4. **Null-safety** — field handling rules

Callers (triage-worker, quick-create) handle enrichment, classification, user confirmation, and persistence separately. This skill only covers the "create → inject → commit" pipeline.

---

## Pipeline Overview

```
Enriched content + classification (from caller)
    ↓
1. Discover template metadata (para_template_fields)
    ↓
2. Create note (para_create — frontmatter-only args, dest auto-resolved)
    ↓
3. Commit (para_commit — vault needs clean tree)
    ↓
4. Inject Layer 1 (para_replace_section — resources only)
    ↓
5. Commit again (para_commit — persist Layer 1)
```

---

## Null-Safety Rules

**CRITICAL:** Never pass `null` values in `args` to `para_create`. Omit the key entirely.

```
// WRONG — creates "[[null]]" in frontmatter
args: { projects: null, author: null }

// CORRECT — omit keys with no value
args: { }  // projects and author omitted
```

Apply this rule to ALL optional fields: `projects`, `project`, `author`, `transcription`, `source`.

---

## Enrichment

Before creating notes, content must be enriched. See the canonical routing table and tool selection:

@plugins/para-obsidian/skills/triage/references/enrichment-strategies.md

**Quick summary:** YouTube → `get_transcript`, Articles/GitHub → `firecrawl_scrape`, X/Twitter → Chrome DevTools, Voice/Attachment → `para_read`.

---

## Classification

Use the para-classifier skill for determining template, resource type, source format, area, and project:

- **Decision Tree:** @plugins/para-obsidian/skills/para-classifier/references/classification-decision-tree.md
- **Emoji Mapping:** @plugins/para-obsidian/skills/para-classifier/references/emoji-mapping.md

---

## Note Creation (Generic Pattern)

**All templates use the same flow.** The creation layer auto-resolves destinations and filters invalid args.

### Step 1: Discover template metadata

```
para_template_fields({
  template: proposed_template,
  response_format: "json"
})
```

Response includes:
- `creation_meta.dest` — default destination directory
- `creation_meta.titlePrefix` — emoji prefix (if any)
- `creation_meta.sections` — body section headings (if any)
- `validArgs` — list of accepted field names for this template
- `frontmatter_hints` — enum values, types, and constraints

### Step 2: Map classification to args

From your classification output, build `args` using only fields listed in `validArgs`. Omit any field with a null/empty value.

```
// Generic pattern — works for ALL templates
para_create({
  template: proposed_template,
  title: proposed_title,
  args: {
    // Only include fields from validArgs
    // Omit null values entirely
    ...classifiedFields
  },
  response_format: "json"
})
```

**Destination auto-resolved:** `para_create` uses the template's configured default destination. No need to pass `dest` unless overriding.

**Invalid args filtered:** Any arg not in the template's frontmatter rules is silently filtered with a log warning. This prevents typos or stale field names from polluting frontmatter.

### Step 3: Template-specific post-create

| Template | Post-create steps |
|----------|-------------------|
| `resource` | Commit → Inject Layer 1 → Commit |
| `meeting` | Pass structured body via `content` parameter → Commit |
| `invoice` | Commit (frontmatter-only) |
| `booking` | Commit (frontmatter-only) |
| All others | Commit |

**Only resources get Layer 1 injection.** Meetings pass structured body sections via the `content` parameter on `para_create`. All other templates are frontmatter-only.

### Meeting content parameter

Meetings are the only template that uses the `content` parameter to pass structured body sections:

```
para_create({
  template: "meeting",
  title: proposed_title,
  args: { meeting_type, meeting_date, area, project, summary, transcription },
  content: {
    "Attendees": attendees.map(a => `- ${a}`).join('\n'),
    "Notes": meeting_notes.map(n => `- ${n}`).join('\n'),
    "Decisions Made": decisions.map(d => `- ${d}`).join('\n'),
    "Action Items": action_items.map(i => `- ${i.task}`).join('\n'),
    "Follow-up": follow_up.map(f => `- ${f}`).join('\n')
  },
  response_format: "json"
})
```

### Key field name differences by template

| Template | Area field | Project field | Notes |
|----------|-----------|---------------|-------|
| `resource` | `areas` (plural, YAML array) | `projects` (plural, YAML array) | Also has `resource_type`, `source_format`, `distilled` |
| `meeting` | `area` (singular) | `project` (singular) | Also has `meeting_type`, `meeting_date`, `transcription` |
| `invoice` | `area` (singular) | `project` (singular) | Also has `provider`, `amount`, `currency`, `status` |
| `booking` | — | `project` (singular) | Also has `booking_type`, `booking_ref`, `provider`, `cost` |

### Multi-value areas/projects (resources only)

Resource `areas` and `projects` are YAML arrays. Obsidian requires proper list format:

```yaml
# Correct YAML list (Obsidian renders as List property)
areas:
  - "[[🤖 AI Practice]]"
  - "[[🌱 Home Server]]"

# WRONG — single string, not a list
areas: "[[🤖 AI Practice]], [[🌱 Home Server]]"
```

**How to pass to `para_create`:** The `args` parameter is `Record<string, string>`, so encode arrays as JSON strings. `para_create` parses these automatically via `tryParseJsonArray()`.

```
// Single area (unchanged — backward compatible)
args: { areas: "[[🌱 AI Practice]]" }

// Multiple areas — JSON array string
args: { areas: '["[[🤖 AI Practice]]", "[[🌱 Home Server]]"]' }
```

**Post-creation via `para_fm_set`:** Same pattern — pass JSON array strings:
```
para_fm_set({ file, set: { areas: '["[[Area 1]]", "[[Area 2]]"]' } })
```

**Meeting/Invoice/Booking** use singular `area`/`project` fields (single wikilink, not arrays). Multi-value does not apply to these templates.

---

## Commit After Creation

**CRITICAL:** Immediately call `para_commit` after `para_create`. The vault requires a clean working tree for subsequent operations (Layer 1 injection).

```
para_commit({
  message: "Add [template]: [title]",
  response_format: "json"
})
```

---

## Layer 1 Injection

After creating and committing the note, inject content into the "Layer 1: Captured Notes" section. **Only for resources** — meetings use structured body sections passed via `content` parameter.

```
para_replace_section({
  file: "<created-file-path>",
  heading: "Layer 1: Captured Notes",
  content: "<formatted-content>",
  response_format: "json"
})
```

### Formatting Rules

Use `####` headings or deeper (never `#`, `##`, or `###` — those are reserved for note structure).

| Source | Strategy | Target Length |
|--------|----------|---------------|
| Article | First 3 paragraphs + key H2/H3 headings with topic sentences + conclusion | 2-3k tokens |
| YouTube | ~10% sampled transcript segments with timestamps | 2-3k tokens |
| Thread | Full thread content in order | Keep all |
| Voice memo | Full transcription if <2k tokens, else key segments | Variable |
| Attachment | Key passages with page references | 2-3k tokens |

### After Injection

Commit again to persist the Layer 1 content:

```
para_commit({
  message: "Add Layer 1: [title]",
  response_format: "json"
})
```

---

## Error Handling

| Step | Failure | Action |
|------|---------|--------|
| `para_create` | Fails | Stop pipeline. Set `created: null`, `layer1_injected: null`. Report error. |
| `para_commit` (post-create) | Fails | Continue to Layer 1. Note exists but isn't committed yet. |
| `para_replace_section` | Fails | Keep the note. Set `layer1_injected: false`. Resource still usable. |
| `para_commit` (post-inject) | Fails | Layer 1 exists in working tree. Note in report. |

**Soft failure philosophy:** Note creation is primary. Layer 1 injection and commit are enhancements. Don't block note creation if downstream steps fail.

---

## Proposal Field Reference

See @plugins/para-obsidian/skills/triage/references/proposal-schema.md for the canonical schema.

**Key field names:** `area` (single wikilink or array of wikilinks), `project` (single wikilink, array, or null), `resourceType` (camelCase, NOT `resource_type`).
