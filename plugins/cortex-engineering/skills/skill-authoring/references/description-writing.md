# Description Writing

The description field is the **sole input** to Claude's skill selection reasoning. There is no algorithmic routing, no embedding similarity, no keyword index. Description writing is prompt engineering, not metadata tagging.

## The WHAT + WHEN + WHEN NOT Pattern

Every description must answer two or three questions:

1. **What does it do?** (capability statement)
2. **When should it be used?** (trigger conditions)
3. **When should it NOT be used?** (negative boundaries -- optional but critical for disambiguation)

### Template

```
[Verb-led capability statement, 1-2 sentences].
Use when [trigger 1], [trigger 2], or when user mentions [keyword1], [keyword2].
[Optional: even if they don't explicitly ask for X.]
[Optional: Do NOT use for [adjacent domain], [competing skill's territory].]
```

### Good Examples

**Exhaustive trigger + negative boundary (docx, 580 chars):**
```yaml
description: "Use this skill whenever the user wants to create, read, edit, or
manipulate Word documents (.docx files). Triggers include: any mention of
'Word doc', 'word document', '.docx', or requests to produce professional
documents with formatting like tables of contents, headings, page numbers...
Do NOT use for PDFs, spreadsheets, Google Docs, or general coding tasks
unrelated to document generation."
```

**Clean WHAT+WHEN:**
```yaml
description: Explains code with visual diagrams and analogies. Use when
explaining how code works, teaching about a codebase, or when the user
asks "how does this work?"
```

**Sub-agent role + directive:**
```yaml
description: Expert code review specialist. Proactively reviews code for
quality, security, and maintainability. Use immediately after writing
or modifying code.
```

### Bad Examples

```yaml
description: Helps with documents            # No capabilities, no triggers
description: Processes data                  # Too generic
description: I can help you process files    # Wrong person (must be third person)
```

## The "Pushy" Pattern

Anthropic's `skill-creator` skill explicitly addresses under-triggering:

> "Currently Claude has a tendency to 'undertrigger' skills -- to not use them when they'd be useful. To combat this, please make the skill descriptions a little bit 'pushy'."

Instead of passive descriptions, be assertive:

```yaml
# Passive (undertriggers)
description: How to build dashboards to display data.

# Pushy (better activation)
description: How to build dashboards to display data. Make sure to use
this skill whenever the user mentions dashboards, data visualization,
internal metrics, or wants to display any kind of data, even if they
don't explicitly ask for a dashboard.
```

**Caution:** community reports mixed results with "MUST BE USED" and "NON-NEGOTIABLE" language. Be pushy, not coercive -- explain why, not just demand compliance.

## The Negative Scope Pattern

The WHEN NOT clause prevents false positive activations, especially critical when you have multiple skills with overlapping vocabulary.

```yaml
# docx skill
description: "...Do NOT use for PDFs, spreadsheets, Google Docs, or general
coding tasks unrelated to document generation."

# xlsx skill
description: "...Do NOT trigger when the primary deliverable is a Word document,
HTML report, standalone Python script, database pipeline, or Google Sheets
API integration, even if tabular data is involved."
```

## Third-Person POV is a Hard Rule

Descriptions are injected into the system prompt. Using first/second person confuses Claude's self-model.

```yaml
# Bad
description: I help you write code
description: Helps you with documents

# Good
description: Processes Excel files and generates pivot tables
```

## Skill vs Sub-Agent Description Patterns

| Aspect | Skill Description | Sub-Agent Description |
|--------|------------------|----------------------|
| Lead with | Capability verbs | Role identity |
| Trigger phrase | "Use when..." | "Use proactively..." |
| Required | Recommended | Required (name + description both required) |

**Skill template:**
```
[Verb-led capability statement]. Use when [triggers].
```

**Sub-agent template:**
```
[Role identity]. [Proactive action directive]. Use proactively when [conditions].
```

## The "Use Proactively" Directive

For sub-agents, include proactive triggers:

| Phrase | Use Case |
|--------|----------|
| `Use proactively` | Encourage automatic delegation |
| `Use immediately after` | Time-based trigger |
| `Use when encountering` | Condition-based trigger |
| `Make sure to use this skill whenever` | Pushy activation |
| `even if they don't explicitly ask` | Edge case coverage |

## Description Length Optimization

**Hard limit:** 1024 characters max (validation-enforced).

| Situation | Length | Include WHEN NOT | Pushy Language |
|-----------|--------|------------------|----------------|
| Unique skill, no competition | 150-250 chars | No | No |
| Multiple similar skills | 400-600 chars | Yes | Moderate |
| Critical workflow skill | 300-500 chars | Optional | Yes |
| Sub-agent | 100-200 chars | No | Yes |
| Background knowledge skill | 150-300 chars | No | No |

## Keyword Strategy

- **Front-load capabilities:** "Extract text and tables from PDF files..." not "A tool that helps with..."
- **Include file extensions:** `.pdf`, `.docx`, `.xlsx`
- **Include user synonyms:** "deck" for presentations, "spreadsheet" for Excel
- **Include action verbs users say:** "create", "edit", "merge", "fill"
- **Include domain concepts:** "pivot tables", "tracked changes", "form filling"

## Description Anti-Patterns

| Anti-Pattern | Why It Fails | Fix |
|-------------|-------------|-----|
| Too vague: "Helps with documents" | Matches everything or nothing | Add specific file types, actions, contexts |
| Too generic: "Processes data" | Claude can do this without skills | Specify what kind of data and processing |
| First/second person | Confuses Claude's self-model | Third person always |
| Missing WHEN clause | Tells what but not when | Add "Use when working with..." |
| Overlapping vocabulary | Claude can't disambiguate | Add WHEN NOT clauses |
| Too short (<50 chars) | Insufficient routing signal | Expand with capabilities and triggers |
| Body-only triggers | Body isn't loaded during routing | Move trigger keywords into description |
