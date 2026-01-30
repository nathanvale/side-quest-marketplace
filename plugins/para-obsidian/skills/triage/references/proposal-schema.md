# Proposal Schema

> **Canonical source** for triage proposal fields. All worker skills, agents, and orchestrator reference this document.

## TypeScript Interface

```typescript
interface Proposal {
  // Core fields (all types)
  proposed_title: string;        // Plain descriptive title — NO emoji prefix (para_create adds it automatically)
  proposed_template: "resource" | "meeting" | "invoice" | "booking";
  summary: string;               // 2-3 sentences capturing key value
  area: string | string[];       // Single: "[[Area]]" or multi: ["[[Area 1]]", "[[Area 2]]"]
  project: string | string[] | null; // Single: "[[Project]]", multi: ["[[P1]]", "[[P2]]"], or null
  resourceType: string;          // article, video, thread, meeting, reference, idea

  // Creation fields (from note creation step)
  created: string | null;          // File path of created note, or null if failed/capture
  layer1_injected: boolean | null; // true/false/null (null = not applicable)

  // UX fields (for review table and "Deeper" option)
  categorization_hints: string[];  // 3 key points explaining categorization
  source_format: "article" | "video" | "audio" | "document" | "thread" | "image";
  confidence: "high" | "medium" | "low";  // Triggers "Deeper" when low
  notes: string | null;          // Special considerations for reviewer

  // Meeting-specific fields (when proposed_template === "meeting")
  meeting_type?: "standup" | "1on1" | "planning" | "retro" | "workshop" | "general";
  meeting_date?: string;         // ISO date from recorded field
  attendees?: string[];          // ["[[Name]]", "Speaker 3"]
  meeting_notes?: string[];      // Key discussion points
  decisions?: string[];          // Decisions made
  action_items?: Array<{ assignee?: string; task: string; due?: string }>;
  follow_up?: string[];          // Next steps

  // Invoice-specific fields (when proposed_template === "invoice")
  invoice_date?: string;         // YYYY-MM-DD
  provider?: string;             // Company name
  amount?: string;               // Numeric string
  currency?: string;             // "AUD", "USD", etc.
  invoice_status?: string;       // "unpaid", "paid", "pending"

  // Booking-specific fields (when proposed_template === "booking")
  booking_type?: string;         // "flight", "hotel", "cinema", "restaurant", "event", "other"
  booking_ref?: string;          // Confirmation/reference number
  booking_date?: string;         // YYYY-MM-DD (event date)
  booking_provider?: string;     // Company name (uses booking_ prefix to avoid collision with invoice provider)
  cost?: string;                 // Numeric string
  booking_currency?: string;     // "AUD", "USD", etc.
  booking_status?: string;       // "confirmed", "pending", "cancelled"
}
```

---

## Field Name Conventions

**CRITICAL:** Use these exact field names in all proposals and TaskUpdate metadata.

| Field | Name | Type | Notes |
|-------|------|------|-------|
| Area | `area` | `string \| string[]` | Single: `"[[Area]]"` or multi: `["[[Area 1]]", "[[Area 2]]"]` |
| Project | `project` | `string \| string[] \| null` | Single: `"[[Project]]"`, multi: `["[[P1]]", "[[P2]]"]`, or `null` |
| Resource type | `resourceType` | `string` | camelCase, NOT `resource_type` |
| Source format | `source_format` | `string` | snake_case (matches frontmatter convention) |

**Multi-value areas/projects:** When content spans multiple domains (e.g., AI + Home Server), use an array. Single values are still preferred when one area is the clear fit.

**Passing to `para_create`:** The `args` parameter only accepts `Record<string, string>`. For arrays, pass as a JSON string: `JSON.stringify(["[[Area 1]]", "[[Area 2]]"])`. The `para_create` handler parses JSON array strings automatically via `tryParseJsonArray()`.

**DO NOT use:** `suggested_areas` (array), `suggested_projects` (array), `resource_type` (snake_case for this field). These are legacy names from analyzer skills.

---

## Confidence Levels

| Level | Meaning | UX Effect |
|-------|---------|-----------|
| `high` | Clear content, obvious categorization | Standard review |
| `medium` | Reasonable guess, user may want to adjust | Standard review |
| `low` | Ambiguous content, multiple valid interpretations | Triggers "Deeper" option (3 alternatives) |

---

## TaskUpdate Metadata

When persisting via TaskUpdate, use this structure:

```typescript
TaskUpdate({
  taskId: "<taskId>",
  status: "in_progress",
  metadata: {
    created: "<file-path>",       // or null if failed
    layer1_injected: true,        // true/false/null
    proposal: {
      proposed_title,
      proposed_template,
      summary,
      area,
      project,
      resourceType,
      categorization_hints,
      source_format,
      confidence,
      notes
    }
  }
})
```

---

## PROPOSAL_JSON Output Format

Subagents return this exact format on a single line:

```
PROPOSAL_JSON:{"taskId":"...","proposed_title":"...","proposed_template":"...","summary":"...","area":"[[...]]","project":null,"resourceType":"...","source_format":"...","confidence":"...","categorization_hints":["...","...","..."],"notes":null,"created":"...","layer1_injected":true,"file":"..."}
```
