# Be Clear and Direct

> Show your skill to someone with minimal context and ask them to follow the instructions. If they're confused, Claude will likely be too.

## Overview

Clarity and directness are fundamental to effective skill authoring. Clear instructions reduce errors, improve execution quality, and minimize token waste.

## Guidelines

### Contextual Information

Give Claude contextual information that frames the task:

- What the task results will be used for
- What audience the output is meant for
- What workflow the task is part of
- The end goal or what successful completion looks like

Context helps Claude make better decisions and produce more appropriate outputs.

**Example:**
```markdown
## Context
This analysis will be presented to investors who value transparency and actionable insights. Focus on financial metrics and clear recommendations.
```

### Specificity

Be specific about what you want Claude to do. If you want code only and nothing else, say so.

**Vague**: "Help with the report"
**Specific**: "Generate a markdown report with three sections: Executive Summary, Key Findings, Recommendations"

**Vague**: "Process the data"
**Specific**: "Extract customer names and email addresses from the CSV file, removing duplicates, and save to JSON format"

Specificity eliminates ambiguity and reduces iteration cycles.

### Sequential Steps

Provide instructions as sequential steps. Use numbered lists or bullet points.

```markdown
## Process

1. Extract data from source file
2. Transform to target format
3. Validate transformation
4. Save to output file
5. Verify output correctness
```

Sequential steps create clear expectations and reduce the chance Claude skips important operations.

## Example Comparison

### Unclear

```markdown
## Quick Start

Please remove all personally identifiable information from these customer feedback messages: [feedback-data]
```

**Problems:**
- What counts as PII?
- What should replace PII?
- What format should the output be?
- What if no PII is found?
- Should product names be redacted?

### Clear

```markdown
# PII Anonymization

Anonymize customer feedback for quarterly review presentation.

## Quick Start

1. Replace all customer names with "CUSTOMER_[ID]" (e.g., "Jane Doe" -> "CUSTOMER_001")
2. Replace email addresses with "EMAIL_[ID]@example.com"
3. Redact phone numbers as "PHONE_[ID]"
4. If a message mentions a specific product (e.g., "AcmeCloud"), leave it intact
5. If no PII is found, copy the message verbatim
6. Output only the processed messages, separated by "---"

Data to process: [feedback-data]

## Done When

- All customer names replaced with IDs
- All emails and phones redacted
- Product names preserved
- Output format matches specification
```

**Why this is better:**
- States the purpose (quarterly review)
- Provides explicit step-by-step rules
- Defines output format clearly
- Specifies edge cases (product names, no PII found)
- Defines success criteria

## Show, Don't Just Tell

When format matters, show an example rather than just describing it.

### Telling (weak)

```markdown
## Commit Messages

Generate commit messages in conventional format with type, scope, and description.
```

### Showing (strong)

```markdown
## Commit Message Format

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
```

### Why Showing Works

Examples communicate nuances that text descriptions can't:
- Exact formatting (spacing, capitalization, punctuation)
- Tone and style
- Level of detail
- Pattern across multiple cases

Claude learns patterns from examples more reliably than from descriptions.

## Avoid Ambiguity

Eliminate words and phrases that create ambiguity or leave decisions open.

### Ambiguous Phrases

- "Try to..." -> Implies optional. Use **"Always..."** or **"Never..."**
- "Should probably..." -> Unclear obligation. Use **"Must..."** or **"May optionally..."**
- "Generally..." -> When are exceptions allowed? Use **"Always... except when..."**
- "Consider..." -> Should Claude always do this? Use **"If X, then Y"** or **"Always..."**

### Example

**Ambiguous:**
```markdown
## Validation

You should probably validate the output and try to fix any errors.
```

**Clear:**
```markdown
## Validation

Always validate output before proceeding:

```bash
python scripts/validate.py output_dir/
```

If validation fails, fix errors and re-validate. Only proceed when validation passes with zero errors.
```

## Define Edge Cases

Anticipate edge cases and define how to handle them. Don't leave Claude guessing.

### Without Edge Cases

```markdown
## Quick Start

Extract email addresses from the text file and save to a JSON array.
```

**Questions left unanswered:**
- What if no emails are found?
- What if the same email appears multiple times?
- What if emails are malformed?
- What JSON format exactly?

### With Edge Cases

```markdown
## Quick Start

Extract email addresses from the text file and save to a JSON array.

### Edge Cases

- **No emails found**: Save empty array `[]`
- **Duplicate emails**: Keep only unique emails
- **Malformed emails**: Skip invalid formats, log to stderr
- **Output format**: Array of strings, one email per element

### Example Output

```json
[
  "user1@example.com",
  "user2@example.com"
]
```
```

## Output Format Specification

When output format matters, specify it precisely. Show examples.

### Vague

```markdown
Generate a report with the analysis results.
```

### Specific

```markdown
## Output Format

Generate a markdown report with this exact structure:

```markdown
# Analysis Report: [Title]

## Executive Summary
[1-2 paragraphs summarizing key findings]

## Key Findings
- Finding 1 with supporting data
- Finding 2 with supporting data
- Finding 3 with supporting data

## Recommendations
1. Specific actionable recommendation
2. Specific actionable recommendation

## Appendix
[Raw data and detailed calculations]
```

**Requirements:**
- Use exactly these section headings
- Executive summary must be 1-2 paragraphs
- List 3-5 key findings
- Provide 2-4 recommendations
- Include appendix with source data
```

## Decision Criteria

When Claude must make decisions, provide clear criteria.

### Without Criteria

```markdown
Analyze the data and decide which visualization to use.
```

**Problem:** What factors should guide this decision?

### With Criteria

```markdown
Analyze the data and select appropriate visualization:

**Use bar chart when:**
- Comparing quantities across categories
- Fewer than 10 categories
- Exact values matter

**Use line chart when:**
- Showing trends over time
- Continuous data
- Pattern recognition matters more than exact values

**Use scatter plot when:**
- Showing relationship between two variables
- Looking for correlations
- Individual data points matter
```

**Benefits:** Claude has objective criteria for making the decision rather than guessing.

## Constraints and Requirements

Clearly separate "must do" from "nice to have" from "must not do".

### Unclear

```markdown
The report should include financial data, customer metrics, and market analysis. It would be good to have visualizations. Don't make it too long.
```

**Problems:**
- Are all three content types required?
- Are visualizations optional or required?
- How long is "too long"?

### Clear

```markdown
### Must Have
- Financial data (revenue, costs, profit margins)
- Customer metrics (acquisition, retention, lifetime value)
- Market analysis (competition, trends, opportunities)
- Maximum 5 pages

### Nice to Have
- Charts and visualizations
- Industry benchmarks
- Future projections

### Must Not
- Include confidential customer names
- Exceed 5 pages
- Use technical jargon without definitions
```

**Benefits:** Clear priorities and constraints prevent misalignment.

## Success Criteria

Define what success looks like. How will Claude know it succeeded?

### Without Success Criteria

```markdown
Process the CSV file and generate a report.
```

**Problem:** When is this task complete? What defines success?

### With Success Criteria

```markdown
# CSV Report Generator

Process the CSV file and generate a summary report.

## Done When

- All rows in CSV successfully parsed
- No data validation errors
- Report generated with all required sections
- Report saved to output/report.md
- Output file is valid markdown
- Process completes without errors
```

**Benefits:** Clear completion criteria eliminate ambiguity about when the task is done.

## Testing Clarity

Test your instructions by asking: "Could I hand these instructions to a junior developer and expect correct results?"

### Testing Process

1. Read your skill instructions
2. Remove context only you have (project knowledge, unstated assumptions)
3. Identify ambiguous terms or vague requirements
4. Add specificity where needed
5. Test with someone who doesn't have your context
6. Iterate based on their questions and confusion

If a human with minimal context struggles, Claude will too.

## Practical Examples

### Data Processing

**Unclear:**
```markdown
Clean the data and remove bad entries.
```

**Clear:**
```markdown
## Data Cleaning

1. Remove rows where required fields (name, email, date) are empty
2. Standardize date format to YYYY-MM-DD
3. Remove duplicate entries based on email address
4. Validate email format (must contain @ and domain)
5. Save cleaned data to output/cleaned_data.csv

## Done When

- No empty required fields
- All dates in YYYY-MM-DD format
- No duplicate emails
- All emails valid format
- Output file created successfully
```

### Code Generation

**Unclear:**
```markdown
Write a function to process user input.
```

**Clear:**
```markdown
## Function Specification

Write a Python function with this signature:

```python
def process_user_input(raw_input: str) -> dict:
    """
    Validate and parse user input.

    Args:
        raw_input: Raw string from user (format: "name:email:age")

    Returns:
        dict with keys: name (str), email (str), age (int)

    Raises:
        ValueError: If input format is invalid
    """
```

**Requirements:**
- Split input on colon delimiter
- Validate email contains @ and domain
- Convert age to integer, raise ValueError if not numeric
- Return dictionary with specified keys
- Include docstring and type hints

## Done When

- Function signature matches specification
- All validation checks implemented
- Proper error handling for invalid input
- Type hints included
- Docstring included
```
