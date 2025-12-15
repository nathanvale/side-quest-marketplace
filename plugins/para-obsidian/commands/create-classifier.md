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

**Question 9**: "What are the Templater prompt labels for each field?"
> Format: `fieldName: Prompt Label`
> Example:
> ```
> title: Document title
> assessmentDate: Assessment date (YYYY-MM-DD)
> taxableIncome: Taxable income amount
> ```

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

## Example Walkthrough

**User**: `/para-obsidian:create-classifier tax-return`

**Step 1 - Basic Info**:
- Description: "Australian Tax Office (ATO) tax returns and notices of assessment"
- Priority: 95 (higher than generic invoice)
- Area: Finance

**Step 2 - Patterns**:
- Filename: tax, return, ato, assessment, noa, mygov
- Content: Notice of Assessment, Tax file number, TFN, taxable income, tax offset

**Step 3 - Fields**:
```
title:string:required
assessmentDate:date:required
financialYear:string:required
taxableIncome:currency:required
taxPayable:currency:optional
taxOffset:currency:optional
refundAmount:currency:conditional
debtAmount:currency:conditional
status:string:optional
area:string:optional
```

**Step 4 - Template**:
- Template name: `tax-return`
- Field mappings provided

**Step 5 - Scoring**:
- Use defaults

**Generated files**:
1. `definitions/tax-return.ts` - Complete classifier
2. Updated `definitions/index.ts` - Registration

---

## Error Handling

- If classifier ID is invalid, explain kebab-case requirements
- If classifier already exists, ask if user wants to overwrite
- If type check fails, show errors and suggest fixes
- Always clean up partial generation on failure

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
