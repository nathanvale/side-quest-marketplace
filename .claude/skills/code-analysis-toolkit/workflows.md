# Common Workflows

Complete step-by-step workflows for common code analysis tasks.

---

## Find Unused Dependencies

**Goal**: Identify npm packages that can be safely removed

**Steps**:

```
1. jq to list all dependencies
   → jq '.dependencies | keys' package.json

2. rg to find which packages are actually imported
   → rg -l 'from.*package-name' -t ts -t tsx

3. ast-grep to verify not used via dynamic imports
   → ast-grep run -p 'import($X)'

4. Sequential Thinking to assess removal safety
   → Consider: runtime imports, plugins, peer dependencies
```

**Output**: List of safely removable packages

**Confidence**: High (multi-step verification)

---

## Find Type Safety Issues

**Goal**: Locate and prioritize 'any' types that need fixing

**Steps**:

```
1. ast-grep to find all 'any' types
   → ast-grep run -l TypeScript -p 'any'

2. Read code to understand why 'any' was used
   → Read: src/types/user.ts

3. Sequential Thinking to assess data flow risk
   → Trace: user input → any → database

4. Calculate complexity for prioritization
   → python3 scripts/complexity.py src/types/user.ts
```

**Output**: Prioritized list of type safety issues

**Confidence**: Medium-High (requires domain knowledge)

---

## Refactor API Calls

**Goal**: Safely migrate from old API to new API

**Steps**:

```
1. rg to find candidate files with old API
   → rg -l 'oldApiCall' -t ts

2. ast-grep to precisely match call sites
   → ast-grep run -p 'oldApiCall($ARGS)'

3. ast-grep --rewrite to safely transform
   → ast-grep run -p 'oldApiCall($A)' -r 'newApiCall($A)' -U

4. Read to verify correctness
   → Read: src/services/api.ts:42-56
```

**Output**: Migrated codebase with old API replaced

**Confidence**: High (structural rewrite)

---

## Analyze Performance Bottleneck

**Goal**: Find and understand performance hotspots

**Steps**:

```
1. jq to analyze error logs for slow endpoints
   → jq '.logs[] | select(.duration > 1000) | group_by(.endpoint)' performance.json

2. Read code to identify algorithm complexity
   → Read: src/core/processData.ts

3. Sequential Thinking to trace execution
   → Analyze: nested loops, N+1 queries, synchronous I/O

4. Python to calculate cyclomatic complexity
   → python3 scripts/complexity.py src/core/processData.ts
```

**Output**: Bottleneck diagnosis + refactoring plan

**Confidence**: Medium (requires performance expertise)

---

## Detect Circular Dependencies

**Goal**: Find and break circular import cycles

**Steps**:

```
1. Python script to analyze import graph
   → python3 scripts/dependency-graph.py --detect-cycles src/

2. Read code to understand dependency reasons
   → Read: src/module-a.ts, src/module-b.ts

3. Sequential Thinking to plan decoupling
   → Strategies: dependency injection, event bus, extract shared code

4. ast-grep to verify import structure
   → ast-grep run -p 'import $X from "$PATH"'
```

**Output**: Circular dependency report + refactoring strategy

**Confidence**: High (deterministic detection)

---

## Audit Security Patterns

**Goal**: Find potentially unsafe code patterns

**Steps**:

```
1. ast-grep to find dangerous patterns
   → ast-grep run -p 'eval($CODE)'
   → ast-grep run -p 'dangerouslySetInnerHTML'
   → ast-grep run -p 'unsafeRaw($SQL)'

2. Read code to verify usage context
   → Read: src/utils/eval-handler.ts

3. Sequential Thinking to assess risk
   → Consider: user input, sanitization, escape hatches

4. Calculate complexity and usage
   → python3 scripts/complexity.py src/utils/eval-handler.ts
```

**Output**: Security audit report with risk levels

**Confidence**: Medium (requires security expertise)

---

## General Workflow Pattern

```
Fast Discovery (rg/Glob/jq)
    ↓
Precise Matching (ast-grep)
    ↓
Deep Understanding (Read)
    ↓
Reasoning & Planning (Sequential Thinking)
    ↓
Impact Analysis (Python scripts)
```

**Key Principles**:

- Always start with fastest tools
- Use multiple verification steps for high-stakes changes
- Combine graph data (jq) with code inspection (Read)
- Think last, after gathering all data
