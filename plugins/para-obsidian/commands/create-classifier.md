---
description: Create a new inbox document classifier with guided wizard
argument-hint: [classifier-name]
model: claude-sonnet-4-5-20250929
allowed-tools: Bash, Write, Edit, Read, Glob, AskUserQuestion
---

# Create Inbox Classifier

Generate a complete inbox document classifier following the para-obsidian patterns.

## Overview

Inbox classifiers detect, extract, and convert documents from the inbox folder into structured notes. This command guides you through creating:

1. **Classifier definition** (`definitions/{id}.ts`) - Detection patterns, field extraction, template mapping
2. **Registry export** - Add to `DEFAULT_CLASSIFIERS` array
3. **Obsidian template** - Matching vault template (instructions only)
4. **Test coverage** - Optional classifier tests

## Instructions

You are a classifier scaffolding specialist. Create well-structured inbox classifiers using established patterns.

### Input

The classifier name/id is provided as `$1` (or `$ARGUMENTS`).

### Validation

1. **Classifier ID** must be in kebab-case format:
   - Lowercase letters, numbers, and hyphens only
   - Must start with a letter
   - Examples: `receipt`, `medical-statement`, `travel-booking`, `tax-return`

2. **Check for conflicts**:
   - Verify `definitions/{id}.ts` doesn't already exist
   - Check `DEFAULT_CLASSIFIERS` in `definitions/index.ts` for duplicates

### Step 1: Gather Basic Information

Use `AskUserQuestion` to collect:

**Question 1**: "What type of documents should this classifier detect?"
> Example answers: "Tax returns from the ATO", "Restaurant receipts", "Medical appointment confirmations"

**Question 2**: "What priority should this classifier have? (0-100, higher = checked first)"
> Provide context:
> - `110+`: Very specific (e.g., medical-statement for specific provider)
> - `100`: Standard documents (e.g., invoice)
> - `90`: Common types (e.g., booking)
> - `80-85`: Less common (e.g., research)
> Default to `85` if unsure.

**Question 3**: "Which PARA area does this typically belong to?"
> Provide options: Finance, Health, Work, Home, Travel, Personal, or "varies/none"

### Step 2: Define Heuristic Patterns

Use `AskUserQuestion` to collect pattern information:

**Question 4**: "What words/patterns typically appear in the FILENAME?"
> Example: "tax, return, ato, myGov" (comma-separated)
> These become `filenamePatterns` with weights (first = 1.0, subsequent = 0.8, 0.7, etc.)

**Question 5**: "What words/phrases typically appear in the CONTENT?"
> Example: "Tax file number, TFN, assessment notice, Notice of Assessment" (comma-separated)
> These become `contentMarkers` with weights

### Step 3: Define Extraction Fields

Use `AskUserQuestion` to define fields:

**Question 6**: "What fields should be extracted? List them with types."

Provide format guidance:
```
Format: fieldName:type:requirement (requirement optional, defaults to 'optional')
Types: string, date, currency, number
Requirements: required, optional, conditional

Examples:
- title:string:required
- assessmentDate:date:required
- taxableIncome:currency:optional
- financialYear:string:required
- refundAmount:currency:conditional
```

**Question 7**: "For each required/key field, provide a brief description for the LLM."

### Step 4: Template Mapping

Use `AskUserQuestion` for template details:

**Question 8**: "What should the template filename be (without .md)?"
> Default to the classifier ID. Example: `tax-return`

#### Template Detection & Choice Flow

After getting the template name, **check if the template already exists** in `${PARA_VAULT}/Templates/`:

**If template exists:**

Ask user: "Template `{name}.md` already exists. What would you like to do?"

Options:
- **use-existing** - Keep existing template, only create classifier
- **create-new** - Create new template with suffix (e.g., `tax-return-v2.md`)
- **skip** - Don't create template, only generate classifier

**If template doesn't exist:**

Ask user: "Would you like to create a template for this classifier?"

Options:
- **basic** - Quick scaffold with frontmatter fields and prompts
- **rich** - Use template-assistant skill for enhanced template
- **skip** - Create classifier only, template later

**Question 9**: "What are the Templater prompt labels for each field?"
> Format: `fieldName: Prompt Label`
> Example:
> ```
> title: Document title
> assessmentDate: Assessment date (YYYY-MM-DD)
> taxableIncome: Taxable income amount
> ```

---

### Template Creation Modes

#### Basic Mode

Generates a functional template with:
- YAML frontmatter with all classifier fields
- Interactive Templater prompts for each field
- Standard sections (Details, Notes)
- Minimal but complete

**Example basic template:**

```markdown
---
type: tax-return
template_version: 1
created: <% tp.date.now("YYYY-MM-DD") %>
title: "<% tp.system.prompt("Document title") %>"
assessmentDate: "<% tp.system.prompt("Assessment date (YYYY-MM-DD)") %>"
financialYear: "<% tp.system.prompt("Financial year") %>"
taxableIncome: "<% tp.system.prompt("Taxable income amount") %>"
area: "[[Finance]]"
---

# <% tp.system.prompt("Document title") %>

## Details

**Assessment Date**: <% tp.system.prompt("Assessment date (YYYY-MM-DD)") %>
**Financial Year**: <% tp.system.prompt("Financial year") %>
**Taxable Income**: <% tp.system.prompt("Taxable income amount") %>

## Notes

<% tp.system.prompt("Additional notes (optional)") %>

---
*Processed from inbox: <% tp.date.now("YYYY-MM-DD HH:mm") %>*
```

#### Rich Mode

Invokes the **template-assistant** skill to create enhanced templates with:
- Context-aware section headings
- Helpful inline instructions
- Related resource links
- Best practice guidance

The skill receives:
- Template name
- Field definitions
- Note type
- Context about document purpose

### Step 5: Scoring Configuration

Ask about confidence thresholds (optional - use defaults if skipped):

**Question 10**: "Do you want custom scoring thresholds? (yes/no)"

If yes:
- Heuristic weight (default: 0.3)
- LLM weight (default: 0.7)
- High confidence threshold (default: 0.85)
- Medium confidence threshold (default: 0.6)

---

## File Generation

### Classifier File Template

Generate `plugins/para-obsidian/src/inbox/classify/classifiers/definitions/{id}.ts`:

```typescript
/**
 * {DisplayName} Classifier
 *
 * {Description of what this classifier detects}
 *
 * @module classifiers/definitions/{id}
 */

import type { InboxConverter } from "../types";

/**
 * {DisplayName} classifier for {description}
 */
export const {camelCaseId}Classifier: InboxConverter = {
	schemaVersion: 1,
	id: "{id}",
	displayName: "{DisplayName}",
	enabled: true,
	priority: {priority},

	heuristics: {
		filenamePatterns: [
			// Generated from user input, with decreasing weights
			{ pattern: "{pattern1}", weight: 1.0 },
			{ pattern: "{pattern2}", weight: 0.9 },
			// ...
		],
		contentMarkers: [
			// Generated from user input
			{ pattern: "{marker1}", weight: 1.0 },
			{ pattern: "{marker2}", weight: 0.9 },
			// ...
		],
		threshold: 0.3,
	},

	fields: [
		// Always include title as first field
		{
			name: "title",
			type: "string",
			description: "{DocumentType} title/description",
			requirement: "required",
		},
		// User-defined fields...
	],

	extraction: {
		promptHint: "{LLM prompt hint for this document type}",
		keyFields: [{keyFields}],
	},

	template: {
		name: "{templateName}",
		fieldMappings: {
			// Map field names to Templater prompt labels
		},
	},

	scoring: {
		heuristicWeight: {heuristicWeight},
		llmWeight: {llmWeight},
		highThreshold: {highThreshold},
		mediumThreshold: {mediumThreshold},
	},
};
```

### Registry Update

Update `plugins/para-obsidian/src/inbox/classify/classifiers/definitions/index.ts`:

1. Add import:
   ```typescript
   import { {camelCaseId}Classifier } from "./{id}";
   ```

2. Add export:
   ```typescript
   export { {camelCaseId}Classifier } from "./{id}";
   ```

3. Add to `DEFAULT_CLASSIFIERS` array (maintain priority order):
   ```typescript
   export const DEFAULT_CLASSIFIERS: readonly InboxConverter[] = [
     // Existing classifiers...
     {camelCaseId}Classifier,  // Priority {priority}
   ] as const;
   ```

---

## Post-Generation

### Verification Steps

1. **Type check**:
   ```bash
   cd plugins/para-obsidian && bun typecheck
   ```

2. **Run classifier tests**:
   ```bash
   bun test classifiers
   ```

3. **Verify registration**:
   ```bash
   bun -e "
   const { DEFAULT_CLASSIFIERS } = require('./src/inbox/classify/classifiers/definitions');
   const found = DEFAULT_CLASSIFIERS.find(c => c.id === '{id}');
   console.log(found ? '✓ Classifier registered' : '✗ Not found');
   console.log('Total classifiers:', DEFAULT_CLASSIFIERS.length);
   "
   ```

### Obsidian Template Instructions

After generation, inform the user they need to create a matching template:

**Create `Templates/{templateName}.md` in your Obsidian vault:**

```markdown
---
type: {noteType}
template_version: 1
created: <% tp.date.now("YYYY-MM-DD") %>
{frontmatterFields}
---

# <% tp.user.prompt("{titlePrompt}") %>

## Details

{templateBodySuggestion}

---
*Created from inbox: <% tp.file.title %>*
```

Provide specific field mappings based on their classifier definition.

---

## Complete Example Walkthrough

**User invokes**: `/para-obsidian:create-classifier tax-return`

### Wizard Q&A

**Step 1 - Basic Info**:
```
Q1: What type of documents should this classifier detect?
A: Australian Tax Office (ATO) tax returns and notices of assessment

Q2: What priority should this classifier have? (0-100)
A: 95

Q3: Which PARA area does this typically belong to?
A: Finance
```

**Step 2 - Heuristic Patterns**:
```
Q4: What words/patterns appear in the FILENAME?
A: tax, return, ato, assessment, noa, mygov

Q5: What words/phrases appear in the CONTENT?
A: Notice of Assessment, Tax file number, TFN, taxable income, tax offset
```

**Step 3 - Field Extraction**:
```
Q6: What fields should be extracted?
A:
title:string:required
assessmentDate:date:required
financialYear:string:required
taxableIncome:currency:required
taxPayable:currency:optional
taxOffset:currency:optional
refundAmount:currency:conditional
debtAmount:currency:conditional

Q7: Provide descriptions for required fields:
A:
- title: Document title or reference number
- assessmentDate: Date the assessment was issued
- financialYear: Tax year (e.g., "2023-24")
- taxableIncome: Total taxable income for the year
```

**Step 4 - Template Configuration**:
```
Q8: Template filename?
A: tax-return

[System checks: Templates/tax-return.md not found]

Q9: Create template? (basic/rich/skip)
A: basic

Q10: Templater prompt labels for each field?
A:
title: Document title
assessmentDate: Assessment date (YYYY-MM-DD)
financialYear: Financial year
taxableIncome: Taxable income amount
```

**Step 5 - Scoring**:
```
Q11: Custom scoring thresholds?
A: no (use defaults)
```

### Generated Artifacts

#### 1. Classifier File: `definitions/tax-return.ts`

```typescript
/**
 * Tax Return Classifier
 *
 * Australian Tax Office (ATO) tax returns and notices of assessment
 *
 * @module classifiers/definitions/tax-return
 */

import type { InboxConverter } from "../types";

export const taxReturnClassifier: InboxConverter = {
  schemaVersion: 1,
  id: "tax-return",
  displayName: "Tax Return",
  enabled: true,
  priority: 95,

  heuristics: {
    filenamePatterns: [
      { pattern: "tax", weight: 1.0 },
      { pattern: "return", weight: 0.9 },
      { pattern: "ato", weight: 0.8 },
      { pattern: "assessment", weight: 0.7 },
      { pattern: "noa", weight: 0.6 },
      { pattern: "mygov", weight: 0.5 },
    ],
    contentMarkers: [
      { pattern: "Notice of Assessment", weight: 1.0 },
      { pattern: "Tax file number", weight: 0.9 },
      { pattern: "TFN", weight: 0.8 },
      { pattern: "taxable income", weight: 0.7 },
      { pattern: "tax offset", weight: 0.6 },
    ],
    threshold: 0.3,
  },

  fields: [
    {
      name: "title",
      type: "string",
      description: "Document title or reference number",
      requirement: "required",
    },
    {
      name: "assessmentDate",
      type: "date",
      description: "Date the assessment was issued",
      requirement: "required",
    },
    {
      name: "financialYear",
      type: "string",
      description: "Tax year (e.g., '2023-24')",
      requirement: "required",
    },
    {
      name: "taxableIncome",
      type: "currency",
      description: "Total taxable income for the year",
      requirement: "required",
    },
    {
      name: "taxPayable",
      type: "currency",
      description: "Total tax payable",
      requirement: "optional",
    },
    {
      name: "taxOffset",
      type: "currency",
      description: "Tax offset amount",
      requirement: "optional",
    },
    {
      name: "refundAmount",
      type: "currency",
      description: "Refund amount if applicable",
      requirement: "conditional",
    },
    {
      name: "debtAmount",
      type: "currency",
      description: "Debt amount if applicable",
      requirement: "conditional",
    },
  ],

  extraction: {
    promptHint: "Extract key details from ATO tax return or notice of assessment",
    keyFields: ["title", "assessmentDate", "financialYear", "taxableIncome"],
  },

  template: {
    name: "tax-return",
    fieldMappings: {
      title: "Document title",
      assessmentDate: "Assessment date (YYYY-MM-DD)",
      financialYear: "Financial year",
      taxableIncome: "Taxable income amount",
      taxPayable: "Tax payable",
      taxOffset: "Tax offset",
      refundAmount: "Refund amount",
      debtAmount: "Debt amount",
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

#### 2. Registry Update: `definitions/index.ts`

```typescript
// Added import
import { taxReturnClassifier } from "./tax-return";

// Added export
export { taxReturnClassifier } from "./tax-return";

// Added to DEFAULT_CLASSIFIERS array (priority order maintained)
export const DEFAULT_CLASSIFIERS: readonly InboxConverter[] = [
  medicalStatementClassifier,  // Priority 110
  taxReturnClassifier,          // Priority 95 <-- NEW
  invoiceClassifier,            // Priority 90
  bookingClassifier,            // Priority 85
  // ... other classifiers
] as const;
```

#### 3. Template File: `Templates/tax-return.md`

```markdown
---
type: tax-return
template_version: 1
created: <% tp.date.now("YYYY-MM-DD") %>
title: "<% tp.system.prompt("Document title") %>"
assessmentDate: "<% tp.system.prompt("Assessment date (YYYY-MM-DD)") %>"
financialYear: "<% tp.system.prompt("Financial year") %>"
taxableIncome: "<% tp.system.prompt("Taxable income amount") %>"
taxPayable: "<% tp.system.prompt("Tax payable") %>"
taxOffset: "<% tp.system.prompt("Tax offset") %>"
refundAmount: "<% tp.system.prompt("Refund amount") %>"
debtAmount: "<% tp.system.prompt("Debt amount") %>"
area: "[[Finance]]"
---

# <% tp.system.prompt("Document title") %>

## Details

**Assessment Date**: <% tp.system.prompt("Assessment date (YYYY-MM-DD)") %>
**Financial Year**: <% tp.system.prompt("Financial year") %>
**Taxable Income**: <% tp.system.prompt("Taxable income amount") %>
**Tax Payable**: <% tp.system.prompt("Tax payable") %>
**Tax Offset**: <% tp.system.prompt("Tax offset") %>
**Refund Amount**: <% tp.system.prompt("Refund amount") %>
**Debt Amount**: <% tp.system.prompt("Debt amount") %>

## Notes

<% tp.system.prompt("Additional notes (optional)") %>

---
*Processed from inbox: <% tp.date.now("YYYY-MM-DD HH:mm") %>*
```

---

## Success Criteria

After successful completion, you should have:

✅ **Classifier registered and loadable**
```bash
# Verify classifier is in registry
bun -e "const { DEFAULT_CLASSIFIERS } = require('./src/inbox/classify/classifiers/definitions'); \
  console.log(DEFAULT_CLASSIFIERS.find(c => c.id === 'tax-return'))"
```

✅ **TypeScript compiles without errors**
```bash
cd plugins/para-obsidian && bun typecheck
```

✅ **Template created (if chosen)**
```bash
ls ${PARA_VAULT}/Templates/tax-return.md
```

✅ **End-to-end inbox processing works**
```bash
# 1. Place test document in inbox
cp ~/Downloads/ATO-Notice-2024.pdf ${PARA_VAULT}/Inbox/

# 2. Scan inbox
bun run src/cli.ts process-inbox scan

# 3. Verify classifier detected it
# Should show tax-return classifier with high confidence

# 4. Execute suggestion
bun run src/cli.ts process-inbox execute

# 5. Check note was created
ls ${PARA_VAULT}/Finance/Tax\ Returns/
```

---

## Edge Cases Handled

### 1. Duplicate Classifier ID

**Scenario**: Classifier with ID `tax-return` already exists in `definitions/`

**Handling**:
- Before generating, check if `definitions/{id}.ts` exists
- Ask user: "Classifier `{id}` already exists. Overwrite? (yes/no)"
- If no, abort with helpful message suggesting different ID
- If yes, backup existing file before overwriting

### 2. Template Name Collision

**Scenario**: Template `tax-return.md` already exists in vault

**Handling**:
- Detect during template step
- Offer choices: use-existing, create-new (with suffix), skip
- If create-new: prompt for suffix (e.g., `v2`, `alt`)
- Update classifier's `template.name` to match final choice

### 3. Invalid Field Types

**Scenario**: User provides unsupported field type `boolean:required`

**Handling**:
- Validate each field against allowed types: `string`, `date`, `currency`, `number`
- Show error: "Unsupported field type `boolean`. Allowed: string, date, currency, number"
- Re-prompt for that field

### 4. Missing Template Field Mappings

**Scenario**: User defines field `taxOffset` but doesn't provide Templater label

**Handling**:
- After collecting all fields, verify each has a mapping
- Auto-generate missing mappings using field name (e.g., `taxOffset` → `"Tax Offset"`)
- Show warning: "Auto-generated label for `taxOffset`: 'Tax Offset'. Edit if needed."

### 5. Registry Corruption During Update

**Scenario**: Power loss or error while updating `definitions/index.ts`

**Handling**:
- Use atomic file operations (write to temp, rename)
- Create backup: `index.ts.backup` before modifying
- On failure, restore from backup automatically
- Transaction rollback: if registry update fails, delete created classifier file

### 6. Priority Conflicts

**Scenario**: Multiple classifiers at same priority (e.g., two at priority 95)

**Handling**:
- This is OK - classifiers at same priority are tried in array order
- No error needed
- Document in generated file comments which other classifiers share priority

### 7. TypeScript Compilation Failure

**Scenario**: Generated classifier code has syntax errors

**Handling**:
- Run `bun typecheck` after generation
- If fails:
  - Show TypeScript errors
  - Offer to open classifier file for manual editing
  - Rollback registry changes but keep classifier file for debugging
  - Suggest running `/para-obsidian:create-classifier` again

### 8. Wikilink Escaping in YAML

**Scenario**: Area field contains wikilink `[[Finance]]`

**Handling**:
- Auto-quote all wikilink values in frontmatter
- Correct: `area: "[[Finance]]"`
- Prevent YAML parsing errors from unquoted brackets

---

## End-to-End Integration

After creating a classifier, here's how it integrates with inbox processing:

### 1. Document Arrives in Inbox

```
${PARA_VAULT}/Inbox/ATO-Notice-2024.pdf
```

### 2. Scan Phase

```bash
bun run src/cli.ts process-inbox scan
```

**What happens:**
- Content extracted from PDF
- All classifiers loaded from registry (including new `tax-return`)
- Heuristic matching runs:
  - Filename "ATO-Notice-2024.pdf" matches patterns: `ato` (0.8), `notice` (0.7)
  - Content contains "Tax file number" (0.9), "taxable income" (0.7)
  - Heuristic score: 0.75

### 3. Classification Phase

**If heuristic score > threshold (0.3):**
- LLM extraction invoked with `tax-return` classifier schema
- Fields extracted according to field definitions
- LLM score calculated based on field confidence
- Combined score: `(0.3 × 0.75) + (0.7 × 0.92) = 0.87` (high confidence)

**Output:**
```
Classifier: tax-return (confidence: 0.87)
Suggested title: "Tax Return - 2023-24 Financial Year"
Extracted fields:
  - assessmentDate: 2024-10-15 (LLM)
  - financialYear: 2023-24 (LLM)
  - taxableIncome: $85,450.00 (LLM)
  - refundAmount: $1,234.56 (LLM)
```

### 4. User Review

```bash
bun run src/cli.ts process-inbox execute
```

**Interactive prompts:**
- Shows extracted fields
- User can edit/confirm each field
- Uses template field mappings for prompt labels

### 5. Note Creation

**Result:**
- Note created: `${PARA_VAULT}/Finance/Tax Returns/Tax Return - 2023-24.md`
- Frontmatter populated with extracted values
- Source file moved to `Processed/` folder
- Registry updated to track processed item

### 6. Template Execution

When user opens the note in Obsidian:
- Templater plugin processes the template
- Prompts already populated from extracted data
- User can fill in optional fields or add notes

---

## Error Handling

### Validation Errors

**Invalid classifier ID:**
- Error: "Classifier ID must be kebab-case (lowercase, hyphens only)"
- Example: `TaxReturn` → suggest `tax-return`

**Duplicate ID:**
- Ask: "Classifier `{id}` already exists. Overwrite? (yes/no)"
- On no: abort with message

**Priority out of range:**
- Error: "Priority must be 0-100 (got: {value})"
- Re-prompt for valid priority

### Generation Errors

**TypeScript compilation fails:**
- Show errors
- Keep generated files for debugging
- Rollback registry changes
- Suggest manual fix or retry

**Template validation fails:**
- Show validation errors (unbalanced quotes, tags, etc.)
- Keep template file for editing
- Continue with classifier (template optional)

### Runtime Errors

**File system errors:**
- Permission denied → show path, suggest `chmod`
- Directory not found → suggest creating `definitions/` folder
- Template directory missing → suggest creating `Templates/` in vault

### Rollback on Failure

**Transaction pattern:**
1. Backup `definitions/index.ts`
2. Create classifier file
3. Update registry
4. Create template (if chosen)
5. Run validation

**On any failure:**
1. Delete classifier file (if created)
2. Restore registry from backup
3. Delete template (if created)
4. Show error message with details

## Field Type Reference

| Type | Description | Validation | Example |
|------|-------------|------------|---------|
| `string` | Text value | Non-empty | "ATO Notice" |
| `date` | ISO date | YYYY-MM-DD | "2024-12-01" |
| `currency` | Numeric amount | Number or string | "1250.00" |
| `number` | Integer/float | Numeric | "42" |

## Requirement Level Reference

| Level | Usage | Validation |
|-------|-------|------------|
| `required` | Must be extracted | Fails if missing |
| `optional` | Nice to have | Succeeds without |
| `conditional` | Sometimes required | Requires `conditionalOn` field |

---

## Files Reference

- Template file: `definitions/_template.ts`
- Types: `classifiers/types.ts`
- Registry: `classifiers/registry.ts`
- Loader: `classifiers/loader.ts`
- Documentation: `definitions/README.md`
