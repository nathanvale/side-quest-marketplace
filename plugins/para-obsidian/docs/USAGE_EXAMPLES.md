# Usage Examples

**Comprehensive examples for create-classifier, create-note-template, and bookmark workflow**

---

## Table of Contents

- [Create-Classifier Examples](#create-classifier-examples)
  - [Basic Classifier (Gym Receipt)](#basic-classifier-gym-receipt)
  - [Classifier with Existing Template](#classifier-with-existing-template)
  - [Classifier with Template Suffix](#classifier-with-template-suffix)
  - [End-to-End Inbox Processing](#end-to-end-inbox-processing)
- [Create-Note-Template Examples](#create-note-template-examples)
  - [Minimal Template (Simple Note)](#minimal-template-simple-note)
  - [Rich Project Template](#rich-project-template)
  - [Journal Template (Weekly Review)](#journal-template-weekly-review)
  - [Custom Workflow Template (Meeting Notes)](#custom-workflow-template-meeting-notes)
- [Bookmark Workflow Examples](#bookmark-workflow-examples)
  - [Capturing Bookmarks](#capturing-bookmarks)
  - [Classifying Bookmarks](#classifying-bookmarks)
  - [Organizing by PARA](#organizing-by-para)
  - [Exporting to Browser](#exporting-to-browser)
- [Common Workflows](#common-workflows)
  - [Creating a Classifier for a New Document Type](#creating-a-classifier-for-a-new-document-type)
  - [Setting Up a Custom Project Template](#setting-up-a-custom-project-template)
  - [Migrating from Old Templates](#migrating-from-old-templates)

---

## Create-Classifier Examples

### Basic Classifier (Gym Receipt)

**Scenario:** You want to automatically process gym membership receipts from your inbox.

#### Step-by-Step

**1. Invoke the command:**
```bash
/para-obsidian:create-classifier gym-receipt
```

**2. Wizard questions and answers:**

```
Q1: What type of documents should this classifier detect?
A: Gym membership receipts and fitness center invoices

Q2: What priority should this classifier have? (0-100, higher = checked first)
Context:
- 110+: Very specific (e.g., medical-statement for specific provider)
- 100: Standard documents (e.g., invoice)
- 90: Common types (e.g., booking)
- 80-85: Less common (e.g., research)
Default to 85 if unsure.

A: 95

Q3: Which PARA area does this typically belong to?
Options: Finance, Health, Work, Home, Travel, Personal, or "varies/none"
A: Health

Q4: What words/patterns typically appear in the FILENAME?
A: gym, fitness, membership, receipt, anytime

Q5: What words/phrases typically appear in the CONTENT?
A: membership, gym, fitness center, monthly fee, payment received, direct debit

Q6: What fields should be extracted? List them with types.
Format: fieldName:type:requirement (requirement optional, defaults to 'optional')
Types: string, date, currency, number
Requirements: required, optional, conditional

A:
title:string:required
paymentDate:date:required
gymName:string:required
amount:currency:required
membershipType:string:optional
periodCovered:string:optional

Q7: For each required/key field, provide a brief description for the LLM.
A:
- title: Receipt title or transaction description
- paymentDate: Date payment was processed
- gymName: Name of the gym or fitness center
- amount: Payment amount charged

Q8: What should the template filename be (without .md)?
A: gym-receipt

[System checks: Templates/gym-receipt.md not found]

Q: Would you like to create a template for this classifier?
Options: basic / rich / skip
A: basic

Q9: What are the Templater prompt labels for each field?
Format: fieldName: Prompt Label

A:
title: Receipt title
paymentDate: Payment date (YYYY-MM-DD)
gymName: Gym name
amount: Amount paid
membershipType: Membership type (e.g., monthly, annual)
periodCovered: Period covered (e.g., Jan 2025)

Q10: Do you want custom scoring thresholds? (yes/no)
A: no
```

#### Generated Files

**File 1: `src/inbox/classify/classifiers/definitions/gym-receipt.ts`**

```typescript
/**
 * Gym Receipt Classifier
 *
 * Gym membership receipts and fitness center invoices
 *
 * @module classifiers/definitions/gym-receipt
 */

import type { InboxConverter } from "../types";

/**
 * Gym receipt classifier for fitness center receipts and membership payments
 */
export const gymReceiptClassifier: InboxConverter = {
	schemaVersion: 1,
	id: "gym-receipt",
	displayName: "Gym Receipt",
	enabled: true,
	priority: 95,

	heuristics: {
		filenamePatterns: [
			{ pattern: "gym", weight: 1.0 },
			{ pattern: "fitness", weight: 0.9 },
			{ pattern: "membership", weight: 0.8 },
			{ pattern: "receipt", weight: 0.7 },
			{ pattern: "anytime", weight: 0.6 },
		],
		contentMarkers: [
			{ pattern: "membership", weight: 1.0 },
			{ pattern: "gym", weight: 0.9 },
			{ pattern: "fitness center", weight: 0.8 },
			{ pattern: "monthly fee", weight: 0.7 },
			{ pattern: "payment received", weight: 0.6 },
			{ pattern: "direct debit", weight: 0.5 },
		],
		threshold: 0.3,
	},

	fields: [
		{
			name: "title",
			type: "string",
			description: "Receipt title or transaction description",
			requirement: "required",
		},
		{
			name: "paymentDate",
			type: "date",
			description: "Date payment was processed",
			requirement: "required",
		},
		{
			name: "gymName",
			type: "string",
			description: "Name of the gym or fitness center",
			requirement: "required",
		},
		{
			name: "amount",
			type: "currency",
			description: "Payment amount charged",
			requirement: "required",
		},
		{
			name: "membershipType",
			type: "string",
			description: "Membership type (e.g., monthly, annual)",
			requirement: "optional",
		},
		{
			name: "periodCovered",
			type: "string",
			description: "Period covered (e.g., Jan 2025)",
			requirement: "optional",
		},
	],

	extraction: {
		promptHint: "Extract key details from gym receipt or fitness center invoice",
		keyFields: ["title", "paymentDate", "gymName", "amount"],
	},

	template: {
		name: "gym-receipt",
		fieldMappings: {
			title: "Receipt title",
			paymentDate: "Payment date (YYYY-MM-DD)",
			gymName: "Gym name",
			amount: "Amount paid",
			membershipType: "Membership type (e.g., monthly, annual)",
			periodCovered: "Period covered (e.g., Jan 2025)",
		},
	},

	scoring: {
		heuristicWeight: 0.3,
		llmWeight: 0.7,
		highThreshold: 0.85,
		mediumThreshold: 0.6,
	},
};
```

**File 2: Registry update in `src/inbox/classify/classifiers/definitions/index.ts`**

```typescript
// Added import
import { gymReceiptClassifier } from "./gym-receipt";

// Added export
export { gymReceiptClassifier } from "./gym-receipt";

// Added to DEFAULT_CLASSIFIERS array (maintained priority order)
export const DEFAULT_CLASSIFIERS: readonly InboxConverter[] = [
	medicalStatementClassifier,  // Priority 110
	invoiceClassifier,           // Priority 100
	gymReceiptClassifier,        // Priority 95 <-- NEW
	bookingClassifier,           // Priority 90
	researchClassifier,          // Priority 85
] as const;
```

**File 3: `${PARA_VAULT}/Templates/gym-receipt.md`**

```markdown
---
type: gym-receipt
template_version: 1
created: <% tp.date.now("YYYY-MM-DD") %>
title: "<% tp.system.prompt("Receipt title") %>"
paymentDate: "<% tp.system.prompt("Payment date (YYYY-MM-DD)") %>"
gymName: "<% tp.system.prompt("Gym name") %>"
amount: "<% tp.system.prompt("Amount paid") %>"
membershipType: "<% tp.system.prompt("Membership type (e.g., monthly, annual)") %>"
periodCovered: "<% tp.system.prompt("Period covered (e.g., Jan 2025)") %>"
area: "[[Health]]"
---

# <% tp.system.prompt("Receipt title") %>

## Details

**Payment Date**: <% tp.system.prompt("Payment date (YYYY-MM-DD)") %>
**Gym**: <% tp.system.prompt("Gym name") %>
**Amount**: <% tp.system.prompt("Amount paid") %>
**Membership Type**: <% tp.system.prompt("Membership type (e.g., monthly, annual)") %>
**Period Covered**: <% tp.system.prompt("Period covered (e.g., Jan 2025)") %>

## Notes

<% tp.system.prompt("Additional notes (optional)") %>

---
*Processed from inbox: <% tp.date.now("YYYY-MM-DD HH:mm") %>*
```

#### Verification

```bash
# 1. Type check
cd plugins/para-obsidian && bun typecheck
# ✓ No errors

# 2. Verify registration
bun -e "const { DEFAULT_CLASSIFIERS } = require('./src/inbox/classify/classifiers/definitions'); \
  console.log(DEFAULT_CLASSIFIERS.find(c => c.id === 'gym-receipt'))"
# ✓ Classifier registered

# 3. Verify template exists
ls ${PARA_VAULT}/Templates/gym-receipt.md
# ✓ Template created
```

---

### Classifier with Existing Template

**Scenario:** You want to create a classifier for restaurant receipts, but you already have a `restaurant.md` template in your vault.

#### Workflow

**1. Invoke command:**
```bash
/para-obsidian:create-classifier restaurant-receipt
```

**2. Wizard flow (abbreviated):**

```
Q1-Q7: [Answer basic questions...]

Q8: What should the template filename be (without .md)?
A: restaurant

[System checks: Templates/restaurant.md EXISTS]

Q: Template "restaurant.md" already exists. What would you like to do?
Options:
- use-existing - Keep existing template, only create classifier
- create-new - Create new template with suffix (e.g., restaurant-v2.md)
- skip - Don't create template, only generate classifier

A: use-existing
```

#### Result

**Classifier created:**
- `definitions/restaurant-receipt.ts` generated
- Registry updated
- `template.name` set to `"restaurant"` (matches existing template)

**Template unchanged:**
- `Templates/restaurant.md` left intact
- Classifier will use existing template

**Use case:** Reuse a carefully crafted template you've already customized.

---

### Classifier with Template Suffix

**Scenario:** You have an existing `booking.md` template, but want a specialized version for hotel bookings.

#### Workflow

```
/para-obsidian:create-classifier hotel-booking

Q8: Template filename?
A: booking

[System: Templates/booking.md EXISTS]

Q: Template "booking.md" already exists. What would you like to do?
A: create-new

Q: Enter suffix for new template (e.g., "v2", "hotel"):
A: hotel

[System creates: Templates/booking-hotel.md]
[Classifier template.name set to: "booking-hotel"]
```

#### Result

**Two templates coexist:**
- `Templates/booking.md` (original, used by general booking classifier)
- `Templates/booking-hotel.md` (new, used by hotel-booking classifier)

**Classifier mapping:**
```typescript
template: {
  name: "booking-hotel",  // <-- Points to suffixed template
  fieldMappings: { /* ... */ }
}
```

---

### End-to-End Inbox Processing

**Scenario:** Complete workflow from creating a classifier to processing a document.

#### Step 1: Create Classifier

```bash
/para-obsidian:create-classifier utility-bill
```

**Wizard answers (abbreviated):**
- Type: Electricity, gas, water bills
- Priority: 95
- Area: Finance
- Filename patterns: utility, bill, electricity, gas, water, energy
- Content markers: account number, billing period, amount due, kWh
- Fields: title, billDate, provider, amount, dueDate, accountNumber, usageAmount

**Result:** Classifier registered, template created.

#### Step 2: Add Document to Inbox

```bash
# User receives electricity bill via email
cp ~/Downloads/Energy-Australia-Bill-Dec-2024.pdf ${PARA_VAULT}/Inbox/
```

#### Step 3: Scan Inbox

```bash
bun run src/cli.ts process-inbox scan
```

**Output:**
```
Scanning inbox...
Found 1 new file

┌─────┬──────────────┬────────────────┬────────────┬─────────────────┐
│ ID  │ Source       │ Type           │ Confidence │ Suggested Title │
├─────┼──────────────┼────────────────┼────────────┼─────────────────┤
│ 1   │ Energy-Au... │ utility-bill   │ high (0.92)│ Electricity ... │
└─────┴──────────────┴────────────────┴────────────┴─────────────────┘

Classifier: utility-bill
Heuristic matches:
  - Filename: "energy" (0.8), "bill" (0.9)
  - Content: "account number" (1.0), "kWh" (0.8)

Extracted fields (LLM):
  - title: "Electricity Bill - December 2024"
  - billDate: 2024-12-15
  - provider: Energy Australia
  - amount: $285.45
  - dueDate: 2025-01-05
  - accountNumber: 123456789
  - usageAmount: 450 kWh

Commands: 1 (approve), a (approve all), s1 (skip), e1 prompt (edit), q (quit)
> a
```

#### Step 4: Execute Suggestions

```bash
> execute
```

**Output:**
```
Executing 1 suggestion...

✓ Created note: Finance/Bills/Electricity Bill - December 2024.md
✓ Moved attachment: Attachments/Energy-Australia-Bill-Dec-2024.pdf
✓ Committed changes to vault

Summary:
- 1 note created
- 1 attachment moved
- 0 failed
```

#### Step 5: Review Created Note

**File:** `${PARA_VAULT}/Finance/Bills/Electricity Bill - December 2024.md`

```markdown
---
type: utility-bill
template_version: 1
created: 2024-12-16
title: "Electricity Bill - December 2024"
billDate: "2024-12-15"
provider: "Energy Australia"
amount: "285.45"
dueDate: "2025-01-05"
accountNumber: "123456789"
usageAmount: "450 kWh"
area: "[[Finance]]"
---

# Electricity Bill - December 2024

## Details

**Bill Date**: 2024-12-15
**Provider**: Energy Australia
**Amount Due**: $285.45
**Due Date**: 2025-01-05
**Account**: 123456789
**Usage**: 450 kWh

## Attachments

![[Energy-Australia-Bill-Dec-2024.pdf]]

## Notes

[User can add notes here]

---
*Processed from inbox: 2024-12-16 11:30*
```

---

## Create-Note-Template Examples

### Minimal Template (Simple Note)

**Scenario:** You want a simple note template for quick captures.

#### Invocation

```bash
/para-obsidian:create-note-template quick-note
```

#### Wizard Flow

```
Template name (kebab-case): quick-note
Display name: Quick Note
Note type (frontmatter type field): note
Template version: 1

--- Frontmatter Fields ---

Field 1:
  Field name: title
  Display name: Title
  Type: string
  Required: yes

Field 2:
  Field name: created
  Display name: Created
  Type: date
  Required: yes
  Auto-fill: tp.date.now("YYYY-MM-DD")

Add another field? (y/n): n

--- Body Sections ---

Section 1:
  Heading: Notes
  Has prompt: yes
  Prompt text: Content

Add another section? (y/n): n
```

#### Generated Template

**File:** `${PARA_VAULT}/Templates/quick-note.md`

```markdown
---
type: note
template_version: 1
title: "<% tp.system.prompt("Title") %>"
created: <% tp.date.now("YYYY-MM-DD") %>
---

# <% tp.system.prompt("Title") %>

## Notes

<% tp.system.prompt("Content") %>
```

#### Usage

```bash
# Via CLI
bun run src/cli.ts create --template quick-note "Shopping List"

# Via MCP
await para_create({
  path: "Notes/Shopping List.md",
  template: "quick-note"
});
```

**Result:** New note created with title prompt, auto-filled date, and content prompt.

---

### Rich Project Template

**Scenario:** You want a comprehensive project template with all PARA fields.

#### Wizard Flow (Key Parts)

```
Template name: project
Display name: Project
Note type: project
Version: 2

--- Fields ---
1. title (string, required)
2. created (date, required, auto: tp.date.now("YYYY-MM-DD"))
3. status (enum, required, values: planning|active|on-hold|completed|cancelled, default: planning)
4. area (wikilink, required)
5. dueDate (date, optional)
6. completedDate (date, optional)
7. tags (array, optional)
8. priority (enum, optional, values: low|medium|high|urgent)

--- Sections ---
1. Why This Matters (prompt: "What is the desired outcome?")
2. Success Criteria (prompt: "How will you know it's done?")
3. Context & Background (prompt: "What's the background?")
4. Resources & References (no prompt)
5. Next Actions (no prompt)
6. Notes (no prompt)
```

#### Generated Template

**File:** `${PARA_VAULT}/Templates/project.md`

```markdown
---
type: project
template_version: 2
title: "<% tp.system.prompt("Project Title") %>"
created: <% tp.date.now("YYYY-MM-DD") %>
status: "<% tp.system.prompt("Status", "planning") %>"
area: "[[<% tp.system.prompt("Area") %>]]"
dueDate: "<% tp.system.prompt("Target Completion (YYYY-MM-DD)") %>"
completedDate: ""
tags: []
priority: "<% tp.system.prompt("Priority (low/medium/high/urgent)") %>"
---

# <% tp.system.prompt("Project Title") %>

## Why This Matters

<% tp.system.prompt("What is the desired outcome?") %>

## Success Criteria

<% tp.system.prompt("How will you know it's done?") %>

## Context & Background

<% tp.system.prompt("What's the background?") %>

## Resources & References

-

## Next Actions

- [ ]

## Notes


---
*Created: <% tp.date.now("YYYY-MM-DD HH:mm") %>*
```

#### Features

- **Enum fields**: Status and priority with predefined values
- **Wikilink fields**: Area with proper YAML quoting
- **Auto-fill**: Created date automatically populated
- **Prompts**: Interactive for key fields, static sections for structured content
- **Versioning**: Template version 2 for migration support

---

### Journal Template (Weekly Review)

**Scenario:** You want a weekly review template for reflective journaling.

#### Wizard Configuration

```
Template: weekly-review
Type: journal
Version: 1

Fields:
- title (string, required)
- weekOf (date, required, auto: tp.date.now("YYYY-MM-DD"))
- mood (enum, optional, values: excellent|good|okay|struggling)

Sections:
1. Wins This Week (prompt: "What went well?")
2. Challenges (prompt: "What was difficult?")
3. Lessons Learned (prompt: "What did you learn?")
4. Next Week's Focus (prompt: "What are your top 3 priorities?")
5. Gratitude (prompt: "What are you grateful for?")
```

#### Generated Template

```markdown
---
type: journal
template_version: 1
title: "<% tp.system.prompt("Week Title") %>"
weekOf: <% tp.date.now("YYYY-MM-DD") %>
mood: "<% tp.system.prompt("Overall mood (excellent/good/okay/struggling)") %>"
---

# Weekly Review - Week of <% tp.date.now("YYYY-MM-DD") %>

## Wins This Week

<% tp.system.prompt("What went well?") %>

## Challenges

<% tp.system.prompt("What was difficult?") %>

## Lessons Learned

<% tp.system.prompt("What did you learn?") %>

## Next Week's Focus

<% tp.system.prompt("What are your top 3 priorities?") %>

## Gratitude

<% tp.system.prompt("What are you grateful for?") %>

---
*Reviewed: <% tp.date.now("YYYY-MM-DD HH:mm") %>*
```

#### Usage Pattern

**Create weekly review every Sunday:**

```bash
# Create this week's review
bun run src/cli.ts create --template weekly-review "Week of $(date +%Y-%m-%d)"

# In Obsidian, Templater prompts appear:
# - Week Title: [auto-filled]
# - Overall mood: [excellent/good/okay/struggling]
# - What went well? [your answer]
# - What was difficult? [your answer]
# ...
```

---

### Custom Workflow Template (Meeting Notes)

**Scenario:** You want a template for client meeting notes with actionable follow-ups.

#### Wizard Configuration

```
Template: client-meeting
Type: meeting
Version: 1

Fields:
- title (string, required)
- meetingDate (date, required)
- client (wikilink, required)
- attendees (array, optional)
- duration (string, optional)
- nextMeetingDate (date, optional)

Sections:
1. Agenda (prompt: "What topics were discussed?")
2. Key Points (no prompt)
3. Decisions Made (prompt: "What was decided?")
4. Action Items (no prompt)
5. Follow-up Questions (prompt: "What needs clarification?")
```

#### Generated Template

```markdown
---
type: meeting
template_version: 1
title: "<% tp.system.prompt("Meeting Title") %>"
meetingDate: "<% tp.system.prompt("Meeting Date (YYYY-MM-DD)") %>"
client: "[[<% tp.system.prompt("Client Name") %>]]"
attendees: []
duration: "<% tp.system.prompt("Duration (e.g., 1 hour)") %>"
nextMeetingDate: "<% tp.system.prompt("Next Meeting Date (YYYY-MM-DD)") %>"
---

# <% tp.system.prompt("Meeting Title") %>

**Date**: <% tp.system.prompt("Meeting Date (YYYY-MM-DD)") %>
**Client**: [[<% tp.system.prompt("Client Name") %>]]
**Duration**: <% tp.system.prompt("Duration (e.g., 1 hour)") %>

## Agenda

<% tp.system.prompt("What topics were discussed?") %>

## Key Points

-
-
-

## Decisions Made

<% tp.system.prompt("What was decided?") %>

## Action Items

- [ ]
- [ ]
- [ ]

## Follow-up Questions

<% tp.system.prompt("What needs clarification?") %>

---
**Next Meeting**: <% tp.system.prompt("Next Meeting Date (YYYY-MM-DD)") %>
```

#### Practical Usage

**Before meeting:**
```bash
bun run src/cli.ts create --template client-meeting "Q4 Planning - Acme Corp"
```

**During meeting:**
- Fill in key points as they arise
- Check off decisions
- Add action items with assignees

**After meeting:**
- Review action items
- Link to related project notes
- Set reminders for follow-ups

---

## Bookmark Workflow Examples

### Capturing Bookmarks

**Scenario:** You want to save web pages to your Obsidian vault for later reference and PARA classification.

#### iOS Safari Capture

**Step 1: Browse to interesting webpage**

Example: You're reading the Kit CLI documentation at https://kit.cased.com

**Step 2: Use Web Clipper**

1. Tap Share icon in Safari
2. Select "Obsidian Web Clipper"
3. Configure capture:
   - Title: "Kit CLI Documentation" (auto-filled)
   - Vault: Your vault name
   - Folder: `Inbox`
   - Template: `bookmark` (if configured)
4. Tap "Add to Obsidian"

**Result: `Inbox/Kit CLI Documentation.md`**

```markdown
---
type: bookmark
url: https://kit.cased.com
title: Kit CLI Documentation
clipped: 2024-12-16
category: "[[Documentation]]"
tags: [cli, code-search]
---

## Notes

Fast semantic search for codebases using ML embeddings.

## Highlights

- "30-50x faster than grep for symbol lookup"
```

#### Desktop Browser Capture

**Chrome/Firefox/Edge:**

1. Navigate to webpage
2. Click Obsidian Web Clipper extension icon
3. Template auto-selects
4. Click "Clip to Obsidian"
5. Bookmark saved to `Inbox/`

**Safari:**

1. Click Share button
2. Select "Obsidian Web Clipper"
3. Configure vault/folder
4. Click "Save"
5. Bookmark saved to `Inbox/`

---

### Classifying Bookmarks

**Scenario:** You have 5 bookmarks in your Inbox and want to organize them by PARA category.

#### Setup Bookmark Classifier

**Create the classifier (one-time setup):**

```bash
/para-obsidian:create-classifier bookmark
```

**Wizard answers:**

```
Q1: What type of documents should this classifier detect?
A: Web bookmarks captured via Obsidian Web Clipper

Q2: Priority? (0-100)
A: 70

Q3: PARA area?
A: varies

Q4: Filename patterns?
A: [skip]

Q5: Content patterns?
A: type: bookmark, url: http, clipped:

Q6: Fields to extract?
A:
title:string:required
url:string:required
clipped:date:required
para:string:required
category:wikilink:optional
tags:array:optional

Q7: Field descriptions?
A:
- title: Bookmark title or page title
- url: Original webpage URL
- clipped: Date captured
- para: PARA classification (Projects/Areas/Resources/Archives)

Q8: Template name?
A: bookmark

Q9: Create template?
A: basic
```

#### Run Classification

**Scan inbox for bookmarks:**

```bash
bun run src/cli.ts process-inbox scan
```

**Output:**

```
Scanning inbox...
Found 5 new files

┌─────┬──────────────────────┬──────────┬────────────┬─────────────────┐
│ ID  │ Source               │ Type     │ Confidence │ Suggested Title │
├─────┼──────────────────────┼──────────┼────────────┼─────────────────┤
│ 1   │ Kit CLI Docs.md      │ bookmark │ high (0.95)│ Kit CLI Docs    │
│ 2   │ GitHub PR.md         │ bookmark │ high (0.92)│ Fix auth bug    │
│ 3   │ NetBank.md           │ bookmark │ med (0.78) │ Banking Portal  │
│ 4   │ TypeScript Docs.md   │ bookmark │ high (0.90)│ TS Handbook     │
│ 5   │ Old API.md           │ bookmark │ low (0.65) │ Deprecated API  │
└─────┴──────────────────────┴──────────┴────────────┴─────────────────┘

Classifier: bookmark
Extracted fields (LLM + heuristics):

1. Kit CLI Documentation
   - para: Resources (documentation)
   - reasoning: URL contains /docs/, technical reference

2. GitHub PR #1234
   - para: Projects (active work)
   - reasoning: Recent PR, active development

3. NetBank Login
   - para: Areas (ongoing)
   - reasoning: Banking portal, account management

4. TypeScript Handbook
   - para: Resources (reference)
   - reasoning: Official documentation

5. Old API Docs
   - para: Archives (stale)
   - reasoning: Clipped 200 days ago, deprecated tag
```

#### Review and Execute

**Interactive review:**

```bash
# Review suggestions
> a  # Approve #1
> a  # Approve #2
> e  # Edit #3

Enter new PARA category: Areas
Reason: Banking is ongoing responsibility
Updated: para: Areas

> a  # Approve (with edit)
> a  # Approve #4
> s  # Skip #5 (will delete manually)

# Execute approved suggestions
bun run src/cli.ts process-inbox execute
```

**Result:**

```
Executing 4 suggestions...

✓ Created: Resources/Web/Kit CLI Documentation.md
✓ Created: Projects/Web/GitHub PR #1234.md
✓ Created: Areas/Web/NetBank Login.md
✓ Created: Resources/Web/TypeScript Handbook.md

Summary:
- 4 notes created
- 0 failed
- 1 skipped
```

---

### Organizing by PARA

**Scenario:** Understanding PARA categories and how bookmarks are classified.

#### PARA Categories Explained

**ASCII diagram:**

```
Projects              Areas              Resources           Archives
(Time-bound)          (Ongoing)          (Reference)         (Stale)
┌──────────┐         ┌──────────┐       ┌──────────┐        ┌──────────┐
│ Active   │         │ Banking  │       │ Docs     │        │ Old API  │
│ GitHub   │         │ Health   │       │ Tutorials│        │ Deprecated│
│ PRs      │         │ Home     │       │ Guides   │        │ >6 months│
│          │         │ portals  │       │ Learning │        │          │
└──────────┘         └──────────┘       └──────────┘        └──────────┘
  < 3 months           Permanent          Someday             Inactive
```

#### Classification Examples

**Projects:**
- `https://github.com/user/repo/pull/123` → Active PR for current project
- `https://jira.company.com/sprint/42` → Sprint board for active sprint
- `https://docs.google.com/document/project-plan` → Project planning doc

**Why:** Time-bound, will be completed within 3 months.

**Areas:**
- `https://mybank.com/netbank` → Banking portal (ongoing account management)
- `https://strava.com/dashboard` → Fitness tracking (ongoing health area)
- `https://homeassistant.io/dashboard` → Home automation (ongoing home area)

**Why:** Ongoing responsibilities with no end date.

**Resources:**
- `https://kit.cased.com/docs` → CLI documentation (reference material)
- `https://developer.mozilla.org/javascript` → MDN guides (learning resource)
- `https://stackoverflow.com/questions/12345` → Solution to common problem

**Why:** Reference material you might need someday, not tied to current work.

**Archives:**
- Old API documentation for deprecated service (clipped 8 months ago)
- Completed project resources no longer needed
- Outdated tutorials or guides

**Why:** No longer active or relevant, but kept for historical reference.

#### Folder Structure After Classification

```
vault/
├── Inbox/                      # Empty after processing
├── Projects/
│   └── Web/
│       ├── GitHub PR #1234.md
│       └── Sprint Board.md
├── Areas/
│   └── Web/
│       ├── NetBank Login.md
│       ├── Strava Dashboard.md
│       └── HomeAssistant.md
├── Resources/
│   └── Web/                    # Most bookmarks end up here
│       ├── Kit CLI Documentation.md
│       ├── MDN JavaScript Guide.md
│       ├── TypeScript Handbook.md
│       └── Stack Overflow Solutions/
│           └── React Hook Debug.md
└── Archives/
    └── Web/
        └── Old API Docs.md
```

#### Reclassification

**Scenario:** You moved a bookmark to Resources, but it should be Projects.

**Manual move:**

```bash
# Edit frontmatter
# Change: para: Resources
# To: para: Projects

# Move file
mv "Resources/Web/Kit CLI Docs.md" "Projects/Web/Kit CLI Docs.md"
```

**Reprocess through inbox:**

```bash
# Move back to inbox
mv "Resources/Web/Kit CLI Docs.md" "Inbox/"

# Remove from registry
# Edit .para/processed-registry.json, delete entry for this file

# Reprocess
bun run src/cli.ts process-inbox scan
# Review new suggestion
# Execute
```

---

### Exporting to Browser

**Scenario:** You want to sync your PARA-organized bookmarks to Safari/Chrome for mobile access.

#### Generate Browser HTML

```bash
cd /Users/nathanvale/code/side-quest-marketplace/plugins/para-obsidian
bun run src/cli.ts export-bookmarks \
  --filter "type:bookmark" \
  --out ~/Downloads/bookmarks-para.html
```

**Output:**

```
Exporting bookmarks...
Found 42 bookmarks:
- Projects: 5
- Areas: 8
- Resources: 25
- Archives: 4

Generated: ~/Downloads/bookmarks-para.html
Format: Netscape HTML (Safari/Chrome compatible)
```

#### HTML Structure

**Example: `bookmarks-para.html`**

```html
<!DOCTYPE NETSCAPE-Bookmark-file-1>
<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">
<TITLE>Bookmarks</TITLE>
<H1>Bookmarks</H1>
<DL><p>
    <DT><H3 FOLDED>Projects</H3>
    <DL><p>
        <DT><A HREF="https://github.com/user/repo/pull/1234">GitHub PR #1234</A>
        <DT><A HREF="https://jira.company.com/sprint/42">Sprint Board</A>
    </DL><p>
    <DT><H3 FOLDED>Areas</H3>
    <DL><p>
        <DT><A HREF="https://mybank.com/netbank">NetBank Login</A>
        <DT><A HREF="https://strava.com/dashboard">Strava Dashboard</A>
    </DL><p>
    <DT><H3 FOLDED>Resources</H3>
    <DL><p>
        <DT><A HREF="https://kit.cased.com">Kit CLI Documentation</A>
        <DT><A HREF="https://developer.mozilla.org">MDN Web Docs</A>
        <DT><A HREF="https://www.typescriptlang.org/docs">TypeScript Handbook</A>
    </DL><p>
</DL>
```

#### Import to Browser

**Safari:**

1. Safari → File → Import From → Bookmarks HTML File
2. Select `~/Downloads/bookmarks-para.html`
3. Bookmarks appear in Favorites Bar with PARA folders
4. iCloud syncs to iPhone/iPad

**Chrome:**

1. Bookmarks Manager (Cmd+Shift+O)
2. Three dots menu → Import bookmarks
3. Select `~/Downloads/bookmarks-para.html`
4. PARA folders appear in Bookmarks Bar
5. Chrome Sync syncs to other devices

**Firefox/Edge:**

Similar import process through Bookmarks Manager.

#### Sync Workflow

**Monthly sync routine:**

```bash
# 1. Export vault bookmarks
bun run src/cli.ts export-bookmarks \
  --filter "type:bookmark" \
  --out ~/Downloads/bookmarks-para.html

# 2. Import to Safari
# Safari → File → Import From → Bookmarks HTML

# 3. Sync propagates to mobile devices via iCloud
```

**Note:** This is one-way sync (vault → browser). Browser bookmarks don't automatically sync back to vault.

**Alternative: Two-way sync**

If you bookmark in browser frequently:

1. **Weekly:** Export browser bookmarks to HTML
2. **Import to vault:** Use `import-bookmarks` command (TODO: implement)
3. **Process inbox:** Classify new bookmarks via normal workflow
4. **Export back to browser:** Keep browser in sync with PARA structure

---

## Common Workflows

### Creating a Classifier for a New Document Type

**When:** You regularly receive a specific document type in your inbox.

**Process:**

1. **Collect examples** - Save 2-3 sample documents to analyze patterns
2. **Identify patterns**:
   - What keywords appear in filenames? (e.g., "invoice", "statement")
   - What phrases appear in content? (e.g., "Amount Due", "Account Number")
   - What data needs extracting? (e.g., date, amount, provider)
3. **Create classifier**:
   ```bash
   /para-obsidian:create-classifier your-type
   ```
4. **Test with real document**:
   - Place sample in inbox
   - Run `process-inbox scan`
   - Check confidence score and extracted fields
5. **Iterate**:
   - If confidence low: Add more heuristic patterns
   - If wrong fields: Adjust field descriptions
   - If wrong area: Update template default

**Example iteration:**

```typescript
// v1: Low confidence (0.45)
heuristics: {
  filenamePatterns: [
    { pattern: "statement", weight: 1.0 }  // Too generic
  ]
}

// v2: Better confidence (0.78)
heuristics: {
  filenamePatterns: [
    { pattern: "medical statement", weight: 1.0 },  // More specific
    { pattern: "healthengine", weight: 0.9 },       // Provider name
    { pattern: "appointment", weight: 0.7 }
  ]
}
```

---

### Setting Up a Custom Project Template

**When:** You have a specific project methodology (e.g., Agile, GTD, OKRs).

**Example: OKR Project Template**

**1. Plan structure:**
```
Fields:
- title: Project name
- objective: High-level goal (wikilink to OKR note)
- keyResults: Array of measurable outcomes
- owner: Person responsible
- quarter: Time period (enum: Q1/Q2/Q3/Q4)
- status: Current state (enum)

Sections:
- Objective (what we want to achieve)
- Key Results (how we measure success)
- Initiatives (what we'll do)
- Progress Updates (weekly check-ins)
```

**2. Create template:**
```bash
/para-obsidian:create-note-template okr-project
```

**3. Answer wizard:**
```
Type: project
Version: 1

Fields:
1. title (string, required)
2. objective (wikilink, required)
3. keyResults (array, required)
4. owner (string, required)
5. quarter (enum: Q1|Q2|Q3|Q4, required)
6. status (enum: planning|active|at-risk|completed, required, default: planning)
7. startDate (date, required)
8. targetDate (date, required)

Sections:
1. Objective (prompt: "What is the high-level goal?")
2. Key Results (no prompt, use array field)
3. Initiatives (prompt: "What projects/tasks support this?")
4. Progress Updates (no prompt)
5. Retrospective (no prompt)
```

**4. Use template:**
```bash
bun run src/cli.ts create --template okr-project "Q1 2025 - Increase Revenue"
```

**Result:** Standardized OKR structure across all projects.

---

### Migrating from Old Templates

**Scenario:** You have 20 existing templates using inconsistent frontmatter. You want to standardize.

#### Migration Strategy

**1. Audit existing templates:**
```bash
# List all templates
ls ${PARA_VAULT}/Templates/

# Check frontmatter patterns
for f in ${PARA_VAULT}/Templates/*.md; do
  echo "=== $f ==="
  head -20 "$f" | grep -A 15 "^---"
done
```

**2. Identify common patterns:**
```
Old pattern (inconsistent):
- Some use "date:", others "created:"
- Some use "type:", others "category:"
- Some have template_version, others don't

Target pattern (standardized):
- Always use "created:" for date
- Always use "type:" for note type
- Always include "template_version: 1"
```

**3. Create new standardized templates:**

```bash
# For each old template type, create new version
/para-obsidian:create-note-template project-v2
/para-obsidian:create-note-template area-v2
/para-obsidian:create-note-template resource-v2
```

**4. Migrate existing notes (manual or scripted):**

**Manual migration:**
- Update frontmatter field names
- Add missing `template_version: 1`
- Validate with `/para-obsidian:validate-frontmatter`

**Scripted migration (example):**

```typescript
// migrate-frontmatter.ts
import { readFileSync, writeFileSync } from 'fs';
import { parse, stringify } from 'yaml';

const files = glob('Projects/**/*.md');

for (const file of files) {
  const content = readFileSync(file, 'utf-8');
  const { frontmatter, body } = parseFrontmatter(content);

  // Rename fields
  const migrated = {
    ...frontmatter,
    created: frontmatter.date || frontmatter.created,
    type: frontmatter.category || frontmatter.type,
    template_version: 1
  };

  // Remove old fields
  delete migrated.date;
  delete migrated.category;

  // Write back
  const updated = `---\n${stringify(migrated)}---\n\n${body}`;
  writeFileSync(file, updated);
}
```

**5. Update classifiers to use new templates:**

```typescript
// definitions/my-classifier.ts
export const myClassifier: InboxConverter = {
  // ...
  template: {
    name: "project-v2",  // Changed from "project"
    fieldMappings: {
      // Updated to match new field names
      created: "Created date (YYYY-MM-DD)",  // Was "date"
      type: "Note type",  // Was "category"
    }
  }
};
```

**6. Deprecate old templates:**

```bash
# Move old templates to archive
mkdir ${PARA_VAULT}/Templates/Archive
mv ${PARA_VAULT}/Templates/project.md ${PARA_VAULT}/Templates/Archive/
mv ${PARA_VAULT}/Templates/area.md ${PARA_VAULT}/Templates/Archive/
```

**7. Document migration:**

Create `Templates/MIGRATION.md`:

```markdown
# Template Migration - December 2024

## Changes

- Standardized frontmatter field names
- Added template_version to all templates
- Updated project/area/resource templates

## Field Mapping

| Old Field | New Field |
|-----------|-----------|
| date      | created   |
| category  | type      |
| tags      | tags (array format) |

## Template Versions

- project-v2: Replaced old "project" template
- area-v2: Replaced old "area" template

## Old Templates

Archived in Templates/Archive/ for reference.
```

---

## Troubleshooting Tips

### Classifier Not Detecting Documents

**Symptom:** Document in inbox but classifier shows low confidence or doesn't match.

**Solutions:**

1. **Check heuristic patterns:**
   ```bash
   # View actual filename
   ls ${PARA_VAULT}/Inbox/

   # Check if patterns match
   echo "Receipt-Gym-Dec2024.pdf" | grep -i "gym"  # Should match
   ```

2. **Lower heuristic threshold:**
   ```typescript
   heuristics: {
     // ...
     threshold: 0.2,  // Lower from 0.3 if too strict
   }
   ```

3. **Add more patterns:**
   ```typescript
   filenamePatterns: [
     { pattern: "gym", weight: 1.0 },
     { pattern: "receipt", weight: 0.9 },
     { pattern: "anytime", weight: 0.8 },  // Add specific gym names
     { pattern: "fitness first", weight: 0.8 },
   ]
   ```

### Template Prompts Not Appearing

**Symptom:** Template loads but Templater doesn't prompt for values.

**Checklist:**

1. **Templater plugin enabled:** Settings → Community Plugins → Templater (toggle on)
2. **Template folder configured:** Templater Settings → Template folder location → `Templates`
3. **Trigger mode:** Templater Settings → Trigger Templater on new file creation (enabled)
4. **Syntax check:**
   ```markdown
   <!-- ✓ Correct -->
   <% tp.system.prompt("Label") %>

   <!-- ✗ Wrong -->
   {{ tp.system.prompt("Label") }}  <!-- Jinja syntax, not Templater -->
   <%= tp.system.prompt("Label") %> <!-- EJS syntax, not Templater -->
   ```

### Extracted Fields Are Wrong

**Symptom:** LLM extracts incorrect data from documents.

**Solutions:**

1. **Improve field descriptions:**
   ```typescript
   // ✗ Vague
   { name: "amount", type: "currency", description: "Amount" }

   // ✓ Specific
   { name: "amount", type: "currency", description: "Total amount charged (excluding tax)" }
   ```

2. **Add extraction hints:**
   ```typescript
   extraction: {
     promptHint: "This is a gym receipt. Extract the membership fee paid, NOT the account balance.",
     keyFields: ["amount", "paymentDate"]
   }
   ```

3. **Use heuristics for common fields:**
   ```typescript
   // For dates, add content markers
   contentMarkers: [
     { pattern: "payment date", weight: 1.0 },
     { pattern: "date paid", weight: 0.9 },
   ]
   ```

---

## Best Practices Summary

### For Classifiers

1. **Start specific, broaden gradually** - High priority for specific types, lower for generic
2. **Test with real documents** - Use actual inbox files, not synthetic examples
3. **Iterate heuristics** - Add patterns based on false negatives
4. **Keep field descriptions clear** - Help the LLM understand context
5. **Version your schemas** - Add migrations when changing field structure

### For Templates

1. **Always include template_version** - Enables future migrations
2. **Use auto-fill for dates** - `tp.date.now()` for created/updated fields
3. **Quote wikilinks in YAML** - `area: "[[Health]]"` not `area: [[Health]]`
4. **Enum for state fields** - Status, priority, etc. benefit from predefined values
5. **Static sections for structure** - Not everything needs a prompt

### For Workflows

1. **Document your patterns** - Keep notes on what works
2. **Regular reviews** - Check classifier performance monthly
3. **Archive old templates** - Don't delete, move to Archive/
4. **Test before committing** - Validate templates with `process-inbox scan --dry-run`
5. **Version control templates** - Commit template changes to git

---

## Additional Resources

- **Classifier guide:** `commands/create-classifier.md`
- **Template guide:** `commands/create-note-template.md`
- **Inbox processing:** `src/inbox/CLAUDE.md`
- **Templater docs:** https://silentvoid13.github.io/Templater/
- **PARA method:** https://fortelabs.com/blog/para/
