---
name: analyze-attachment
description: Analyze PDF/DOCX attachments and return resource proposals. Uses para-obsidian CLI for extraction, analyzes content, returns structured proposal. Worker skill for triage orchestrator.
user-invocable: false
---

# Analyze Attachment

Analyze PDF or DOCX attachments and return a **proposal**. Unlike web clippings and voice memos, attachments follow a **proposal-only flow** — the triage-worker agent handles note creation after receiving the proposal.

## Architecture Note

**Different from analyze-web/analyze-voice:** Those skills create notes AND inject Layer 1 content before returning. Attachments use CLI extraction (`para scan`) which has its own workflow, so this skill returns a proposal only. The triage-worker creates the note using the proposal fields.

## Skills as Documentation

This skill documents how to use the `para` CLI for attachment processing. The CLI handles:
- PDF text extraction via `pdftotext`
- DOCX extraction via `mammoth` + `turndown`
- Heuristic classification (invoice, contract, CV, etc.)
- LLM fallback for ambiguous documents

## Input

You receive:
- `file`: Path to attachment in inbox (e.g., `00 Inbox/Attachments/document.pdf`)
- `areas`: Available areas in vault
- `projects`: Available projects in vault

## Output

Return a JSON proposal per @plugins/para-obsidian/skills/triage/references/proposal-schema.md.

**Key:** Use `area` (single wikilink), `project` (single wikilink or null), `resourceType` (camelCase). Include `file`, `type: "attachment"`, and `document_type` alongside the standard proposal fields.

For attachments, always set `source_format: "document"`. Include `document_type` (invoice, contract, cv, letter, medical, report, manual) as an attachment-specific field.

## Workflow

### Step 1: Check What's in Inbox

```
para_list({ path: "00 Inbox/Attachments", response_format: "json" })
```

Look for PDFs and DOCX files.

### Step 2: Use CLI for Extraction

The `para scan` command handles attachment processing:

```bash
# Scan inbox and extract content from attachments
para scan

# Or process specific file
para process-inbox --file "00 Inbox/Attachments/document.pdf"
```

**CLI Capabilities:**
- Extracts text from PDFs using `pdftotext`
- Extracts content from DOCX using `mammoth` + `turndown`
- Runs heuristic classifiers (filename patterns, content patterns)
- Falls back to LLM for ambiguous documents

### Step 3: Read Extracted Content

After `para scan`, check if a suggestion was created:

```
para_read({ file: "00 Inbox/[suggestion file]", response_format: "json" })
```

The CLI creates suggestion files with extracted content and classification.

### Step 4: Analyze and Propose

Based on extracted content, determine:
1. **Document type**: Invoice, contract, CV, letter, medical, report, manual
2. **Template**: Most attachments → `resource`, invoices → `invoice`, etc.
3. **Key information**: Dates, amounts, parties, terms

### Step 5: Return Proposal

Return the JSON proposal structure.

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
