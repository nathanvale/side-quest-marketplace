## Overview

This reference documents common patterns for skill authoring, including templates, examples, terminology consistency, and anti-patterns. All patterns use markdown structure.

## Template Pattern

Provide templates for output format. Match the level of strictness to your needs.

### Strict Requirements

Use when output format must be exact and consistent:

````markdown
ALWAYS use this exact template structure:

```markdown
# [Analysis Title]

## Executive summary
[One-paragraph overview of key findings]

## Key findings
- Finding 1 with supporting data
- Finding 2 with supporting data
- Finding 3 with supporting data

## Recommendations
1. Specific actionable recommendation
2. Specific actionable recommendation
```
````

**When to use**: Compliance reports, standardized formats, automated processing

### Flexible Guidance

Use when Claude should adapt the format based on context:

````markdown
Here is a sensible default format, but use your best judgment:

```markdown
# [Analysis Title]

## Executive summary
[Overview]

## Key findings
[Adapt sections based on what you discover]

## Recommendations
[Tailor to the specific context]
```

Adjust sections as needed for the specific analysis type.
````

**When to use**: Exploratory analysis, context-dependent formatting, creative tasks

## Examples Pattern

For skills where output quality depends on seeing examples, provide input/output pairs.

### Commit Messages Example

````markdown
## Quick Start

Generate commit messages following these examples:

**Example 1:**
Input: Added user authentication with JWT tokens
Output:
```
feat(auth): implement JWT-based authentication

Add login endpoint and token validation middleware
```

**Example 2:**
Input: Fixed bug where dates displayed incorrectly in reports
Output:
```
fix(reports): correct date formatting in timezone conversion

Use UTC timestamps consistently across report generation
```

Follow this style: type(scope): brief description, then detailed explanation.
````

### When to Use Examples

- Output format has nuances that text explanations can't capture
- Pattern recognition is easier than rule following
- Examples demonstrate edge cases
- Multi-shot learning improves quality

## Consistent Terminology

Choose one term and use it throughout the skill. Inconsistent terminology confuses Claude and reduces execution quality.

### Good Example

Consistent usage:
- Always "API endpoint" (not mixing with "URL", "API route", "path")
- Always "field" (not mixing with "box", "element", "control")
- Always "extract" (not mixing with "pull", "get", "retrieve")

```markdown
## Quick Start

Extract data from API endpoints using field mappings.

1. Identify the API endpoint
2. Map response fields to your schema
3. Extract field values
```

### Bad Example

Inconsistent usage creates confusion:

```markdown
## Quick Start

Pull data from API routes using element mappings.

1. Identify the URL
2. Map response boxes to your schema
3. Retrieve control values
```

Claude must now interpret: Are "API routes" and "URLs" the same? Are "fields", "boxes", "elements", and "controls" the same?

### Implementation

1. Choose terminology early in skill development
2. Document key terms in the objective or context section
3. Use find/replace to enforce consistency
4. Review reference files for consistent usage

## Provide Default with Escape Hatch

Provide a default approach with an escape hatch for special cases, not a list of alternatives. Too many options paralyze decision-making.

### Good Example

Clear default with escape hatch:

```markdown
## Quick Start

Use pdfplumber for text extraction:

```python
import pdfplumber
with pdfplumber.open("file.pdf") as pdf:
    text = pdf.pages[0].extract_text()
```

For scanned PDFs requiring OCR, use pdf2image with pytesseract instead.
```

### Bad Example

Too many options creates decision paralysis:

```markdown
## Quick Start

You can use any of these libraries:

- **pypdf**: Good for basic extraction
- **pdfplumber**: Better for tables
- **PyMuPDF**: Faster but more complex
- **pdf2image**: For scanned documents
- **pdfminer**: Low-level control
- **tabula-py**: Table-focused

Choose based on your needs.
```

Claude must now research and compare all options before starting. This wastes tokens and time.

### Implementation

1. Recommend ONE default approach
2. Explain when to use the default (implied: most of the time)
3. Add ONE escape hatch for edge cases
4. Link to advanced reference if multiple alternatives truly needed

## Anti-Patterns

Common mistakes to avoid when authoring skills.

### Markdown Headings are the Standard

**GOOD** - Using markdown headings in skill body:

```markdown
# PDF Processing

## Quick Start
Extract text with pdfplumber...

## Advanced Features
Form filling requires additional setup...
```

**BAD** - Using XML tags for structure:

```xml
<objective>
PDF processing with text extraction, form filling, and merging capabilities.
</objective>

<quick_start>
Extract text with pdfplumber...
</quick_start>

<advanced_features>
Form filling requires additional setup...
</advanced_features>
```

**Why it matters**: Markdown headings are the standard for skill body structure. They are readable, consistent with Anthropic's official conventions, and don't require closing tags.

### Vague Descriptions

**BAD**:
```yaml
description: Helps with documents
```

**GOOD**:
```yaml
description: Extract text and tables from PDF files, fill forms, merge documents. Use when working with PDF files or when the user mentions PDFs, forms, or document extraction.
```

**Why it matters**: Vague descriptions prevent Claude from discovering and using the skill appropriately.

### Inconsistent Point of View

**BAD**:
```yaml
description: I can help you process Excel files and generate reports
```

**GOOD**:
```yaml
description: Processes Excel files and generates reports. Use when analyzing spreadsheets or .xlsx files.
```

**Why it matters**: Skills must use third person. First/second person breaks the skill metadata pattern.

### Wrong Naming Convention

**BAD**: Directory name doesn't match skill name or verb-noun convention:
- Directory: `facebook-ads`, Name: `facebook-ads-manager`
- Directory: `stripe-integration`, Name: `stripe`
- Directory: `helper-scripts`, Name: `helper`

**GOOD**: Consistent verb-noun convention:
- Directory: `manage-facebook-ads`, Name: `manage-facebook-ads`
- Directory: `setup-stripe-payments`, Name: `setup-stripe-payments`
- Directory: `process-pdfs`, Name: `process-pdfs`

**Why it matters**: Consistency in naming makes skills discoverable and predictable.

### Too Many Options

**BAD**:
```markdown
## Quick Start
You can use pypdf, or pdfplumber, or PyMuPDF, or pdf2image, or pdfminer, or tabula-py...
```

**GOOD**:
```markdown
## Quick Start
Use pdfplumber for text extraction:

```python
import pdfplumber
```

For scanned PDFs requiring OCR, use pdf2image with pytesseract instead.
```

**Why it matters**: Decision paralysis. Provide one default approach with escape hatch for special cases.

### Deeply Nested References

**BAD**: References nested multiple levels:
```
SKILL.md -> advanced.md -> details.md -> examples.md
```

**GOOD**: References one level deep from SKILL.md:
```
SKILL.md -> advanced.md
SKILL.md -> details.md
SKILL.md -> examples.md
```

**Why it matters**: Claude may only partially read deeply nested files. Keep references one level deep from SKILL.md.

### Windows Paths

**BAD**:
```markdown
See scripts\validate.py for validation
```

**GOOD**:
```markdown
See scripts/validate.py for validation
```

**Why it matters**: Always use forward slashes for cross-platform compatibility.

### Dynamic Context and File Reference Execution

**Problem**: When showing examples of dynamic context syntax (exclamation mark + backticks) or file references (@ prefix), the skill loader executes these during skill loading.

**BAD** - These execute during skill load:
```markdown
Load current status with: (bang-backtick: git status)
Review dependencies in: @package.json
```

Note: The BAD example above uses the `!` + backtick syntax which the loader would execute.

**GOOD** - Add space to prevent execution:
```markdown
Load current status with: ! `git status` (remove space before backtick in actual usage)
Review dependencies in: @ package.json (remove space after @ in actual usage)
```

**When this applies**:
- Skills that teach users about dynamic context (slash commands, prompts)
- Any documentation showing the exclamation mark prefix syntax or @ file references
- Skills with example commands or file paths that shouldn't execute during loading

**Why it matters**: Without the space, these execute during skill load, causing errors or unwanted file reads.

### Missing Required Sections

**BAD** - Missing required sections:
```markdown
## Quick Start
Use this tool for processing...
```

**GOOD** - All required sections present:
```markdown
# Data Processing

Process data files with validation and transformation.

## Quick Start
Use this tool for processing...

## Done When
- Input file successfully processed
- Output file validates without errors
- Transformation applied correctly
```

**Why it matters**: Every skill should have an objective (heading or opening paragraph), Quick Start, and success criteria (Done When or Quality Criteria).

### Mixing XML and Markdown Structure

**BAD** - Mixing structural approaches:
```markdown
# PDF Processing

PDF processing capabilities

## Quick start

Extract text with pdfplumber...

<advanced_features>
Form filling...
</advanced_features>
```

**GOOD** - Consistent markdown structure throughout:
```markdown
# PDF Processing

PDF processing capabilities

## Quick Start

Extract text with pdfplumber...

## Advanced Features

Form filling...
```

**Why it matters**: Consistency in structure. Use markdown headings throughout for clarity and maintainability.

## Progressive Disclosure Pattern

Keep SKILL.md concise by linking to detailed reference files. Claude loads reference files only when needed.

### Implementation

```markdown
# Manage Facebook Ads

Manage Facebook Ads campaigns, ad sets, and ads via the Marketing API.

## Quick Start

See [basic-operations.md](references/basic-operations.md) for campaign creation and management.

## Advanced Features

- **Custom audiences**: See [audiences.md](references/audiences.md)
- **Conversion tracking**: See [conversions.md](references/conversions.md)
- **Budget optimization**: See [budgets.md](references/budgets.md)
- **API reference**: See [api-reference.md](references/api-reference.md)
```

**Benefits**:
- SKILL.md stays under 500 lines
- Claude only reads relevant reference files
- Token usage scales with task complexity
- Easier to maintain and update

## Validation Pattern

For skills with validation steps, make validation scripts verbose and specific.

### Implementation

```markdown
## Validation

After making changes, validate immediately:

```bash
python scripts/validate.py output_dir/
```

If validation fails, fix errors before continuing. Validation errors include:

- **Field not found**: "Field 'signature_date' not found. Available fields: customer_name, order_total, signature_date_signed"
- **Type mismatch**: "Field 'order_total' expects number, got string"
- **Missing required field**: "Required field 'customer_name' is missing"

Only proceed when validation passes with zero errors.
```

**Why verbose errors help**:
- Claude can fix issues without guessing
- Specific error messages reduce iteration cycles
- Available options shown in error messages

## Checklist Pattern

For complex multi-step workflows, provide a checklist Claude can copy and track progress.

### Implementation

```markdown
## Process

Copy this checklist and check off items as you complete them:

- [ ] Step 1: Analyze the form (run analyze_form.py)
- [ ] Step 2: Create field mapping (edit fields.json)
- [ ] Step 3: Validate mapping (run validate_fields.py)
- [ ] Step 4: Fill the form (run fill_form.py)
- [ ] Step 5: Verify output (run verify_output.py)

### Step 1: Analyze the Form

Run: `python scripts/analyze_form.py input.pdf`

This extracts form fields and their locations, saving to `fields.json`.

### Step 2: Create Field Mapping

Edit `fields.json` to add values for each field.

### Step 3: Validate Mapping

Run: `python scripts/validate_fields.py fields.json`

Fix any validation errors before continuing.

### Step 4: Fill the Form

Run: `python scripts/fill_form.py input.pdf fields.json output.pdf`

### Step 5: Verify Output

Run: `python scripts/verify_output.py output.pdf`

If verification fails, return to Step 2.
```

**Benefits**:
- Clear progress tracking
- Prevents skipping steps
- Easy to resume after interruption
