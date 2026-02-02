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
2. Create note (para_create)
   - Resources: pass Layer 1 via `content` parameter → single call creates + injects + commits
   - Meetings: pass structured body via `content` parameter → single call creates + injects + commits
   - Others: frontmatter-only → auto-commits
```

**Key optimization:** Resources and meetings both use the `content` parameter on `para_create` to inject body content in a single CLI invocation. The CLI internally calls `createFromTemplate → replaceSections → autoCommitChanges` — no separate `para_commit` or `para_replace_section` needed.

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

**Quick summary:** YouTube → `get_transcript`, Articles/GitHub → `firecrawl_scrape`, X/Twitter → X-API MCP (`x_get_tweet`), Voice/Attachment → `para_read`.

---

## Classification

Use the para-classifier skill for determining template, resource type, source format, area, and project:

- **Decision Tree:** @plugins/para-obsidian/skills/para-classifier/references/classification-decision-tree.md
- **Emoji Mapping:** @plugins/para-obsidian/skills/para-classifier/references/emoji-mapping.md

---

## Note Creation (Generic Pattern)

**All templates use the same flow.** The creation layer auto-resolves destinations and filters invalid args.

### Step 1: Discover template metadata

**If template fields are provided in your prompt context (e.g., during triage), skip this step — use the pre-loaded values directly.** The coordinator pre-fetches these once and passes them to all subagents.

Otherwise, call:

```
para_template_fields({
  template: proposed_template,
  response_format: "json"
})
```

Response includes:
- `creation_meta.dest` — default destination directory
- `creation_meta.titlePrefix` — emoji prefix (auto-applied by `para_create`; do NOT add to title manually)
- `creation_meta.sections` — body section headings (if any)
- `creation_meta.contentTargets` — section headings for content injection (e.g., `["Layer 1: Captured Notes"]`)
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

| Template | How | Post-create steps |
|----------|-----|-------------------|
| `resource` | Pass Layer 1 via `content` parameter | None — `para_create` handles inject + commit |
| `meeting` | Pass structured body via `content` parameter | None — `para_create` handles inject + commit |
| `invoice` | Frontmatter-only | None — auto-committed |
| `booking` | Frontmatter-only | None — auto-committed |
| All others | Frontmatter-only | None — auto-committed |

**Resources use the `content` parameter** just like meetings. Discover the target section heading from `creation_meta.contentTargets[0]` via `para_template_fields`, then pass it as a key in the `content` parameter. The CLI internally calls `replaceSections()` then `autoCommitChanges()` — no separate `para_commit` or `para_replace_section` calls needed.

### Resource content parameter (single-call create+inject)

Resources pass Layer 1 content via the `content` parameter. Discover the content target heading from `creation_meta.contentTargets[0]` via `para_template_fields` (typically `"Layer 1: Captured Notes"`):

```
para_create({
  template: "resource",
  title: proposed_title,
  args: { ...fields from validArgs },
  content: {
    "<discovered-content-target>": formattedLayerOneContent
  },
  response_format: "json"
})
```

**Why this works:** `create.ts` calls `createFromTemplate → replaceSections → autoCommitChanges` internally when `content` is provided. This replaces the old 4-step flow (create → commit → replace_section → commit) with a single tool call, saving ~3-6s per item.

### Meeting content parameter

Meetings also use the `content` parameter to pass structured body sections. Discover section headings from `creation_meta.sections` via `para_template_fields`:

```
para_create({
  template: "meeting",
  title: proposed_title,
  args: { ...fields from validArgs },
  content: {
    "<discovered-attendees-section>": attendees.map(a => `- ${a}`).join('\n'),
    "<discovered-notes-section>": meeting_notes.map(n => `- ${n}`).join('\n'),
    "<discovered-decisions-section>": decisions.map(d => `- ${d}`).join('\n'),
    "<discovered-action-items-section>": action_items.map(i => `- ${i.task}`).join('\n'),
    "<discovered-follow-up-section>": follow_up.map(f => `- ${f}`).join('\n')
  },
  response_format: "json"
})
```

### Key field name differences by template

Field names vary across templates. **Always use `validArgs` from `para_template_fields`** to discover the correct field names for each template. Key differences to be aware of:

- Some templates use plural fields (`areas`, `projects`) with YAML array support
- Others use singular fields (`area`, `project`) for single wikilinks
- Each template has its own domain-specific fields (e.g., `meeting_type`, `resource_type`)

Call `para_template_fields` per template to get the authoritative field list.

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

## Post-Creation Verification

**During triage:** Post-creation verification is handled by the coordinator (Phase 2.5), not the worker. Workers set `verification_status: "pending_coordinator"` and skip this section. The steps below apply to standalone callers (quick-create) only.

After creating a note, verify that critical frontmatter fields match your intended values. This catches two failure modes:
1. **Mismatch** — you intended a value but `para_create` received wrong/empty args (self-repairable)
2. **Missing classification** — you couldn't determine the value at all (flag for user review)

### Critical Fields Per Template

| Template | Fields to verify | Action |
|----------|-----------------|--------|
| `resource` | `summary`, `areas`, `source_format`, `resource_type` | ALWAYS verify |
| `meeting` | `summary`, `area`, `meeting_type` | ALWAYS verify |
| `invoice`/`booking` | — | SKIP → `verification_status: "skipped"` |

### Verification Steps

#### Step 1: Read actual frontmatter

```
para_fm_get({ file: created_path, response_format: "json" })
```

#### Step 2: Check critical fields (two checks per field)

For each critical field, run both checks:

**A. MISMATCH CHECK:** You intended a non-empty value but the file has empty string `""`, empty array `[]`, or `"[[null]]"`.
→ Add to `repair_set` (will fix via `para_fm_set`)

**B. EMPTY CHECK:** Both your intended value AND the file value are empty/null.
→ Add to `verification_issues` (flag for user review)
→ This means you couldn't classify it — the user needs to decide

#### Step 3: Self-repair (if repair_set is non-empty)

```
para_fm_set({ file: created_path, set: repair_set, response_format: "json" })
```

One call, all fixes batched. For array fields (e.g., `areas`), pass JSON array strings: `'["[[Area 1]]", "[[Area 2]]"]'`.

#### Step 4: Set verification status

| Outcome | `verification_status` | `verification_issues` |
|---------|----------------------|-----------------------|
| All fields match | `"verified"` | `[]` |
| Mismatches found AND repaired | `"repaired"` | `[]` |
| Repair failed | `"failed"` | `["repair failed: {detail}"]` |
| Empty fields (can't classify) | `"needs_review"` | `["missing: areas", ...]` |
| Invoice/booking (skipped) | `"skipped"` | `[]` |

Include both fields in your proposal output (TaskUpdate metadata and PROPOSAL_JSON).

### Worked Example: Summary Mismatch Repair

Analysis determined: `summary = "How To Make Your Agent Learn And Ship While You Sleep"`
But `para_create` args omitted `summary` (bug: value lost during arg construction).

1. `para_fm_get` returns: `{ summary: "" }`
2. MISMATCH detected: intended non-empty, file has empty
3. `para_fm_set({ file, set: { summary: "How To Make Your Agent Learn And Ship While You Sleep" } })`
4. `verification_status: "repaired"`, `verification_issues: ["repaired: summary"]`

---

## Commit After Creation (standalone callers only)

**When NOT using the `content` parameter:** Call `para_commit` after `para_create` if you're creating frontmatter-only notes outside the triage pipeline (e.g., invoices, bookings).

```
para_commit({
  message: "Add [template]: [title]",
  response_format: "json"
})
```

**When using `content` parameter:** No separate commit needed — `para_create` auto-commits after injection.

---

## Layer 1 Formatting Rules

Layer 1 content injected via the `content` parameter (resources) should follow these formatting rules.

Use `####` headings or deeper (never `#`, `##`, or `###` — those are reserved for note structure).

| Source | Strategy | Target Length |
|--------|----------|---------------|
| Article | First 3 paragraphs + key H2/H3 headings with topic sentences + conclusion | 2-3k tokens |
| YouTube | ~10% sampled transcript segments with timestamps | 2-3k tokens |
| Thread | Full thread content in order | Keep all |
| Voice memo | Full transcription if <2k tokens, else key segments | Variable |
| Attachment | Key passages with page references | 2-3k tokens |

## Legacy Layer 1 Injection (standalone callers only)

For non-triage callers that need separate injection (e.g., `quick-create`):

```
para_replace_section({
  file: "<created-file-path>",
  heading: "<discovered-content-target>",
  content: "<formatted-content>",
  response_format: "json"
})
```

Then commit:
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
| `para_create` (with `content`) | Fails | Stop pipeline. Set `created: null`, `layer1_injected: null`. Report error. |
| `para_create` (without `content`) | Fails | Stop pipeline. Set `created: null`. Report error. |
| `para_commit` (standalone callers) | Fails | Note exists but isn't committed. Continue if possible. |
| `para_replace_section` (standalone callers) | Fails | Keep the note. Set `layer1_injected: false`. Resource still usable. |

**Soft failure philosophy:** Note creation is primary. Layer 1 injection and commit are enhancements. Don't block note creation if downstream steps fail.

---

## Proposal Field Reference

See @plugins/para-obsidian/skills/triage/references/proposal-schema.md for the canonical schema.

**Key field names:** `area` (single wikilink or array of wikilinks), `project` (single wikilink, array, or null), `resourceType` (camelCase, NOT `resource_type`).
