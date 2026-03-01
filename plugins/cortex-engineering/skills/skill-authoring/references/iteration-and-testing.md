# Iteration and Testing

## Overview

Skills improve through iteration and testing. This reference covers evaluation-driven development, Claude A/B testing patterns, and structure validation during testing.

## Evaluation-Driven Development

Create evaluations BEFORE writing extensive documentation. This ensures your skill solves real problems rather than documenting imagined ones.

### Workflow

1. **Identify gaps**: Run Claude on representative tasks without a skill. Document specific failures or missing context.
2. **Create evaluations**: Build three scenarios that test these gaps.
3. **Establish baseline**: Measure Claude's performance without the skill.
4. **Write minimal instructions**: Create just enough content to address the gaps and pass evaluations.
5. **Iterate**: Execute evaluations, compare against baseline, and refine.

### Evaluation Structure

```json
{
  "skills": ["pdf-processing"],
  "query": "Extract all text from this PDF file and save it to output.txt",
  "files": ["test-files/document.pdf"],
  "expected_behavior": [
    "Successfully reads the PDF file using appropriate library",
    "Extracts text content from all pages without missing any",
    "Saves extracted text to output.txt in clear, readable format"
  ]
}
```

### Why Evaluations First

- Prevents documenting imagined problems
- Forces clarity about what success looks like
- Provides objective measurement of skill effectiveness
- Keeps skill focused on actual needs
- Enables quantitative improvement tracking

## Iterative Development with Claude

The most effective skill development uses Claude itself. Work with "Claude A" (expert who helps refine) to create skills used by "Claude B" (agent executing tasks).

### Creating Skills

1. **Complete task without skill**: Work through problem with Claude A, noting what context you repeatedly provide.
2. **Ask Claude A to create skill**: "Create a skill that captures this pattern we just used"
3. **Review for conciseness**: Remove unnecessary explanations.
4. **Improve architecture**: Organize content with progressive disclosure.
5. **Test with Claude B**: Use fresh instance to test on real tasks.
6. **Iterate based on observation**: Return to Claude A with specific issues observed.

Claude models understand skill format natively. Simply ask Claude to create a skill and it will generate properly structured SKILL.md content.

### Improving Skills

1. **Use skill in real workflows**: Give Claude B actual tasks.
2. **Observe behavior**: Where does it struggle, succeed, or make unexpected choices?
3. **Return to Claude A**: Share observations and current SKILL.md.
4. **Review suggestions**: Claude A might suggest reorganization, stronger language, or workflow restructuring.
5. **Apply and test**: Update skill and test again.
6. **Repeat**: Continue based on real usage, not assumptions.

### What to Watch For

- **Unexpected exploration paths**: Structure might not be intuitive
- **Missed connections**: Links might need to be more explicit
- **Overreliance on sections**: Consider moving frequently-read content to main SKILL.md
- **Ignored content**: Poorly signaled or unnecessary files
- **Critical metadata**: The name and description in your skill's metadata are critical for discovery

## Model Testing

Test with all models you plan to use. Different models have different strengths and need different levels of detail.

### Haiku Testing

**Claude Haiku** (fast, economical)

Questions to ask:
- Does the skill provide enough guidance?
- Are examples clear and complete?
- Do implicit assumptions become explicit?
- Does Haiku need more structure?

Haiku benefits from:
- More explicit instructions
- Complete examples (no partial code)
- Clear success criteria
- Step-by-step workflows

### Sonnet Testing

**Claude Sonnet** (balanced)

Questions to ask:
- Is the skill clear and efficient?
- Does it avoid over-explanation?
- Are workflows well-structured?
- Does progressive disclosure work?

Sonnet benefits from:
- Balanced detail level
- Clear structure for clarity
- Progressive disclosure
- Concise but complete guidance

### Opus Testing

**Claude Opus** (powerful reasoning)

Questions to ask:
- Does the skill avoid over-explaining?
- Can Opus infer obvious steps?
- Are constraints clear?
- Is context minimal but sufficient?

Opus benefits from:
- Concise instructions
- Principles over procedures
- High degrees of freedom
- Trust in reasoning capabilities

### Balancing Across Models

What works for Opus might need more detail for Haiku. Aim for instructions that work well across all target models. Find the balance that serves your target audience.

See [core-principles.md](core-principles.md) for model testing examples.

## Structure Validation

During testing, validate that your skill's structure is correct and complete.

### Validation Checklist

After updating a skill, verify:

#### Required Sections Present
- Objective statement (heading or opening paragraph)
- Quick Start section with immediate guidance
- Success criteria or Done When section

#### Markdown Structure
- Uses markdown headings for section structure
- No XML structural tags in skill body
- Markdown formatting within sections is preserved (bold, italic, lists, code blocks)

#### Proper Heading Hierarchy
- Single `#` heading for skill name
- `##` for major sections
- `###` for subsections
- Consistent hierarchy throughout

#### Reference Files Check
- Reference files use markdown structure
- Links to reference files are correct
- References are one level deep from SKILL.md

### Testing Structure During Iteration

When iterating on a skill:

1. Make changes to structure
2. **Validate structure** (check headings, sections, completeness)
3. Test with Claude on representative tasks
4. Observe if structure aids or hinders Claude's understanding
5. Iterate structure based on actual performance

## Observation-Based Iteration

Iterate based on what you observe, not what you assume. Real usage reveals issues assumptions miss.

### Observation Categories

**What Claude reads**: Which sections does Claude actually read? Which are ignored? This reveals:
- Relevance of content
- Effectiveness of progressive disclosure
- Whether section names are clear

**Where Claude struggles**: Which tasks cause confusion or errors? This reveals:
- Missing context
- Unclear instructions
- Insufficient examples
- Ambiguous requirements

**Where Claude succeeds**: Which tasks go smoothly? This reveals:
- Effective patterns
- Good examples
- Clear instructions
- Appropriate detail level

**Unexpected behaviors**: What does Claude do that surprises you? This reveals:
- Unstated assumptions
- Ambiguous phrasing
- Missing constraints
- Alternative interpretations

### Iteration Pattern

1. **Observe**: Run Claude on real tasks with current skill
2. **Document**: Note specific issues, not general feelings
3. **Hypothesize**: Why did this issue occur?
4. **Fix**: Make targeted changes to address specific issues
5. **Test**: Verify fix works on same scenario
6. **Validate**: Ensure fix doesn't break other scenarios
7. **Repeat**: Continue with next observed issue

## Progressive Refinement

Skills don't need to be perfect initially. Start minimal, observe usage, add what's missing.

### Initial Version

Start with:
- Valid YAML frontmatter
- Required sections: objective, Quick Start, success criteria
- Minimal working example
- Basic success criteria

Skip initially:
- Extensive examples
- Edge case documentation
- Advanced features
- Detailed reference files

### Iteration Additions

Add through iteration:
- Examples when patterns aren't clear from description
- Edge cases when observed in real usage
- Advanced features when users need them
- Reference files when SKILL.md approaches 500 lines
- Validation scripts when errors are common

### Benefits

- Faster to initial working version
- Additions solve real needs, not imagined ones
- Keeps skills focused and concise
- Progressive disclosure emerges naturally
- Documentation stays aligned with actual usage

## Testing Discovery

Test that Claude can discover and use your skill when appropriate.

### Discovery Testing

1. Start fresh conversation (Claude B)
2. Ask question that should trigger skill
3. Check if skill was loaded
4. Verify skill was used appropriately

### Description Quality

If skill isn't discovered:
- Check description includes trigger keywords
- Verify description is specific, not vague
- Ensure description explains when to use skill
- Test with different phrasings of the same request

The description is Claude's primary discovery mechanism.

## Common Iteration Patterns

### Too Verbose

**Observation:** Skill works but uses lots of tokens

**Fix:**
- Remove obvious explanations
- Assume Claude knows common concepts
- Use examples instead of lengthy descriptions
- Move advanced content to reference files

### Too Minimal

**Observation:** Claude makes incorrect assumptions or misses steps

**Fix:**
- Add explicit instructions where assumptions fail
- Provide complete working examples
- Define edge cases
- Add validation steps

### Poor Discovery

**Observation:** Skill exists but Claude doesn't load it when needed

**Fix:**
- Improve description with specific triggers
- Add relevant keywords
- Test description against actual user queries
- Make description more specific about use cases

### Unclear Structure

**Observation:** Claude reads wrong sections or misses relevant content

**Fix:**
- Use clearer heading names
- Reorganize content hierarchy
- Move frequently-needed content earlier
- Add explicit links to relevant sections

### Incomplete Examples

**Observation:** Claude produces outputs that don't match expected pattern

**Fix:**
- Add more examples showing pattern
- Make examples more complete
- Show edge cases in examples
- Add anti-pattern examples (what not to do)

## Iteration Velocity

Small, frequent iterations beat large, infrequent rewrites.

### Fast Iteration (Good)

1. Make one targeted change
2. Test on specific scenario
3. Verify improvement
4. Commit change
5. Move to next issue

Total time: Minutes per iteration. Iterations per day: 10-20. Learning rate: High.

### Slow Iteration (Problematic)

1. Accumulate many issues
2. Make large refactor
3. Test everything at once
4. Debug multiple issues simultaneously
5. Hard to know what fixed what

Total time: Hours per iteration. Iterations per day: 1-2. Learning rate: Low.

### Benefits of Fast Iteration

- Isolate cause and effect
- Build pattern recognition faster
- Less wasted work from wrong directions
- Easier to revert if needed
- Maintains momentum

## Success Metrics

Define how you'll measure if the skill is working. Quantify success.

### Objective Metrics

- **Success rate**: Percentage of tasks completed correctly
- **Token usage**: Average tokens consumed per task
- **Iteration count**: How many tries to get correct output
- **Error rate**: Percentage of tasks with errors
- **Discovery rate**: How often skill loads when it should

### Subjective Metrics

- **Output quality**: Does output meet requirements?
- **Appropriate detail**: Too verbose or too minimal?
- **Claude confidence**: Does Claude seem uncertain?
- **User satisfaction**: Does skill solve the actual problem?

### Tracking Improvement

Compare metrics before and after changes:
- Baseline: Measure without skill
- Initial: Measure with first version
- Iteration N: Measure after each change

Track which changes improve which metrics. Double down on effective patterns.
