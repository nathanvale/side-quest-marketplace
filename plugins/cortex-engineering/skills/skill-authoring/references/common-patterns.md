# Common Patterns

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

## Numbered Menu Routing Pattern

Use a numbered menu with markdown links to route callers to the right workflow. The links serve as both human-readable navigation and machine instructions for which file to load.

### Implementation

````markdown
## What Would You Like To Do?

1. **[Create new widget](workflows/create-widget.md)** - Build from scratch
2. **[Debug widget](workflows/debug-widget.md)** - Diagnose and fix issues
3. **[Ship widget](workflows/ship-widget.md)** - Package and deploy

**Routing keywords:** `create` -> 1, `debug` -> 2, `ship` -> 3

If arguments match a keyword or menu item, read the corresponding workflow and begin.
Otherwise, reply with a number or describe what you need.

$ARGUMENTS
````

### Why This Works

The markdown link IS the routing mechanism. When Claude reads `**[Create new widget](workflows/create-widget.md)**`, the link tells it exactly which file to load. No separate routing table needed.

### Three Callers

This pattern serves all callers simultaneously:

- **Humans** - type a number (`1`) or describe what they need ("I want to create a widget")
- **Agents** - pass arguments like `$ARGUMENTS = "create a widget for Docker"` which fuzzy-matches to the right workflow
- **Commands as orchestrators** - `/my-command debug my-widget` passes args through the command -> skill chain

### Routing Keywords

Add explicit keywords for deterministic agent access. Without keywords, routing relies on Claude's fuzzy matching. With keywords, agents can pass exact terms (`create`, `debug`, `ship`) for reliable routing.

### When to Use

- Skill has 3+ distinct workflows
- Both humans and agents will invoke the skill
- Arguments should route directly without interactive menu

## Background Skill + Command Entry Point Pattern

Combine `user-invocable: false` on the skill with a separate command as the manual entry point. The skill auto-loads when Claude detects relevance; the command gives users an explicit `/` invocation.

### Implementation

**Skill (auto-loads, not in slash menu):**
```yaml
---
name: my-domain-knowledge
description: Expert guidance for X. Use when building, debugging, or improving X.
user-invocable: false
---
```

**Command (manual entry point):**
```yaml
---
name: do-x
description: Build, debug, or improve X.
argument-hint: [action]
disable-model-invocation: true
allowed-tools: Read, Write, Edit, Glob
---

Use the **my-domain-knowledge** skill to guide this task.
$ARGUMENTS
```

### Why This Works

- **Skill as background knowledge**: Claude auto-discovers and loads it when the user's request matches the description. No slash command needed.
- **Command as explicit action**: Users who want to trigger the workflow intentionally use `/do-x`. The `disable-model-invocation: true` prevents Claude from triggering it autonomously.
- **No duplication**: The command delegates to the skill. One source of truth.

### When to Use

- Skill contains domain knowledge that should auto-load when relevant
- Users also want an explicit `/` command to trigger workflows
- The workflows have side effects (creating files, modifying code)

## Arguments Pass-through Pattern

Place `$ARGUMENTS` after your menu or routing instructions. When arguments are present, Claude skips the interactive menu and routes directly. When absent, Claude presents the menu.

### Implementation

````markdown
## What Would You Like To Do?

1. **[Option A](workflows/a.md)** - Description
2. **[Option B](workflows/b.md)** - Description

**Routing keywords:** `a` -> 1, `b` -> 2

If arguments match a keyword or menu item, read the corresponding workflow and begin.
Otherwise, reply with a number or describe what you need.

$ARGUMENTS
````

### How It Works

- `/my-skill build a widget` -> `$ARGUMENTS = "build a widget"` -> Claude matches "build" to the create workflow -> skips menu
- `/my-skill` -> `$ARGUMENTS` is empty -> Claude presents the numbered menu
- Agent passes `"audit my-thing"` -> routes directly to audit workflow

### When to Use

- Skill supports both interactive (no args) and direct (with args) invocation
- Command delegates to a skill and passes arguments through
- Power users want to skip the menu

## Template Guidance Comment Pattern

Add an HTML comment block at the top of templates to help authors understand what to fill in. The comment is invisible to Claude during skill execution but visible when editing the template file.

### Implementation

```markdown
<!--
  WHAT: [one-sentence purpose]
  WHY:  [when Claude should load this skill]
  EXAMPLE: /[skill-name] [typical usage]
-->
---
name: [skill-name]
description: [What it does] Use when [trigger conditions].
---

# [Skill Name]

[Clear statement of what this skill accomplishes]
```

### Why This Works

- HTML comments don't consume tokens during skill loading
- Authors see guidance when editing the file
- The WHAT/WHY/EXAMPLE structure forces authors to think about purpose before writing content
- Works as a checklist: if you can't fill in all three fields, the skill isn't well-defined yet

### When to Use

- Templates that other people (or Claude) will fill in
- Boilerplate files where the structure matters but the content varies
- Any template where a brief "how to use this" would prevent mistakes
