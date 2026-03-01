# Workflow: Add a Reference to Existing Skill

## Context

Read before proceeding:
- [Recommended structure](references/recommended-structure.md) - directory layout
- [Skill structure](references/skill-structure.md) - SKILL.md body format

## Process

### Step 1: Select the Skill

```bash
ls ~/.claude/skills/
```

Present numbered list, ask: "Which skill needs a new reference?"

### Step 2: Analyze Current Structure

```bash
cat ~/.claude/skills/{skill-name}/SKILL.md
ls ~/.claude/skills/{skill-name}/references/ 2>/dev/null
```

Determine:
- **Has references/ folder?** - Good, can add directly
- **Simple skill?** - May need to create references/ first
- **What references exist?** - Understand the knowledge landscape

Report current references to user.

### Step 3: Gather Reference Requirements

Ask:
- What knowledge should this reference contain?
- Which workflows will use it?
- Is this reusable across workflows or specific to one?

**If specific to one workflow** - Consider putting it inline in that workflow instead.

### Step 4: Create the Reference File

Create `references/{reference-name}.md`:

Use markdown headings to structure the content:

```markdown
## Overview

Brief description of what this reference covers

## Common Patterns

[Reusable patterns, examples, code snippets]

## Guidelines

[Best practices, rules, constraints]

## Examples

[Concrete examples with explanation]
```

### Step 5: Update SKILL.md

Add the new reference to the Reference Files section or Domain Knowledge section:
```markdown
- [new-reference.md](references/new-reference.md) - purpose
```

### Step 6: Update Workflows That Need It

For each workflow that should use this reference:

1. Read the workflow file
2. Add to its Context section
3. Verify the workflow still makes sense with this addition

### Step 7: Verify

- [ ] Reference file exists and is well-structured
- [ ] Reference is in SKILL.md reference listing
- [ ] Relevant workflows have it in Context section
- [ ] No broken references

## Success Criteria

- [ ] Reference file created with useful content
- [ ] Added to reference listing in SKILL.md
- [ ] Relevant workflows updated to read it
- [ ] Content is reusable (not workflow-specific)
