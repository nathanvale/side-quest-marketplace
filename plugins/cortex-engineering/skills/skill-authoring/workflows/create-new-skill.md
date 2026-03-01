# Workflow: Create a New Skill

## Context

Read before proceeding:
- [Recommended structure](references/recommended-structure.md) - directory layout
- [Skill structure](references/skill-structure.md) - SKILL.md body format
- [Core principles](references/core-principles.md) - design philosophy

## Process

### Step 1: Adaptive Requirements Gathering

**If user provided context** (e.g., "build a skill for X"):
- Analyze what's stated, what can be inferred, what's unclear
- Skip to asking about genuine gaps only

**If user just invoked skill without context:**
- Ask what they want to build

Ask 2-4 domain-specific questions based on actual gaps. Each question should:
- Have specific options with descriptions
- Focus on scope, complexity, outputs, boundaries
- NOT ask things obvious from context

Example questions:
- "What specific operations should this skill handle?" (with options based on domain)
- "Should this also handle [related thing] or stay focused on [core thing]?"
- "What should the user see when successful?"

After initial questions, present options:

1. **Proceed to building** - I have enough context
2. **Ask more questions** - There are more details to clarify
3. **Let me add details** - I want to provide additional context

### Step 2: Research Trigger (If External API)

**When external service detected**, ask:
"This involves [service name] API. Would you like me to research current endpoints and patterns before building?"

1. **Yes, research first** - Fetch current documentation for accurate implementation
2. **No, proceed with general patterns** - Use common patterns without specific API research

If research requested:
- Use Context7 MCP to fetch current library documentation
- Or use WebSearch for recent API documentation
- Focus on 2024-2026 sources
- Store findings for use in content generation

### Step 3: Decide Structure

**Simple skill (single workflow, <200 lines):**
- Single SKILL.md file with all content

**Complex skill (multiple workflows OR domain knowledge):**
- Router pattern:
```
skill-name/
├── SKILL.md (router + principles)
├── workflows/ (procedures - FOLLOW)
├── references/ (knowledge - READ)
├── templates/ (output structures - COPY + FILL)
└── scripts/ (reusable code - EXECUTE)
```

Factors favoring router pattern:
- Multiple distinct user intents (create vs debug vs ship)
- Shared domain knowledge across workflows
- Essential principles that must not be skipped
- Skill likely to grow over time

**Consider templates/ when:**
- Skill produces consistent output structures (plans, specs, reports)
- Structure matters more than creative generation

**Consider scripts/ when:**
- Same code runs across invocations (deploy, setup, API calls)
- Operations are error-prone when rewritten each time

See [recommended-structure.md](references/recommended-structure.md) for templates.

### Step 4: Create Directory

```bash
mkdir -p ~/.claude/skills/{skill-name}
# If complex:
mkdir -p ~/.claude/skills/{skill-name}/workflows
mkdir -p ~/.claude/skills/{skill-name}/references
# If needed:
mkdir -p ~/.claude/skills/{skill-name}/templates  # for output structures
mkdir -p ~/.claude/skills/{skill-name}/scripts    # for reusable code
```

### Step 5: Write SKILL.md

**Simple skill:** Write complete skill file with:
- YAML frontmatter (name, description)
- Objective paragraph under the heading
- Quick Start section
- Content sections with markdown headings
- Done When checklist

**Complex skill:** Write router with:
- YAML frontmatter
- Core Principles section (inline, unavoidable)
- Intake section (question to ask user)
- Routing table (maps answers to workflows)
- Domain Knowledge and Workflows sections

### Step 6: Write Workflows (if complex)

For each workflow:
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

## Success Criteria

- [ ] Criterion 1
- [ ] Criterion 2
```

### Step 7: Write References (if needed)

Domain knowledge that:
- Multiple workflows might need
- Doesn't change based on workflow
- Contains patterns, examples, technical details

### Step 8: Validate Structure

Check:
- [ ] YAML frontmatter valid
- [ ] Name matches directory (lowercase-with-hyphens)
- [ ] Description says what it does AND when to use it (third person)
- [ ] Uses markdown headings for structure (not XML tags)
- [ ] Required sections present: Quick Start, Success Criteria
- [ ] All referenced files exist
- [ ] SKILL.md under 500 lines

### Step 9: Create Slash Command

```bash
cat > ~/.claude/commands/{skill-name}.md << 'EOF'
---
description: {Brief description}
argument-hint: [{argument hint}]
allowed-tools: Skill({skill-name})
---

Invoke the {skill-name} skill for: $ARGUMENTS
EOF
```

### Step 10: Test

Invoke the skill and observe:
- Does it ask the right intake question?
- Does it load the right workflow?
- Does the workflow load the right references?
- Does output match expectations?

Iterate based on real usage, not assumptions.

## Success Criteria

- [ ] Requirements gathered with appropriate questions
- [ ] API research done if external service involved
- [ ] Directory structure correct
- [ ] SKILL.md has valid frontmatter
- [ ] Essential principles inline (if complex skill)
- [ ] Intake question routes to correct workflow
- [ ] All workflows have Context + Process + Success Criteria
- [ ] References contain reusable domain knowledge
- [ ] Slash command exists and works
- [ ] Tested with real invocation
