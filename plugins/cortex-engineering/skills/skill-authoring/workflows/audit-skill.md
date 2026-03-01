# Workflow: Audit a Skill

## Context

Read before proceeding:
- [Recommended structure](references/recommended-structure.md) - directory layout
- [Skill structure](references/skill-structure.md) - SKILL.md body format

## Process

### Step 0: Check for Pre-specified Target

If a skill name or path was already provided in the conversation (e.g., via `/create-skill audit naming-conventions`), use that directly and skip to Step 2.

### Step 1: List Available Skills

Enumerate skills in chat as numbered list:
```bash
ls ~/.claude/skills/
```

Present as:
```
Available skills:
1. create-agent-skills
2. build-macos-apps
3. manage-stripe
...
```

Ask: "Which skill would you like to audit? (enter number or name)"

### Step 2: Read the Skill

After user selects (or target was pre-specified), read the full skill structure:
```bash
# Read main file
cat ~/.claude/skills/{skill-name}/SKILL.md

# Check for workflows and references
ls ~/.claude/skills/{skill-name}/
ls ~/.claude/skills/{skill-name}/workflows/ 2>/dev/null
ls ~/.claude/skills/{skill-name}/references/ 2>/dev/null
```

### Step 3: Run Audit Checklist

Evaluate against each criterion:

#### YAML Frontmatter
- [ ] Has `name:` field (lowercase-with-hyphens)
- [ ] Name matches directory name
- [ ] Has `description:` field
- [ ] Description says what it does AND when to use it
- [ ] Description is third person ("Use when...")

#### Structure
- [ ] SKILL.md under 500 lines
- [ ] Markdown headings for structure (no XML structural tags)
- [ ] Has required sections: Quick Start or Core Principles
- [ ] Has success criteria or quality criteria

#### Router Pattern (if complex skill)
- [ ] Essential principles inline in SKILL.md (not in separate file)
- [ ] Has intake question
- [ ] Has routing table
- [ ] All referenced workflow files exist
- [ ] All referenced reference files exist

#### Workflows (if present)
- [ ] Each has Context section
- [ ] Each has Process section
- [ ] Each has Success Criteria section
- [ ] Context references exist

#### Content Quality
- [ ] Principles are actionable (not vague platitudes)
- [ ] Steps are specific (not "do the thing")
- [ ] Success criteria are verifiable
- [ ] No redundant content across files

### Step 4: Generate Report

Present findings as:

```
## Audit Report: {skill-name}

### Passing
- [list passing items]

### Issues Found
1. **[Issue name]**: [Description]
   - Fix: [Specific action]

2. **[Issue name]**: [Description]
   - Fix: [Specific action]

### Score: X/Y criteria passing
```

### Step 5: Offer Fixes

If issues found, present options:

1. **Fix all** - Apply all recommended fixes
2. **Fix one by one** - Review each fix before applying
3. **Just the report** - No changes needed

If fixing:
- Make each change
- Verify file validity after each change
- Report what was fixed

## Audit Anti-Patterns

Common anti-patterns to flag:

- **Skippable principles**: Essential principles in separate file instead of inline
- **Monolithic skill**: Single file over 500 lines
- **Mixed concerns**: Procedures and knowledge in same file
- **Vague steps**: "Handle the error appropriately"
- **Untestable criteria**: "User is satisfied"
- **XML structural tags**: Using XML tags instead of markdown headings for structure
- **Missing routing**: Complex skill without intake/routing
- **Broken references**: Files mentioned but don't exist
- **Redundant content**: Same information in multiple places

## Success Criteria

- [ ] Skill fully read and analyzed
- [ ] All checklist items evaluated
- [ ] Report presented to user
- [ ] Fixes applied (if requested)
- [ ] User has clear picture of skill health
