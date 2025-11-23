# Combination Strategies

Multi-tool patterns for complex code analysis tasks.

---

## Strategy 1: Speed → Precision

Use fast tools to narrow candidates, then precise tools for verification.

**Workflow**:

```bash
# Step 1: Fast recon with ripgrep
rg -l 'useQuery\(' -t ts  # List files containing pattern

# Step 2: Precise analysis with ast-grep
cat file_list | xargs ast-grep run -l TypeScript -p 'useQuery($A)'
```

**When to use**:

- Large codebase (>100k lines)
- Need to find specific code patterns
- Want to avoid false positives

**Benefits**:

- Fastest overall time
- Low false positives
- Scalable to large repos

---

## Strategy 2: JSON → Code

Use JSON queries to find issues, then read code to understand why.

**Workflow**:

```bash
# Step 1: Find high-error endpoints with jq
jq '.errors | group_by(.endpoint) | map({endpoint: .[0].endpoint, count: length}) | sort_by(.count) | reverse' error-logs.json

# Step 2: Read code to understand why
Read: src/api/endpoints/users.ts  # Inspect the error-prone endpoint
```

**When to use**:

- Have JSON logs, configs, or structured data
- Need to understand failure patterns
- Looking for refactoring targets

**Benefits**:

- Data-driven insights
- Objective metrics
- Reveals runtime issues

---

## Strategy 3: Pattern → Metrics

Find code patterns, then calculate metrics on matches.

**Workflow**:

```bash
# Step 1: Find pattern with ast-grep
ast-grep run -l TypeScript -p 'any'  # All 'any' types

# Step 2: Calculate complexity with Python
python3 scripts/complexity.py --files matching_files.txt
```

**When to use**:

- Planning refactors
- Assessing code quality issues
- Prioritizing technical debt

**Benefits**:

- Quantify impact
- Data-driven prioritization
- Identify high-value fixes

---

## Strategy 4: Multi-Step Verification

Combine multiple tools to verify findings.

**Workflow**:

```bash
# Step 1: jq to find unused dependencies
jq '.dependencies | keys' package.json > all-deps.txt
rg -l 'from.*lodash' -t ts > used-deps.txt
comm -23 all-deps.txt used-deps.txt  # Find difference

# Step 2: ast-grep to verify not used via dynamic imports
ast-grep run -p 'import($X)'

# Step 3: Read code to check for edge cases
Read: src/dynamic-loader.ts

# Step 4: Sequential Thinking to assess removal safety
```

**When to use**:

- High-stakes changes (dependency removal)
- Need multiple confirmation sources
- Complex edge cases

**Benefits**:

- Highest confidence
- Catches edge cases
- Comprehensive analysis

---

## General Principles

1. **Start broad, narrow down**: rg/Glob → ast-grep → Read
2. **Use fastest tool first**: Save time by filtering early
3. **Verify with multiple sources**: Cross-check findings
4. **Think last**: Sequential Thinking after data collection
5. **JSON queries are fast**: Use jq for structured data first
