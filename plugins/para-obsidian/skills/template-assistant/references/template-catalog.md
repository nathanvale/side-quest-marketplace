# Template Catalog

Guide for selecting the right PARA template. For any template's current fields, sections, and body config, use dynamic discovery:

```
para_template_fields({ template: "<template-name>", response_format: "json" })
```

This returns `validArgs`, `creation_meta.dest`, `creation_meta.sections`, `creation_meta.contentTargets`, and `frontmatter_hints` — always up-to-date with the source of truth in `defaults.ts`.

---

## Template Classification

### Content-Heavy (Extensive body sections)

| Template | Focus | When to Use |
|----------|-------|-------------|
| `project` | Goal tracking, milestones, next actions | Time-bound initiatives with clear outcomes |
| `resource` | Progressive summarization, connections | Capturing and distilling external knowledge |
| `weekly-review` | Reflection phases, planning | Weekly GTD-style review |
| `daily` | Intentions, log, reflection | Daily planning and journaling |
| `trip` | Travel planning with bookings/itinerary | Trip projects with sub-notes |

### Metadata-Heavy (Frontmatter-focused)

| Template | Focus | When to Use |
|----------|-------|-------------|
| `task` | Action metadata, dependencies | Actionable items with outcomes |
| `booking` | Transaction tracking | Travel/event bookings and payments |
| `checklist` | Process items | Reusable process templates |
| `itinerary` | Day planning | Day-by-day travel schedules |
| `invoice` | Financial tracking | Bills and payment records |
| `session` | Appointment tracking | Therapy, coaching, consulting |

### Hybrid (Balance of both)

| Template | Focus | When to Use |
|----------|-------|-------------|
| `area` | Purpose, standards, routines | Ongoing life responsibilities |
| `meeting` | Structured meeting notes | Meeting notes from transcriptions |
| `research` | Decision framework | Research and option comparison |

### Capture Templates

| Template | Focus | When to Use |
|----------|-------|-------------|
| `clipping` | Web/text capture | URLs, articles, quick captures |
| `bookmark` | Web bookmark | Obsidian Web Clipper captures |

### Document Templates

| Template | Focus | When to Use |
|----------|-------|-------------|
| `medical-statement` | Health records | Medical statements and bills |
| `cv` | Professional profile | Resumes and CVs |
| `letter` | Correspondence | Formal letters |
| `employment-contract` | Work agreements | Employment contracts |
| `document` | Generic documents | Catch-all for other document types |

---

## Content Generation Priority

When generating content for templates with body sections, prioritize in this order:

### High Impact (Generate first)
- Why This Matters / Purpose
- Success Criteria / Definition of Done
- Next Actions / Immediate steps
- Key Insights / Summary

### Medium Impact (Add detail)
- Objectives / Milestones
- Risks & Blockers
- Connections / Related notes
- Action Items

### Lower Impact (Optional)
- Progress Log (start with initial entry)
- Notes (leave for organic growth)
- Statistics / Metrics (placeholder)

---

## Discovery Pattern

Always call `para_template_fields` before creating notes to get the current:
- **Fields** — `validArgs` lists all accepted frontmatter fields
- **Sections** — `creation_meta.sections` lists all body section headings
- **Destination** — `creation_meta.dest` gives the default folder
- **Content targets** — `creation_meta.contentTargets` identifies sections for content injection
- **Title prefix** — `creation_meta.titlePrefix` gives the emoji prefix
- **Hints** — `frontmatter_hints` provides enum values and constraints
