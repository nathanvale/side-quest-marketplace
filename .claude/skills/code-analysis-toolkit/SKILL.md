---
name: code-analysis-toolkit
description:
  Provides tool selection guidance for code analysis using rg, ast-grep, jq, Glob, Read, and
  Sequential Thinking. Use when analyzing .ts, .js, .py, or other source files and need to choose
  the right search/analysis tool, combine multiple tools for complex workflows, or handle edge cases
  in code refactoring. Mention 'which tool', 'search vs grep', 'ast-grep vs ripgrep', or 'combine
  tools' to trigger. Primary consumers are code analysis agents.
tools: Read
---

# Code Analysis Toolbox

**Quick reference for agents analyzing code**

## Quick Start

**Primary consumers**: Code analysis agents (index-graph-reviewer, code-analyzer)

**When to use**:

- Need to choose between rg, ast-grep, jq, Glob, or Read for a task
- Combining multiple tools for complex analysis
- Understanding tool trade-offs (speed vs precision)
- Handling edge cases in code search/refactoring

**How to invoke**: Agents should reference this skill when deciding which tool(s) to use for code
analysis tasks.

**Typical workflow**:

1. Check Decision Tree for your task
2. Review tool details in @tool-catalog.md
3. Use @combination-strategies.md for multi-step analysis
4. See @workflows.md for complete examples

---

## Quick Decision Tree

```
NEED: Find text/strings (TODOs, log lines, config values)
  → Use: rg (ripgrep) - Fastest text search

NEED: Find code structure (ignore comments/strings)
  → Use: ast-grep - AST-aware, precise matches

NEED: Refactor/rewrite code safely
  → Use: ast-grep - Structural rewrites with confidence

NEED: Find files by pattern
  → Use: Glob tool - File pattern matching (*.ts, src/**/*.tsx)

NEED: Understand code logic deeply
  → Use: Read + Sequential Thinking - Deep analysis

NEED: Find functions by name across codebase
  → Combine: rg to shortlist files → ast-grep for precision
```

---

## Tool Catalog Summary

For detailed usage, examples, pros/cons, see @tool-catalog.md

| Tool                    | Purpose                  | Best For                                 | Speed       |
| ----------------------- | ------------------------ | ---------------------------------------- | ----------- |
| **rg (ripgrep)**        | Fast text search         | Strings, TODOs, reconnaissance           | ⚡️ Fastest |
| **ast-grep**            | Structural code search   | Refactors, policy checks, safe rewrites  | 🐢 Slower   |
| **Grep Tool**           | Claude-integrated search | Pattern search with context              | 🐢 Medium   |
| **Glob Tool**           | File pattern matching    | Find files by name/pattern               | ⚡️ Fastest |
| **jq**                  | JSON query processor     | Parse configs, logs, API responses       | ⚡️ Fast    |
| **Python Scripts**      | Complex algorithms       | Complexity, metrics, dependency analysis | 🐢 Medium   |
| **Read Tool**           | Source code inspection   | Deep analysis, verify issues             | 🐢 Slow     |
| **Sequential Thinking** | Structured reasoning     | Understand "why", edge cases, impact     | 🐢 Slowest  |

---

## Mental Models

### Unit of Match

- **ast-grep**: AST node (structural)
- **rg/Grep**: Line (textual)
- **jq**: Graph edge (relational)
- **Glob**: File path (filesystem)

### False Positives

- **ast-grep**: Low (ignores comments/strings)
- **rg/Grep**: Medium-High (depends on regex precision)
- **jq**: Low (structured data)
- **Sequential Thinking**: N/A (human reasoning)

### Rewrites (safest to riskiest)

1. **ast-grep** - First-class, structural (safest)
2. **Manual Edit** - Precise, controlled
3. **sed/awk** - Text manipulation (risky on code)

---

## Best Practices

✅ **DO**:

- Start with fastest tool (rg/Glob), narrow down candidates
- Use ast-grep for code-specific patterns (ignore comments)
- Combine tools: rg → ast-grep → Read → Sequential Thinking
- Use jq for graph queries on domain indices
- Use ast-grep for safe rewrites

❌ **DON'T**:

- Use rg for code refactoring (unsafe on comments/strings)
- Use ast-grep for finding TODOs/strings (use rg)
- Skip Sequential Thinking for complex issues
- Use Read tool to search (use Grep/rg first)
- Load entire files when grep can filter first

---

## Decision Matrix

| Task                     | Tool                       | Reason                  |
| ------------------------ | -------------------------- | ----------------------- |
| Find string in any file  | rg                         | Fastest                 |
| Find code pattern        | ast-grep                   | Structural precision    |
| Find files by name       | Glob                       | Pattern matching        |
| Parse JSON configs/logs  | jq                         | Fast structured queries |
| Calculate complexity     | Python                     | Statistical analysis    |
| Understand code logic    | Read + Sequential Thinking | Deep analysis           |
| Refactor code            | ast-grep                   | Safe rewrites           |
| Analyze error patterns   | jq (logs)                  | JSON query              |
| Find unused dependencies | jq + rg + ast-grep         | Multi-step verification |
| Check documentation      | Read                       | Inspect comments/JSDoc  |

---

**When in doubt**: Start broad (rg/Glob), narrow with precision (ast-grep/jq), verify with depth
(Read + Sequential Thinking).

---

## See Also

- @tool-catalog.md - Detailed tool descriptions, examples, pros/cons
- @combination-strategies.md - Multi-tool patterns (Speed→Precision, JSON→Code, Pattern→Metrics)
- @workflows.md - Complete workflows (Unused Dependencies, Type Safety, Refactor APIs, Performance,
  Security)
- @examples.md - Code examples for all tools
