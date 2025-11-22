# Integration Examples

**Concrete examples of how other skills use index-graph-navigator**

## Example 1: domain-analyzer Integration

**Purpose**: Analyze code quality within domains

**Integration Points**:

- Use `Skill(index-graph-navigator)` query: "hotspots" to find high-risk functions
- Use `Skill(index-graph-navigator)` query: "dead-code" to find unused code
- Use `Skill(index-graph-navigator)` query: "blast-radius" for impact analysis
- Use `Skill(index-graph-navigator)` query: "cycles" to detect circular dependencies

**Token Savings**: ~3,000 tokens per agent launch (inline algorithms removed)

---

## Example 2: debug-assistant Skill (Future)

**Purpose**: Help users debug errors by tracing execution paths

**User**: "I have an error at src/parser.ts:123, help me find the cause"

**Workflow**:

1. Use `Skill(index-graph-navigator)` query: "trace-to-error" at src/parser.ts:123
2. Get call stacks showing all paths to the error location
3. Read ONLY files in the call path (not entire codebase)
4. Analyze code flow to identify bug cause

**Token Savings**: 20K+ → 2.2K tokens (90% reduction)

---

## Example 3: refactor-planner Skill (Future)

**Purpose**: Plan safe refactoring by analyzing impact

**User**: "I want to rename function parseDate to parseDateTime"

**Workflow**:

1. Check blast radius: `Skill(index-graph-navigator)` query: "blast-radius parseDate"
2. Check if hotspot: `Skill(index-graph-navigator)` query: "hotspots"
3. Check cross-domain usage: `Skill(index-graph-navigator)` query: "cross-domain"
4. Generate refactor plan based on impact assessment

**Token Savings**: 30K+ → 3.6K tokens (88% reduction)

---

## Example 4: test-coverage-analyzer Skill (Future)

**Purpose**: Find code not covered by tests

**Workflow**:

1. Find dead code: `Skill(index-graph-navigator)` query: "dead-code"
2. Find entry points (potential test targets)
3. Cross-reference with test files
4. Report untested code prioritized by hotspots (high risk if untested)

**Token Savings**: 25K+ → 4K tokens (84% reduction)

---

## Example 5: dependency-auditor Skill (Future)

**Purpose**: Analyze coupling and dependencies

**Workflow**:

1. For each domain, query cross-domain dependencies
2. Build coupling matrix
3. Calculate coupling scores
4. Generate decoupling recommendations

**Token Savings**: 50K+ → 2K tokens (96% reduction)

---

## Common Pattern

All these skills follow the same pattern:

1. **Query navigator** for structural information (200-500 tokens)
2. **Get JSON response** with exact file:line references
3. **Read only targeted locations** (avoid reading entire codebase)
4. **Perform analysis** on minimal context
5. **Report findings** to user

**Result**: 50-90% token savings on codebase navigation tasks
