# index-graph-navigator

**Token-efficient graph navigation for AI agents**

Navigate PROJECT_INDEX.json to analyze code dependencies, find dead code, detect circular
dependencies, and trace error propagation paths—all without loading 20K-50K tokens of code into
context.

## Quick Start

```bash
# Find hotspot functions (most-connected, highest change risk)
bash scripts/hotspots.sh --limit 10 --json

# Find who calls a function
bash scripts/find-callers.sh parseDate --json

# Find what a function calls
bash scripts/find-calls.sh migrateAttachments --json

# Find blast radius (all affected functions if X changes)
python3 scripts/blast-radius.py showError --depth 3 --json

# Detect circular dependencies
python3 scripts/cycles.py --json

# Trace error propagation (how execution reaches file:line)
python3 scripts/trace-to-error.py apps/cli/src/main.ts 512 --json

# Find dead code (functions never called)
bash scripts/dead-code.sh --limit 20 --json

# Analyze cross-domain coupling
python3 scripts/cross-domain.py csv-processing --json
```

---

## Cookbook: Copy-Paste Ready Workflows

### 1. Debug Error Propagation

**Scenario**: "I have an error at line 512 in cli.ts, how did execution get here?"

```bash
# Step 1: Find call stacks to the error location
python3 scripts/trace-to-error.py apps/migration-cli/src/cli.ts 512 --json

# Step 2: Analyze blast radius of the function at that line
python3 scripts/blast-radius.py showError --json

# Step 3: Find what the error function calls
bash scripts/find-calls.sh showError --json
```

**Expected Output**: 10 call paths, 19 affected functions, full dependency tree

**Token Savings**: 90% (2.2K tokens vs 20K+ reading files)

---

### 2. Refactor Planning (Impact Assessment)

**Scenario**: "I want to refactor isNonEmpty, is it safe?"

```bash
# Step 1: Find hotspots to identify high-risk functions
bash scripts/hotspots.sh --limit 5 --json

# Step 2: Analyze blast radius for the target function
python3 scripts/blast-radius.py isNonEmpty --depth 2 --json

# Step 3: Check domain coupling (external dependencies)
python3 scripts/cross-domain.py csv-processing --json
```

**Expected Output**:

- isNonEmpty has 9 direct callers
- 13 total affected functions (includes indirect)
- Minimal external dependencies (good isolation)

**Risk Assessment**: Medium (9 callers) - proceed with caution

**Token Savings**: 88% (3.6K tokens vs 30K+ reading code)

---

### 3. Code Cleanup Campaign

**Scenario**: "Find dead code and circular dependencies to clean up"

```bash
# Step 1: Detect all circular dependencies
python3 scripts/cycles.py --json

# Step 2: Find dead code (functions never called)
bash scripts/dead-code.sh --limit 20 --json

# Step 3: Verify dead code isn't actually needed
# For each candidate, check if it's in cycles or has callers
bash scripts/find-callers.sh accountRepository --json
```

**Expected Output**:

- 4 circular dependencies (menu loop, self-recursion)
- 51+ dead code candidates
- Verification shows true dead code vs alternative implementations

**Action Items**: Remove verified dead code, review cycles for refactoring

**Token Savings**: 90% (5K tokens vs 50K+ analyzing all files)

---

### 4. Dependency Analysis (Build Dependency Tree)

**Scenario**: "What does mapCsvRowToReferralForm depend on?"

```bash
# Step 1: Find who calls this function (reverse dependencies)
bash scripts/find-callers.sh mapCsvRowToReferralForm --json

# Step 2: Find what it calls (forward dependencies)
bash scripts/find-calls.sh mapCsvRowToReferralForm --json

# Step 3: Build full dependency tree (recurse through dependencies)
# For each dependency found in Step 2:
bash scripts/find-calls.sh parseDate --json
bash scripts/find-calls.sh parseBoolean --json
bash scripts/find-calls.sh parseNumber --json
```

**Expected Output**:

- 1 caller (extractWorker)
- 3 dependencies (parseDate, parseBoolean, parseNumber)
- All dependencies are leaf utilities (no further deps)

**Architecture Assessment**: Good isolation, minimal coupling

---

### 5. Multi-Level Impact Analysis

**Scenario**: "What's the cascade effect if I change executeCommand?"

```bash
# Step 1: Level 1 impact (direct callers only)
python3 scripts/blast-radius.py executeCommand --depth 1 --json

# Step 2: Level 2 impact (indirect callers)
python3 scripts/blast-radius.py executeCommand --depth 2 --json

# Step 3: Full cascade (unlimited depth)
python3 scripts/blast-radius.py executeCommand --json
```

**Expected Output**:

- Depth 1: 7 direct callers
- Depth 2: 10 total affected functions
- Depth 3: 12 total affected functions
- Depth 4: 13 total affected functions (stabilizes)

**Risk Assessment**: Medium-High (13 affected functions across 4 levels)

**Decision**: Refactor with comprehensive test coverage

---

### 6. Domain Coupling Analysis

**Scenario**: "Which domains are tightly coupled to core-cli?"

```bash
# Step 1: Analyze csv-processing domain coupling
python3 scripts/cross-domain.py csv-processing --json

# Step 2: Analyze core-cli domain coupling
python3 scripts/cross-domain.py core-cli --json

# Step 3: Analyze migration-pipelines coupling
python3 scripts/cross-domain.py migration-pipelines --json
```

**Expected Output**:

- csv-processing: 1 external dependency (core-cli → isNonEmpty)
- core-cli: Central hub (many domains depend on it)
- migration-pipelines: 3 external dependencies

**Architecture Quality**: Excellent (csv-processing well isolated, core-cli is stable utility layer)

**Recommendation**: Stabilize core-cli before major changes to other domains

---

### 7. Hotspot Identification (Change Risk Analysis)

**Scenario**: "Which functions have the highest change risk?"

```bash
# Step 1: Find top 10 hotspots (most connected functions)
bash scripts/hotspots.sh --limit 10 --json

# Step 2: For each hotspot, get blast radius
python3 scripts/blast-radius.py showError --json
python3 scripts/blast-radius.py isNonEmpty --json
python3 scripts/blast-radius.py executeCommand --json

# Step 3: Check if hotspots are in circular dependencies
python3 scripts/cycles.py --json | grep -E "showError|isNonEmpty|executeCommand"
```

**Expected Output**:

- showError: 19 callers (critical error handler)
- isNonEmpty: 9 callers (core validation utility)
- executeCommand: 7 callers (CLI dispatcher)

**Risk Ranking**:

1. showError - HIGH (19 callers, error path)
2. isNonEmpty - MEDIUM (9 callers, validation)
3. executeCommand - MEDIUM (7 callers, dispatcher)

**Action**: Add comprehensive tests before touching these functions

---

### 8. Test Coverage Planning

**Scenario**: "Where should I focus test coverage efforts?"

```bash
# Step 1: Find hotspots (high-risk functions)
bash scripts/hotspots.sh --limit 10 --json

# Step 2: Find dead code (potentially untested)
bash scripts/dead-code.sh --json

# Step 3: Cross-reference hotspots with test coverage
# (Manual step: check if hotspots have corresponding test files)

# Step 4: Find circular dependencies (complex to test)
python3 scripts/cycles.py --json
```

**Expected Output**:

- 10 hotspot functions needing priority test coverage
- 51+ dead code candidates (potentially zero tests)
- 4 circular dependencies (need integration tests)

**Test Plan**:

1. **Priority 1**: Hotspot functions (19 callers for showError)
2. **Priority 2**: Functions in circular dependencies (menu loop)
3. **Priority 3**: Dead code verification (are they really unused?)

**Coverage Goal**: 100% for hotspots, integration tests for cycles

---

## Available Queries

| Query              | Purpose                     | Performance | Tool    |
| ------------------ | --------------------------- | ----------- | ------- |
| **hotspots**       | Most-connected functions    | ~100ms      | Bash/jq |
| **find-callers**   | Direct reverse dependencies | ~20ms       | Bash/jq |
| **find-calls**     | Direct forward dependencies | ~20ms       | Bash/jq |
| **blast-radius**   | Transitive callers (BFS)    | ~300ms      | Python  |
| **trace-to-error** | Call stacks to file:line    | ~400ms      | Python  |
| **cycles**         | Circular dependencies (DFS) | ~500ms      | Python  |
| **dead-code**      | Functions never called      | ~200ms      | Bash/jq |
| **cross-domain**   | External dependencies       | ~150ms      | Python  |

---

## Output Format

All queries return **JSON** with consistent structure:

```json
{
  "query": "blast-radius",
  "results": [{ "depth": 1, "file": "src/parser.ts", "function": "mapRow", "line": 272 }],
  "status": "success",
  "summary": { "max_depth": 3, "total": 47 },
  "target": "parseDate"
}
```

**Error Format**:

```json
{
  "error": "Function 'parsDate' not found",
  "hint": "Use 'function-lookup' query to search all domains",
  "status": "error",
  "suggestions": ["parseDate", "parseData"]
}
```

---

## Performance Characteristics

See @performance.md for detailed performance data, optimization strategies, and scalability
analysis.

**Quick Reference**:

- Simple queries (find-callers, hotspots): ~20-200ms
- Complex queries (blast-radius, cycles): ~300-1000ms
- Token savings: 50-90% vs reading full files

---

## Common Workflows

### Debug Workflow

```
trace-to-error (file:line) → blast-radius → find-calls
```

**Use Case**: "I have an error, how did execution get here and what's affected?"

### Refactor Workflow

```
hotspots → blast-radius → cross-domain
```

**Use Case**: "What's safe to refactor and what has high change risk?"

### Cleanup Workflow

```
cycles → dead-code → find-callers (verify)
```

**Use Case**: "Find circular dependencies and unused code to remove"

### Test Planning Workflow

```
hotspots → dead-code → cycles
```

**Use Case**: "Where should I focus test coverage efforts?"

---

## Integration with Other Skills

This skill is designed for **AI agents** to query deterministically:

```json
{
  "domain": "csv-processing",
  "options": { "depth": 5, "limit": 100 },
  "query": "blast-radius",
  "target": "parseDate"
}
```

**Agent Benefits**:

- 📉 **50-90% token reduction** vs reading full files
- ⚡ **<2s response time** for all queries
- 🎯 **Exact file:line references** for targeted reads
- 🔒 **Deterministic JSON output** (easy to parse)

---

## Error Handling

See @error-handling.md for complete error patterns and recovery strategies.

**Quick Reference**:

- All queries return structured JSON errors with helpful hints
- Common errors: PROJECT_INDEX.json missing, function not found, domain not found
- Recovery guidance provided in `hint` field

---

## File Structure

```
index-graph-navigator/
├── SKILL.md                    # Main skill documentation
├── README.md                   # This file (quick start + cookbook)
├── query-library.md            # All 8 queries documented
├── graph-algorithms.md         # BFS/DFS implementation details
├── integration-guide.md        # Agent integration examples
└── scripts/
    ├── hotspots.sh             # Find most-connected functions
    ├── find-callers.sh         # Find reverse dependencies
    ├── find-calls.sh           # Find forward dependencies
    ├── blast-radius.py         # Transitive callers (BFS)
    ├── trace-to-error.py       # Call stacks to error location
    ├── cycles.py               # Circular dependency detection (DFS)
    ├── dead-code.sh            # Find unused functions
    ├── cross-domain.py         # Domain coupling analysis
    ├── extract-domains.py      # Generate domain metadata
    └── get-capabilities.py     # API discovery
```

---

## Token Efficiency

**Without this skill** (reading code directly):

- Read 20-50 files to understand call graph: **20K-50K tokens**
- Analyze dependencies manually: **High cognitive load**
- Risk of missing indirect dependencies

**With this skill** (query-based navigation):

- Run 1-3 queries to get exact information: **200-500 tokens**
- JSON output ready to parse: **Low cognitive load**
- Complete transitive closure (no missed dependencies)

**Savings**: **50-90% token reduction** on codebase navigation tasks

---

## Requirements

- **PROJECT_INDEX.json** at project root (run `/index` to generate)
- **Python 3** for complex queries (blast-radius, cycles, trace-to-error)
- **jq** for simple queries (hotspots, find-callers, find-calls, dead-code)
- **Git repository** (auto-detects git root for PROJECT_INDEX.json)

---

## See Also

- **SKILL.md** - Complete skill documentation
- **query-library.md** - Detailed query reference (input/output schemas)
- **graph-algorithms.md** - Algorithm implementations and complexity
- **integration-guide.md** - How other skills/agents use this navigator

---

## Quick Reference

**Find who calls X**: `bash scripts/find-callers.sh <function> --json`

**Find what X calls**: `bash scripts/find-calls.sh <function> --json`

**Find blast radius**: `python3 scripts/blast-radius.py <function> --json`

**Find hotspots**: `bash scripts/hotspots.sh --limit 10 --json`

**Find dead code**: `bash scripts/dead-code.sh --limit 20 --json`

**Find cycles**: `python3 scripts/cycles.py --json`

**Trace error**: `python3 scripts/trace-to-error.py <file> <line> --json`

**Domain coupling**: `python3 scripts/cross-domain.py <domain> --json`

---

**Fast • Deterministic • Token-Efficient • Agent-Optimized**
