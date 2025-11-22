# Code Examples

Concrete code examples for all tools and patterns.

---

## ripgrep (rg) Examples

### Find console.log statements

```bash
rg -n 'console\.log\(' -t js
```

### Find TODOs with context

```bash
rg -A 3 -B 1 'TODO:'
```

### Find in specific file types

```bash
rg 'apiKey' -t ts -t tsx
```

### List files containing pattern

```bash
rg -l 'useQuery\(' -t ts
```

---

## ast-grep Examples

### Find all import statements (ignores commented imports)

```bash
ast-grep run -l TypeScript -p 'import $X from "$P"'
```

### Rewrite var to let (only real declarations)

```bash
ast-grep run -l JavaScript -p 'var $A = $B' -r 'let $A = $B' -U
```

### Find all useQuery calls

```bash
ast-grep run -l TypeScript -p 'useQuery($A)'
```

### Find dangerous eval patterns

```bash
ast-grep run -l JavaScript -p 'eval($CODE)'
```

---

## Grep Tool Examples

### Search with context

```
Grep tool with:
  pattern: "function.*Error"
  -C: 3
  type: "ts"
```

### Count matches

```
Grep tool with:
  pattern: "TODO"
  output_mode: "count"
```

---

## Glob Tool Examples

### Find all test files

```
Glob: "**/*.test.ts"
```

### Find React components

```
Glob: "src/components/**/*.tsx"
```

### Find config files

```
Glob: "**/*.config.{js,ts}"
```

---

## jq Examples

### Parse package.json dependencies

```bash
jq '.dependencies | keys' package.json
```

### Extract all test scripts

```bash
jq '.scripts | to_entries | map(select(.key | startswith("test")))' package.json
```

### Find API endpoints in OpenAPI spec

```bash
jq '.paths | keys' openapi.json
```

### Count error types in log file (JSON lines)

```bash
jq -s 'group_by(.level) | map({level: .[0].level, count: length})' logs.jsonl
```

### Extract environment variables from config

```bash
jq '.env | to_entries | map(.key)' config.json
```

### Filter large dependencies (>1MB)

```bash
jq '.dependencies | to_entries | map(select(.value.size > 1000000))' package-lock.json
```

---

## Python Script Examples

### Calculate cyclomatic complexity

```bash
python3 scripts/complexity.py src/
```

### Analyze import dependencies

```bash
python3 scripts/dependency-graph.py --format json src/
```

### Generate code metrics report

```bash
python3 scripts/metrics.py --lines --functions --classes src/
```

### Find duplicate code blocks

```bash
python3 scripts/duplicate-detector.py --threshold 0.8 src/
```

### Validate JSON schema compliance

```bash
python3 scripts/schema-validator.py --schema config/api-schema.json data/
```

---

## Read Tool Examples

### Read specific file

```
Read: apps/migration-cli/src/parser.ts
```

### Read with line range

```
Read: src/utils/validator.ts (offset: 100, limit: 50)
```

### Read multiple files

```
Read: src/types/user.ts
Read: src/services/auth.ts
```

---

## Sequential Thinking Examples

### Analyze code quality issue

```
Use Sequential Thinking to analyze:
- What is this code actually doing?
- What edge cases could trigger failures?
- How does this manifest in production?
- What's the blast radius if changed?
```

### Plan refactoring strategy

```
Use Sequential Thinking to plan:
- What are the current pain points?
- What patterns should we move towards?
- What's the migration path?
- How do we maintain backwards compatibility?
```

---

## Combination Examples

### Speed → Precision

```bash
# Step 1: Fast recon with ripgrep
rg -l 'useQuery\(' -t ts

# Step 2: Precise analysis with ast-grep
cat file_list | xargs ast-grep run -l TypeScript -p 'useQuery($A)'
```

### JSON → Code

```bash
# Step 1: Find high-error endpoints with jq
jq '.errors | group_by(.endpoint) | map({endpoint: .[0].endpoint, count: length}) | sort_by(.count) | reverse | .[0:5]' error-logs.json

# Step 2: Read code to understand why
Read: src/api/endpoints/users.ts
```

### Pattern → Metrics

```bash
# Step 1: Find pattern with ast-grep
ast-grep run -l TypeScript -p 'any'

# Step 2: Calculate complexity with Python
python3 scripts/complexity.py --file src/types/user.ts
```

---

## Realistic Workflow Example

**Task**: Find and fix all SQL injection risks

```bash
# 1. Find SQL concatenation patterns (fast)
rg -l 'SELECT.*\+' -t ts

# 2. Verify with ast-grep (precise)
ast-grep run -p 'db.query($SQL + $VAR)'

# 3. Read code context
Read: src/db/queries.ts:45-67

# 4. Understand data flow (deep thinking)
Sequential Thinking:
  - Where does $VAR come from?
  - Is there any sanitization?
  - What's the attack surface?

# 5. Calculate complexity
python3 scripts/complexity.py src/db/queries.ts

# 6. Safe rewrite
ast-grep run -p 'db.query($SQL + $VAR)' -r 'db.query($SQL, [$VAR])' -U
```

**Output**: All SQL injection risks fixed with parameterized queries
