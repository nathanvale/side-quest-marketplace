# Integration Patterns

**Composability patterns and real-world workflows for using index-graph-navigator**

## Composability Patterns

### Pattern 1: Sequential Queries (Build Context)

Run queries in sequence, each building on previous results:

```
1. Get hotspots → Find high-risk functions
2. For each hotspot → Get blast radius
3. For each blast radius → Check cross-domain coupling
4. Report: High-risk functions + their impact + coupling
```

**Use when**: Building comprehensive understanding step-by-step

---

### Pattern 2: Parallel Queries (Comprehensive Analysis)

Run multiple independent queries simultaneously:

```
Parallel:
- Query: hotspots
- Query: dead-code
- Query: cycles
- Query: cross-domain for each domain

Aggregate results → Comprehensive health report
```

**Use when**: Generating dashboard or full codebase audit

---

### Pattern 3: Conditional Queries (Adaptive)

Run queries based on previous results:

```
1. Query: blast-radius of targetFunction
2. IF blast_radius > 20:
     Query: cross-domain (check if impact crosses boundaries)
3. IF cross_domain.length > 0:
     Query: hotspots in affected domains (find other risks)
4. Report: Adaptive risk assessment
```

**Use when**: Unknown risk level, need adaptive analysis

---

## Real-World Workflows

### Workflow 1: Debugging a Production Error

**Scenario**: Error at src/parser.ts:123 in production

**Steps**:

1. Query: "trace-to-error" at src/parser.ts:123 → Get call stacks
2. Read files in call paths (targeted, not全部)
3. Query: "blast-radius" of error function → Understand impact
4. Query: "hotspots" in domain → Check if part of larger pattern
5. Diagnose root cause + assess blast radius

**Token**: 2-3K tokens vs 20K+ reading entire codebase

---

### Workflow 2: Refactoring Safety Check

**Scenario**: Want to refactor extractEmail function

**Steps**:

1. Query: "find-callers extractEmail" → Who uses it?
2. Query: "blast-radius extractEmail" → Full impact
3. Query: "cross-domain" → Does it cross boundaries?
4. IF blast_radius < 10 AND no cross-domain: Safe to refactor inline
5. ELSE: Create deprecation wrapper, gradual migration

**Token**: 1-2K tokens vs 30K+ analyzing dependencies manually

---

### Workflow 3: Dead Code Cleanup

**Scenario**: Reduce codebase size before major release

**Steps**:

1. Query: "dead-code" → Get all unused functions
2. For each unused function:
   - Check if export (might be library code)
   - Check if test helper (might be intentional)
3. Create deletion PR with safe removals
4. Track: Lines of code removed, token savings

**Token**: 500 tokens vs 10K+ reading all files to find unused code

---

### Workflow 4: Performance Optimization

**Scenario**: Optimize slow endpoint

**Steps**:

1. Identify slow function from profiler
2. Query: "find-calls" from slow function → What does it call?
3. Query: "blast-radius" of called functions → Impact of optimizing each
4. Prioritize optimizations by:
   - Call frequency (from profiler)
   - Blast radius (from navigator)
   - Complexity (from code review)

**Token**: 1K tokens vs 15K+ analyzing call patterns manually

---

### Workflow 5: Understanding Codebase Structure (Onboarding)

**Scenario**: New developer needs to understand architecture

**Steps**:

1. Query: "hotspots" → Find most important functions
2. Query: "cross-domain" for each domain → Understand coupling
3. Query: "cycles" → Identify architectural issues
4. Generate architecture diagram from results
5. Focus learning on hotspots and cross-domain interfaces

**Token**: 2K tokens vs 50K+ reading random files

---

## Best Practices for Composing Queries

1. **Start broad** (hotspots, dead-code) → Then drill down (blast-radius, find-callers)
2. **Use conditional logic** → Adapt based on results
3. **Parallelize independent queries** → Faster analysis
4. **Cache results** within session → Avoid redundant queries
5. **Combine with Read tool** → Get structural info from navigator, code details from Read

---

## Token Efficiency Tips

- **Don't query same target twice** → Cache results
- **Use hotspots first** → Identify what matters, ignore the rest
- **Blast radius before reading** → Know impact before diving into code
- **Cross-domain for coupling** → Understand boundaries before refactoring

**Result**: 50-90% token savings by querying structure before reading code
