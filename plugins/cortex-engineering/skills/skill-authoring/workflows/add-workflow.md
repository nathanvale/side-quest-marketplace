# Workflow: Add a Workflow to Existing Skill

## Context

Read before proceeding:
- [Recommended structure](references/recommended-structure.md) - directory layout
- [Workflows and validation](references/workflows-and-validation.md) - workflow patterns

## Process

### Step 1: Select the Skill

```bash
ls ~/.claude/skills/
```

Present numbered list, ask: "Which skill needs a new workflow?"

### Step 2: Analyze Current Structure

Read the skill:
```bash
cat ~/.claude/skills/{skill-name}/SKILL.md
ls ~/.claude/skills/{skill-name}/workflows/ 2>/dev/null
```

Determine:
- **Simple skill?** - May need to upgrade to router pattern first
- **Already has workflows/?** - Good, can add directly
- **What workflows exist?** - Avoid duplication

Report current structure to user.

### Step 3: Gather Workflow Requirements

Ask:
- What should this workflow do?
- When would someone use it vs existing workflows?
- What references would it need?

### Step 4: Upgrade to Router Pattern (if needed)

**If skill is currently simple (no workflows/):**

Ask: "This skill needs to be upgraded to the router pattern first. Should I restructure it?"

If yes:
1. Create workflows/ directory
2. Move existing process content to workflows/main.md
3. Rewrite SKILL.md as router with intake + routing
4. Verify structure works before proceeding

### Step 5: Create the Workflow File

Create `workflows/{workflow-name}.md`:

```markdown
# Workflow: [Workflow Name]

## Context

Read before proceeding:
- [reference-name.md](references/reference-name.md) - purpose

## Process

### Step 1: [First Step]
[What to do]

### Step 2: [Second Step]
[What to do]

### Step 3: [Third Step]
[What to do]

## Success Criteria

- [ ] Criterion 1
- [ ] Criterion 2
- [ ] Criterion 3
```

### Step 6: Update SKILL.md

Add the new workflow to:

1. **Intake question** - Add new option
2. **Routing table** - Map option to workflow file
3. **Workflows index** - Add to the list

### Step 7: Create References (if needed)

If the workflow needs domain knowledge that doesn't exist:
1. Create `references/{reference-name}.md`
2. Add to reference listing in SKILL.md
3. Reference it in the workflow's Context section

### Step 8: Test

Invoke the skill:
- Does the new option appear in intake?
- Does selecting it route to the correct workflow?
- Does the workflow load the right references?
- Does the workflow execute correctly?

Report results to user.

## Success Criteria

- [ ] Skill upgraded to router pattern (if needed)
- [ ] Workflow file created with Context, Process, Success Criteria
- [ ] SKILL.md intake updated with new option
- [ ] SKILL.md routing updated
- [ ] SKILL.md workflows index updated
- [ ] Any needed references created
- [ ] Tested and working
