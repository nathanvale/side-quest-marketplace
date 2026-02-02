---
name: analyze-attachment
description: Analyze PDF/DOCX attachments, create notes, and return lightweight proposals. Reads content via para_read, analyzes, creates note with para_create, and persists proposal. Worker skill for triage orchestrator.
user-invocable: false
---

# Analyze Attachment

Analyze PDF or DOCX attachments, **create the note**, and return a lightweight proposal.

**Key design:** Like analyze-web and analyze-voice, this skill creates the note AND returns a proposal. The full content stays in subagent context — only the proposal flows back to the coordinator.

## Input

You receive:
- `file`: Path to attachment inbox note (e.g., `00 Inbox/📎 document.md` — the inbox note referencing the attachment)
- `areas`: Available areas in vault
- `projects`: Available projects in vault

## Output

Return a JSON proposal per @plugins/para-obsidian/skills/triage/references/proposal-schema.md.

**Key:** Use `area` (single wikilink), `project` (single wikilink or null), `resourceType` (camelCase). Include `file`, `type: "attachment"`, `created`, `layer1_injected`, and `document_type` alongside the standard proposal fields.

For attachments, always set `source_format: "document"`. Include `document_type` (invoice, contract, cv, letter, medical, report, manual) as an attachment-specific field.

## Workflow

### Step 1: Read Inbox Note

```
para_read({ file: "[input file]", response_format: "json" })
```

Extract frontmatter fields (`source`, `type`, pre-filled `areas`/`projects`) and body content from the inbox note. The inbox note typically contains extracted text from the attachment (placed there by the CLI scan step or Web Clipper).

Do NOT call `para_fm_get` separately — `para_read` returns the full file including frontmatter.

### Step 2: Analyze Content

Based on the extracted content in the inbox note, determine:
1. **Document type**: Invoice, contract, CV, letter, medical, report, manual
2. **Template**: Most attachments → `resource`, invoices → `invoice`, bookings → `booking`
3. **Key information**: Dates, amounts, parties, terms
4. **Area/project**: Which vault area does this belong to?

### Step 3: Pre-Creation Self-Check

Before calling `para_create`, verify your `args` object includes critical fields:

**If resource:**
- [ ] `summary` — one-sentence description
- [ ] `areas` — wikilink(s)
- [ ] `source_format` — `"document"`
- [ ] `resource_type` — based on document type

**If invoice/booking:**
- [ ] Template-specific fields (see proposal-schema.md)

### Step 4: Create Note (Single Call)

Use `para_create` with the `content` parameter to create the note AND inject key content:

```
para_create({
  template: proposed_template,
  title: proposed_title,
  args: { ...fields from validArgs },
  content: {
    "<content-target-heading>": formattedContent
  },
  response_format: "json"
})
```

**Content formatting for attachments:** Extract key passages with page references. Target 2-3k tokens. Use `####` headings for structure.

**If `para_create` fails:** Set `created: null`, `layer1_injected: null`, continue with proposal.

### Step 5: Verify & Repair

**During triage:** Skip this step entirely. Set `verification_status: "pending_coordinator"` and `verification_issues: []`. The coordinator handles verification in Phase 2.5.

**Standalone callers:** Call `para_fm_get` and verify critical fields. Repair mismatches via `para_fm_set`.

### Step 6: Return Proposal

Return the lightweight JSON proposal. The note is already created.

## Document Type Classification

The CLI uses heuristic classifiers for common document types:

| Type | Filename Patterns | Content Patterns |
|------|-------------------|------------------|
| `invoice` | `*invoice*`, `*receipt*`, `*bill*` | "total", "amount due", "payment" |
| `contract` | `*contract*`, `*agreement*` | "parties", "terms", "signature" |
| `cv` | `*cv*`, `*resume*` | "experience", "education", "skills" |
| `letter` | `*letter*` | "dear", "sincerely", formal address |
| `medical` | `*medical*`, `*health*` | "diagnosis", "prescription", "patient" |
| `report` | `*report*` | "findings", "analysis", "recommendations" |

## CLI Commands Reference

```bash
# Full inbox scan (recommended)
para scan

# Execute approved suggestions
para execute

# Process specific file
para process-inbox --file "path/to/file.pdf"

# Preview without changes
para process-inbox --dry-run

# Auto-approve (no prompts)
para process-inbox --auto

# Registry management
para registry list     # Show processed items
para registry remove   # Remove from registry
para registry clear    # Clear all
```

## Attachment Handling

Unlike clippings and transcriptions, attachments are **NOT deleted or moved**:

1. **Attachment stays in place** (e.g., `00 Inbox/Attachments/doc.pdf`)
2. **Resource note created** with `source` linking to attachment
3. **Link format**: `[[00 Inbox/Attachments/doc.pdf]]`

This preserves the original document while creating a searchable, connected note.

## Example Output

```json
{
  "file": "00 Inbox/Attachments/Telstra-Invoice-Jan-2024.pdf",
  "type": "attachment",
  "proposed_title": "Telstra Invoice January 2024",
  "proposed_template": "invoice",
  "summary": "Monthly Telstra bill for January 2024. Total amount $89.95 for mobile plan. Due date February 15, 2024.",
  "categorization_hints": [
    "Monthly mobile plan charge: $89.95",
    "Due date: February 15, 2024",
    "Account number: 1234567890"
  ],
  "area": "[[🌱 Finance]]",
  "project": null,
  "document_type": "invoice",
  "source_format": "document",
  "confidence": "high",
  "notes": null
}
```

## Deep Analysis Mode

For ambiguous documents (multiple valid interpretations):

```json
{
  "options": [
    {
      "label": "A",
      "interpretation": "Employment Contract",
      "proposed_template": "resource",
      "document_type": "contract",
      "rationale": "Contains employment terms, salary, start date"
    },
    {
      "label": "B",
      "interpretation": "Offer Letter",
      "proposed_template": "resource",
      "document_type": "letter",
      "rationale": "Formal letter format, conditional language"
    },
    {
      "label": "C",
      "interpretation": "HR Document",
      "proposed_template": "resource",
      "document_type": "document",
      "rationale": "General HR documentation, reference material"
    }
  ]
}
```

## Why This Skill Exists

Beyond processing attachments, this skill serves as **living documentation** for the `para` CLI:

1. **ADHD-friendly** - Skills you build, then forget how to use
2. **Always up-to-date** - Used by AI, so errors get noticed
3. **Contextual help** - When processing attachments, you see how the CLI works

The CLI does the heavy lifting (extraction, classification). This skill documents when and how to use it.
