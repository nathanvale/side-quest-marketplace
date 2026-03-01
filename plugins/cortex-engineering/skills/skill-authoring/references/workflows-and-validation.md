# Workflows and Validation

## Overview

This reference covers patterns for complex workflows, validation loops, and feedback cycles in skill authoring.

## Complex Workflows

Break complex operations into clear, sequential steps. For particularly complex workflows, provide a checklist.

### PDF Forms Example

```markdown
# PDF Form Filler

Fill PDF forms with validated data from JSON field mappings.

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

### When to Use Checklists

Use checklist pattern when:
- Workflow has 5+ sequential steps
- Steps must be completed in order
- Progress tracking helps prevent errors
- Easy resumption after interruption is valuable

## Feedback Loops

### Validate-Fix-Repeat Pattern

Run validator -> fix errors -> repeat. This pattern greatly improves output quality.

#### Document Editing Example

```markdown
# OOXML Document Editor

Edit OOXML documents with XML validation at each step.

## Process

### Step 1: Make Edits
Make your edits to `word/document.xml`

### Step 2: Validate
**Validate immediately**: `python ooxml/scripts/validate.py unpacked_dir/`

### Step 3: Fix Errors
If validation fails:
- Review the error message carefully
- Fix the issues in the XML
- Run validation again

### Step 4: Proceed
**Only proceed when validation passes**

### Step 5: Rebuild
Rebuild: `python ooxml/scripts/pack.py unpacked_dir/ output.docx`

### Step 6: Test
Test the output document

## Validation

Never skip validation. Catching errors early prevents corrupted output files.
```

#### Why It Works

- Catches errors early before changes are applied
- Machine-verifiable with objective verification
- Plan can be iterated without touching originals
- Reduces total iteration cycles

### Plan-Validate-Execute Pattern

When Claude performs complex, open-ended tasks, create a plan in a structured format, validate it, then execute.

Workflow: analyze -> **create plan file** -> **validate plan** -> execute -> verify

#### Batch Update Example

```markdown
# Spreadsheet Batch Updater

Apply batch updates to spreadsheet with plan validation.

## Process

### Phase 1: Plan
1. Analyze the spreadsheet and requirements
2. Create `changes.json` with all planned updates

### Phase 2: Validate
3. Validate the plan: `python scripts/validate_changes.py changes.json`
4. If validation fails:
   - Review error messages
   - Fix issues in changes.json
   - Validate again
5. Only proceed when validation passes

### Phase 3: Execute
6. Apply changes: `python scripts/apply_changes.py changes.json`
7. Verify output

## Done When

- Plan validation passes with zero errors
- All changes applied successfully
- Output verification confirms expected results
```

#### Implementation Tip

Make validation scripts verbose with specific error messages:

**Good error message:**
"Field 'signature_date' not found. Available fields: customer_name, order_total, signature_date_signed"

**Bad error message:**
"Invalid field"

Specific errors help Claude fix issues without guessing.

#### When to Use

Use plan-validate-execute when:
- Operations are complex and error-prone
- Changes are irreversible or difficult to undo
- Planning can be validated independently
- Catching errors early saves significant time

## Conditional Workflows

Guide Claude through decision points with clear branching logic.

### Document Modification Example

```markdown
# DOCX Modifier

Modify DOCX files using appropriate method based on task type.

## Process

### Step 1: Determine Modification Type

**Creating new content?** -> Follow "Creation Workflow" below
**Editing existing content?** -> Follow "Editing Workflow" below

### Creation Workflow

1. Use docx-js library
2. Build document from scratch
3. Export to .docx format

### Editing Workflow

1. Unpack existing document
2. Modify XML directly
3. Validate after each change
4. Repack when complete

## Done When

- Correct workflow chosen based on task type
- All steps in chosen workflow completed
- Output file validated and verified
```

### When to Use

Use conditional workflows when:
- Different task types require different approaches
- Decision points are clear and well-defined
- Workflows are mutually exclusive
- Guiding Claude to correct path improves outcomes

## Validation Scripts

Validation scripts are force multipliers. They catch errors that Claude might miss and provide actionable feedback for fixing issues.

### Characteristics of Good Validation

**Verbose errors:**
- **Good**: "Field 'signature_date' not found. Available fields: customer_name, order_total, signature_date_signed"
- **Bad**: "Invalid field"

Verbose errors help Claude fix issues in one iteration instead of multiple rounds of guessing.

**Specific feedback:**
- **Good**: "Line 47: Expected closing tag `</paragraph>` but found `</section>`"
- **Bad**: "XML syntax error"

Specific feedback pinpoints exact location and nature of the problem.

**Actionable suggestions:**
- **Good**: "Required field 'customer_name' is missing. Add: {\"customer_name\": \"value\"}"
- **Bad**: "Missing required field"

Actionable suggestions show Claude exactly what to fix.

**Available options:**
When validation fails, show available valid options:
- **Good**: "Invalid status 'pending_review'. Valid statuses: active, paused, archived"
- **Bad**: "Invalid status"

Showing valid options eliminates guesswork.

### Implementation Pattern

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
- **Invalid value**: "Invalid status 'pending_review'. Valid statuses: active, paused, archived"

Only proceed when validation passes with zero errors.
```

### Benefits

- Catches errors before they propagate
- Reduces iteration cycles
- Provides learning feedback
- Makes debugging deterministic
- Enables confident execution

## Iterative Refinement

Many workflows benefit from iteration: generate -> validate -> refine -> validate -> finalize.

### Implementation Example

```markdown
# Report Generator

Generate reports with iterative quality improvement.

## Process

### Iteration 1: Generate Initial Draft
Create report based on data and requirements.

### Iteration 2: Validate Draft
Run: `python scripts/validate_report.py draft.md`

Fix any structural issues, missing sections, or data errors.

### Iteration 3: Refine Content
Improve clarity, add supporting data, enhance visualizations.

### Iteration 4: Final Validation
Run: `python scripts/validate_report.py final.md`

Ensure all quality criteria met.

### Iteration 5: Finalize
Export to final format and deliver.

## Done When

- Final validation passes with zero errors
- All quality criteria met
- Report ready for delivery
```

### When to Use

Use iterative refinement when:
- Quality improves with multiple passes
- Validation provides actionable feedback
- Time permits iteration
- Perfect output matters more than speed

## Checkpoint Pattern

For long workflows, add checkpoints where Claude can pause and verify progress before continuing.

### Implementation Example

```markdown
## Process

### Phase 1: Data Collection (Steps 1-3)

1. Extract data from source
2. Transform to target format
3. **CHECKPOINT**: Verify data completeness

Only continue if checkpoint passes.

### Phase 2: Data Processing (Steps 4-6)

4. Apply business rules
5. Validate transformations
6. **CHECKPOINT**: Verify processing accuracy

Only continue if checkpoint passes.

### Phase 3: Output Generation (Steps 7-9)

7. Generate output files
8. Validate output format
9. **CHECKPOINT**: Verify final output

Proceed to delivery only if checkpoint passes.

### Checkpoint Validation

At each checkpoint:
1. Run validation script
2. Review output for correctness
3. Verify no errors or warnings
4. Only proceed when validation passes
```

### Benefits

- Prevents cascading errors
- Easier to diagnose issues
- Clear progress indicators
- Natural pause points for review
- Reduces wasted work from early errors

## Error Recovery

Design workflows with clear error recovery paths. Claude should know what to do when things go wrong.

### Implementation Example

```markdown
## Process

### Normal Path
1. Process input file
2. Validate output
3. Save results

### Error Recovery

**If validation fails in step 2:**
- Review validation errors
- Check if input file is corrupted -> Return to step 1 with different input
- Check if processing logic failed -> Fix logic, return to step 1
- Check if output format wrong -> Fix format, return to step 2

**If save fails in step 3:**
- Check disk space
- Check file permissions
- Check file path validity
- Retry save with corrected conditions

### Escalation

**If error persists after 3 attempts:**
- Document the error with full context
- Save partial results if available
- Report issue to user with diagnostic information
```

### When to Use

Include error recovery when:
- Workflows interact with external systems
- File operations could fail
- Network calls could timeout
- User input could be invalid
- Errors are recoverable
