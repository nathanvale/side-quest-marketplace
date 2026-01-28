---
name: para-classifier
description: Analyze and classify inbox items using PARA methodology. Use when triage or distill skills need decision trees, emoji mappings, and philosophy guides for consistent categorization.
user-invocable: false
allowed-tools: []
---

# PARA Classifier

**Reference skill for inbox classification** - Provides decision trees, emoji mappings, and PARA philosophy guidance for triage and distill skills.

This is not a user-facing skill. Other skills load these references to make consistent classification decisions.

---

## What This Skill Provides

1. **PARA Philosophy** - Tiago Forte's core principles for organizing knowledge
2. **Classification Decision Tree** - Flowchart for inbox → PARA routing
3. **Emoji Mapping** - `source_format` to emoji conversion
4. **Type Disambiguation** - Clarify resources vs records vs archives
5. **Real-World Examples** - Concrete classification scenarios

---

## When to Load This Skill

Load these references when you need to:

- **Classify inbox items** - Is this a resource, meeting, booking, or archive?
- **Choose emojis** - What emoji matches this source_format?
- **Resolve ambiguity** - Is this knowledge to distill or a transaction record?
- **Apply PARA principles** - What would Tiago Forte do?

---

## Reference Files

| File | Purpose |
|------|---------|
| [para-philosophy.md](references/para-philosophy.md) | Core PARA concepts and the "Future You" test |
| [classification-decision-tree.md](references/classification-decision-tree.md) | Flowchart for classification decisions |
| [emoji-mapping.md](references/emoji-mapping.md) | source_format → emoji lookup table |
| [type-disambiguation.md](references/type-disambiguation.md) | Resources vs records clarification |
| [examples.md](references/examples.md) | Real-world classification scenarios |

---

## Usage Pattern

**In other skills:**

```markdown
Load PARA classification guidance when needed:

For classification decisions, see:
- @../para-classifier/references/classification-decision-tree.md
- @../para-classifier/references/emoji-mapping.md

For PARA philosophy, see:
- @../para-classifier/references/para-philosophy.md
```

---

## Key Principles

1. **Resources are for learning** - Knowledge to distill for future use
2. **Records are for reference** - Transactions, events, dates
3. **Archives are cold storage** - Completed or no longer relevant
4. **Emojis enhance discoverability** - Visual cues for content type
5. **Future You is the customer** - Design for scanability

---

## Quick Reference

**Resource indicators:**
- Knowledge to extract/learn
- No specific date/transaction
- Distillable content (article, video, book)

**Record indicators:**
- Has date/time
- Transaction or event
- Meeting notes, bookings, invoices

**Archive indicators:**
- Completed projects
- Outdated information
- No future relevance

---

## External Resources

- [Building a Second Brain](https://www.buildingasecondbrain.com/) - Tiago Forte's book
- [PARA Method](https://fortelabs.com/blog/para/) - Official explanation
- [Progressive Summarization](https://fortelabs.com/blog/progressive-summarization-a-practical-technique-for-designing-discoverable-notes/) - Distillation technique
