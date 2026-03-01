# Using Templates in Skills

## Purpose

Templates are reusable output structures that Claude copies and fills in. They ensure consistent, high-quality outputs without regenerating structure each time.

## When to Use

Use templates when:
- Output should have consistent structure across invocations
- The structure matters more than creative generation
- Filling placeholders is more reliable than blank-page generation
- Users expect predictable, professional-looking outputs

Common template types:
- **Plans** - Project plans, implementation plans, migration plans
- **Specifications** - Technical specs, feature specs, API specs
- **Documents** - Reports, proposals, summaries
- **Configurations** - Config files, settings, environment setups
- **Scaffolds** - File structures, boilerplate code

## Template Structure

Templates live in `templates/` within the skill directory:

```
skill-name/
├── SKILL.md
├── workflows/
├── references/
└── templates/
    ├── plan-template.md
    ├── spec-template.md
    └── report-template.md
```

A template file contains:
1. Clear section markers
2. Placeholder indicators (use `[placeholder]`)
3. Inline guidance for what goes where
4. Example content where helpful

## Template Example

```markdown
# [Project Name] Implementation Plan

## Overview
[1-2 sentence summary of what this plan covers]

## Goals
- [Primary goal]
- [Secondary goals...]

## Scope
**In scope:**
- [What's included]

**Out of scope:**
- [What's explicitly excluded]

## Phases

### Phase 1: [Phase name]
**Duration:** [Estimated duration]
**Deliverables:**
- [Deliverable 1]
- [Deliverable 2]

### Phase 2: [Phase name]
...

## Success Criteria
- [ ] [Measurable criterion 1]
- [ ] [Measurable criterion 2]

## Risks
| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| [Risk] | [H/M/L] | [H/M/L] | [Strategy] |
```

## Workflow Integration

Workflows reference templates like this:

```markdown
### Step 3: Generate Plan

1. Read `templates/plan-template.md`
2. Copy the template structure
3. Fill each placeholder based on gathered requirements
4. Review for completeness
```

The workflow tells Claude WHEN to use the template. The template provides WHAT structure to produce.

## Best Practices

**Do:**
- Keep templates focused on structure, not content
- Use clear placeholder syntax consistently
- Include brief inline guidance where sections might be ambiguous
- Make templates complete but minimal

**Don't:**
- Put excessive example content that might be copied verbatim
- Create templates for outputs that genuinely need creative generation
- Over-constrain with too many required sections
- Forget to update templates when requirements change
