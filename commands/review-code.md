---
description:
  Comprehensive code review across 7 quality dimensions using parallel code-analyzer agents and
  PROJECT_INDEX.json graph analysis.
---

Perform a comprehensive code review using parallel code-analyzer agents.

**Scope Determination:**

Check argument "$1" (defaults to "all"):

- If "all": Review entire codebase (all \*.ts files)
- If matches C[0-9]{2}: Load domain from `.claude/state/task-streams/component-manager.json`
  - Extract domain name and file patterns for that component code
  - If component file not found, show error and exit

**Review Execution:**

Launch 7 code-analyzer agents IN PARALLEL (single message with 7 Task calls):

1. **Code Quality**: "Focus on Code Quality for files matching {pattern}. Output structured JSON
   with category, findings array (issue, location, severity, stink_index, recommendation), and
   stats."

2. **Performance**: "Focus on Performance for files matching {pattern}. Output structured JSON with
   category, findings array (issue, location, severity, stink_index, recommendation), and stats."

3. **Security/Safety**: "Focus on Security/Safety for files matching {pattern}. Output structured
   JSON with category, findings array (issue, location, severity, stink_index, recommendation), and
   stats."

4. **Architecture**: "Focus on Architecture for files matching {pattern}. Output structured JSON
   with category, findings array (issue, location, severity, stink_index, recommendation), and
   stats."

5. **Impact Analysis**: "Focus on Impact Analysis for files matching {pattern}. Output structured
   JSON with category, findings array (issue, location, severity, stink_index, recommendation), and
   stats."

6. **Domain Health**: "Focus on Domain Health for files matching {pattern}. Output structured JSON
   with category, findings array (issue, location, severity, stink_index, recommendation), and
   stats."

7. **Documentation**: "Focus on Documentation for files matching {pattern}. Output structured JSON
   with category, findings array (issue, location, severity, stink_index, recommendation), and
   stats."

**Important**: Launch all 7 agents in a SINGLE response using 7 Task tool calls. This enables
parallel execution for 7x speedup.

**Result Aggregation:**

After all 7 agents complete:

1. Parse the 7 JSON outputs from each agent
2. Deduplicate findings (same file:line across categories)
3. Calculate overall health score (weighted average of category scores)
4. Sort findings by severity (P0 → P1 → P2 → P3)
5. Generate unified markdown report

**Report Format:**

```markdown
# Code Review Report: {Domain}

## Executive Summary

- Scope: {files analyzed}
- Overall Health Score: {score}/100
- Critical Issues (P0): {count}
- High Priority (P1): {count}
- Medium Priority (P2): {count}
- Low Priority (P3): {count}

## Findings by Category

### 1. Code Quality ({issue count})

**P0 Issues:**

- {issue}: {location}
  - StinkIndex: {score}/10
  - Recommendation: {action}

**P1 Issues:** [... list P1 findings ...]

**P2 Issues:** [... list P2 findings ...]

**P3 Issues:** [... list P3 findings ...]

### 2. Performance ({issue count})

[... same structure ...]

### 3. Security/Safety ({issue count})

[... same structure ...]

### 4. Architecture ({issue count})

[... same structure ...]

### 5. Impact Analysis ({issue count})

[... same structure ...]

### 6. Domain Health ({issue count})

[... same structure ...]

### 7. Documentation ({issue count})

[... same structure ...]

## Top 10 Actionable Recommendations

1. [Highest impact fix with file:line]
2. [Second priority fix with file:line]
3. [...]
```

**Prerequisites:**

- PROJECT_INDEX.json must exist in project root (run `/index` if missing)
- code-analyzer agent must have Code Review Category Framework
- For domain-specific: `.claude/state/task-streams/component-manager.json` must exist

**Example Usage:**

```bash
# Full codebase review
/review-code
/review-code all

# Domain-specific reviews
/review-code C01  # Review CSV Adapters only
/review-code C11  # Review Migration Pipelines only
```
