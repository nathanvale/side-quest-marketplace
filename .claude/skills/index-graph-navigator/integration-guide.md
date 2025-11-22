# Integration Guide

**How other skills use index-graph-navigator for token-efficient codebase navigation**

## Quick Start

Instead of reading 20K-50K tokens of code to understand structure, other skills query
index-graph-navigator and get 200-500 token JSON responses with exact file:line references.

**Token reduction**: 50-90% savings on codebase navigation tasks

---

## Core Integration Pattern

### Before (Token-Heavy Approach)

```markdown
# Skill reads entire files to understand structure

1. Read src/parser.ts (2000 tokens)
2. Read all imports (5000 tokens)
3. Analyze call patterns (3000 tokens) Total: 10,000+ tokens to find what calls parseDate()
```

### After (Token-Efficient with Navigator)

```markdown
# Skill queries navigator for structure

1. Skill(index-graph-navigator) query: "find-callers parseDate"
2. Returns JSON (200 tokens) with exact file:line references
3. Read ONLY those specific locations (1000 tokens) Total: 1,200 tokens (88% reduction!)
```

---

## Integration Method

### Syntax for Calling Skills

```
Skill(index-graph-navigator) with query:
{
  "query": "blast-radius",
  "target": "parseDate",
  "domain": "csv-processing"
}
```

Or natural language:

```
Use Skill(index-graph-navigator) to find the blast radius of parseDate in csv-processing domain
```

The navigator returns structured JSON that calling skill parses.

---

## Reference Documentation

For detailed integration information:

- **@integration-examples.md** - 5 skill integration examples (domain-analyzer, debug-assistant,
  refactor-planner, test-coverage-analyzer, dependency-auditor)
- **@integration-patterns.md** - Composability patterns and real-world workflows
- **@integration-best-practices.md** - Best practices, error handling, token metrics

---

## Token Savings Summary

| Use Case               | Without Navigator | With Navigator | Savings |
| ---------------------- | ----------------- | -------------- | ------- |
| Find callers           | 10K+ tokens       | 1.2K tokens    | 88%     |
| Debug error            | 20K+ tokens       | 2.2K tokens    | 90%     |
| Refactor planning      | 30K+ tokens       | 3.6K tokens    | 88%     |
| Test coverage analysis | 25K+ tokens       | 4K tokens      | 84%     |
| Dependency audit       | 50K+ tokens       | 2K tokens      | 96%     |

**Average**: 50-90% token reduction across all use cases
