# Query Library

**Complete reference for all supported query types**

## Table of Contents

- [Query Type Index](#query-type-index)
- [1. blast-radius](#1-blast-radius)
  - [Input Schema](#input-schema)
  - [Output Schema](#output-schema)
  - [Algorithm](#algorithm)
  - [Performance](#performance)
- [2. find-callers](#2-find-callers)
  - [Input Schema](#input-schema-1)
  - [Output Schema](#output-schema-1)
  - [Algorithm](#algorithm-1)
  - [Performance](#performance-1)
- [3. find-calls](#3-find-calls)
  - [Input Schema](#input-schema-2)
  - [Output Schema](#output-schema-2)
  - [Algorithm](#algorithm-2)
  - [Performance](#performance-2)
- [4. trace-to-error](#4-trace-to-error)
  - [Input Schema](#input-schema-3)
  - [Output Schema](#output-schema-3)
  - [Algorithm](#algorithm-3)
  - [Performance](#performance-3)
- [5. dead-code](#5-dead-code)
  - [Input Schema](#input-schema-4)
  - [Output Schema](#output-schema-4)
  - [Algorithm](#algorithm-4)
  - [Performance](#performance-4)
- [6. cycles](#6-cycles)
  - [Input Schema](#input-schema-5)
  - [Output Schema](#output-schema-5)
  - [Algorithm](#algorithm-5)
  - [Performance](#performance-5)
- [7. hotspots](#7-hotspots)
  - [Input Schema](#input-schema-6)
  - [Output Schema](#output-schema-6)
  - [Algorithm](#algorithm-6)
  - [Performance](#performance-6)
- [8. cross-domain](#8-cross-domain)
  - [Input Schema](#input-schema-7)
  - [Output Schema](#output-schema-7)
  - [Algorithm](#algorithm-7)
  - [Performance](#performance-7)
- [Usage Patterns](#usage-patterns)
  - [Sequential Queries (Agent Workflow)](#sequential-queries-agent-workflow)
  - [Combined Analysis](#combined-analysis)
- [Performance Summary](#performance-summary)
- [Error Handling](#error-handling)

---

## Query Type Index

1. [blast-radius](#1-blast-radius) - Transitive callers (what breaks?)
2. [find-callers](#2-find-callers) - Direct reverse dependencies
3. [find-calls](#3-find-calls) - Direct forward dependencies
4. [trace-to-error](#4-trace-to-error) - Call stack to file:line
5. [dead-code](#5-dead-code) - Functions never called
6. [cycles](#6-cycles) - Circular dependencies
7. [hotspots](#7-hotspots) - Most-connected functions
8. [cross-domain](#8-cross-domain) - External dependencies

---

## 1. blast-radius

**Purpose**: Find all functions affected if target function changes (transitive callers)

**Use Case**: "What breaks if I refactor parseDate?"

### Input Schema

```json
{
  "domain": "csv-processing",
  "options": {
    "depth": 5,
    "limit": 100
  },
  "query": "blast-radius",
  "target": "parseDate"
}
```

| Field         | Required | Type   | Description                              |
| ------------- | -------- | ------ | ---------------------------------------- |
| query         | ✅       | string | "blast-radius"                           |
| target        | ✅       | string | Function name to analyze                 |
| domain        | ✅       | string | Domain name from MANIFEST                |
| options.depth | ❌       | number | Max traversal depth (default: unlimited) |
| options.limit | ❌       | number | Max results (default: 100)               |

### Output Schema

```json
{
  "domain": "csv-processing",
  "query": "blast-radius",
  "results": [
    {
      "depth": 1,
      "file": "apps/migration-cli/src/lib/csv/parser.ts",
      "function": "mapRow",
      "line": 272,
      "type": "direct-caller"
    },
    {
      "depth": 2,
      "file": "apps/migration-cli/src/lib/validation.ts",
      "function": "validateData",
      "line": 45,
      "type": "transitive-caller"
    }
  ],
  "status": "success",
  "summary": {
    "by_depth": {
      "1": 12,
      "2": 25,
      "3": 10
    },
    "max_depth": 3,
    "total": 47
  },
  "target": "parseDate"
}
```

### Algorithm

Uses BFS (Breadth-First Search) to find all transitive callers. See @graph-algorithms.md for
implementation.

### Performance

- ~300-500ms for typical functions (< 100 callers)
- ~1-2s for hotspots (100+ callers)

---

## 2. find-callers

**Purpose**: Find direct callers of a function (reverse dependencies)

**Use Case**: "Who directly calls showError?"

### Input Schema

```json
{
  "domain": "core-cli",
  "query": "find-callers",
  "target": "showError"
}
```

| Field  | Required | Type   | Description    |
| ------ | -------- | ------ | -------------- |
| query  | ✅       | string | "find-callers" |
| target | ✅       | string | Function name  |
| domain | ✅       | string | Domain name    |

### Output Schema

```json
{
  "domain": "core-cli",
  "query": "find-callers",
  "results": [
    {
      "file": "src/commands/validate.ts",
      "function": "executeValidate",
      "line": 67
    },
    {
      "file": "src/commands/migrate.ts",
      "function": "executeMigration",
      "line": 123
    }
  ],
  "status": "success",
  "summary": {
    "total": 3
  },
  "target": "showError"
}
```

### Algorithm

Simple jq query on graph edges:

```bash
jq -r --arg func "$TARGET" '.g[] | select(.[1] == $func) | .[0]' < domain.json
```

### Performance

- ~20-50ms (jq query)

---

## 3. find-calls

**Purpose**: Find what a function directly calls (forward dependencies)

**Use Case**: "What does migrateAttachments call?"

### Input Schema

```json
{
  "domain": "migration-pipelines",
  "query": "find-calls",
  "target": "migrateAttachments"
}
```

| Field  | Required | Type   | Description   |
| ------ | -------- | ------ | ------------- |
| query  | ✅       | string | "find-calls"  |
| target | ✅       | string | Function name |
| domain | ✅       | string | Domain name   |

### Output Schema

```json
{
  "domain": "migration-pipelines",
  "query": "find-calls",
  "results": [
    {
      "domain": "service-factory",
      "file": "src/lib/services/blob-storage.ts",
      "function": "getBlobServiceClient",
      "line": 45
    },
    {
      "domain": "utilities",
      "file": "src/lib/logging.ts",
      "function": "logMigrationStart",
      "line": 89
    }
  ],
  "status": "success",
  "summary": {
    "external": 2,
    "internal": 2,
    "total": 4
  },
  "target": "migrateAttachments"
}
```

### Algorithm

Simple jq query on graph edges:

```bash
jq -r --arg func "$TARGET" '.g[] | select(.[0] == $func) | .[1]' < domain.json
```

### Performance

- ~20-50ms (jq query)

---

## 4. trace-to-error

**Purpose**: Find call stack leading to a specific file:line (how does execution reach an error?)

**Use Case**: "Error at src/parser.ts:123, how does code execution get there?"

### Input Schema

```json
{
  "domain": "csv-processing",
  "file": "apps/migration-cli/src/lib/csv/parser.ts",
  "line": 123,
  "query": "trace-to-error"
}
```

| Field  | Required | Type   | Description                            |
| ------ | -------- | ------ | -------------------------------------- |
| query  | ✅       | string | "trace-to-error"                       |
| file   | ✅       | string | File path (relative to project root)   |
| line   | ✅       | number | Line number where error occurs         |
| domain | ❌       | string | Domain name (auto-detected if omitted) |

### Output Schema

```json
{
  "call_stacks": [
    {
      "depth": 3,
      "entry_point": "runCli",
      "path": [
        { "file": "src/cli.ts", "function": "runCli", "line": 15 },
        { "file": "src/commands/migrate.ts", "function": "executeMigration", "line": 45 },
        { "file": "src/lib/csv/parser.ts", "function": "mapRow", "line": 272 },
        { "file": "src/lib/csv/parser.ts", "function": "parseDate", "line": 123 }
      ]
    }
  ],
  "file": "apps/migration-cli/src/lib/csv/parser.ts",
  "function_at_line": "parseDate",
  "line": 123,
  "query": "trace-to-error",
  "status": "success",
  "summary": {
    "max_depth": 4,
    "min_depth": 2,
    "total_paths": 2
  }
}
```

### Algorithm

1. Find which function is defined at file:line (from `.f` section)
2. Run reverse BFS to find all paths to that function
3. Return call chains from entry points

See @graph-algorithms.md for implementation.

### Performance

- ~400-600ms (Python reverse BFS)

---

## 5. dead-code

**Purpose**: Find functions that are never called (potential dead code)

**Use Case**: "What can I safely delete from csv-processing domain?"

### Input Schema

```json
{
  "domain": "csv-processing",
  "options": {
    "exclude_entry_points": true,
    "exclude_exports": false
  },
  "query": "dead-code"
}
```

| Field                        | Required | Type    | Description                                 |
| ---------------------------- | -------- | ------- | ------------------------------------------- |
| query                        | ✅       | string  | "dead-code"                                 |
| domain                       | ✅       | string  | Domain name                                 |
| options.exclude_entry_points | ❌       | boolean | Exclude main/CLI commands (default: true)   |
| options.exclude_exports      | ❌       | boolean | Exclude exported functions (default: false) |

### Output Schema

```json
{
  "domain": "csv-processing",
  "query": "dead-code",
  "results": [
    {
      "exported": false,
      "file": "src/lib/csv/parser.ts",
      "function": "streamCsvChunked",
      "line": 257,
      "reason": "never_called"
    },
    {
      "exported": true,
      "file": "src/lib/utilities.ts",
      "function": "cleanupTempFiles",
      "line": 89,
      "reason": "never_called",
      "warning": "Exported but unused - may be public API"
    }
  ],
  "status": "success",
  "summary": {
    "exported_unused": 2,
    "safe_to_delete": 3,
    "total": 5
  }
}
```

### Algorithm

1. Extract all defined functions from `.f` section
2. Extract all called functions from `.g` section
3. Set difference: defined - called = dead code
4. Filter entry points (main, CLI commands) if requested

### Performance

- ~200-300ms (jq + set operations)

---

## 6. cycles

**Purpose**: Detect circular dependencies (functions that call each other directly or transitively)

**Use Case**: "Are there any circular dependencies in this domain?"

### Input Schema

```json
{
  "domain": "csv-processing",
  "query": "cycles"
}
```

| Field  | Required | Type   | Description |
| ------ | -------- | ------ | ----------- |
| query  | ✅       | string | "cycles"    |
| domain | ✅       | string | Domain name |

### Output Schema

```json
{
  "domain": "csv-processing",
  "query": "cycles",
  "results": [
    {
      "cycle": ["parseChunkSmart", "validateChunk", "parseChunkSmart"],
      "files": ["src/lib/csv/chunked-parser.ts", "src/lib/csv/validator.ts"],
      "length": 2
    }
  ],
  "status": "success",
  "summary": {
    "max_length": 2,
    "min_length": 2,
    "total_cycles": 1
  }
}
```

### Algorithm

DFS (Depth-First Search) with cycle detection using recursion stack. See @graph-algorithms.md for
implementation.

### Performance

- ~500ms-1s (Python DFS)

---

## 7. hotspots

**Purpose**: Find most-connected functions (highest change risk / maintenance burden)

**Use Case**: "What functions have the most callers (highest risk to change)?"

### Input Schema

```json
{
  "domain": "csv-processing",
  "options": {
    "limit": 10,
    "min_callers": 5
  },
  "query": "hotspots"
}
```

| Field               | Required | Type   | Description                             |
| ------------------- | -------- | ------ | --------------------------------------- |
| query               | ✅       | string | "hotspots"                              |
| domain              | ✅       | string | Domain name                             |
| options.limit       | ❌       | number | Max results (default: 10)               |
| options.min_callers | ❌       | number | Minimum callers to include (default: 3) |

### Output Schema

```json
{
  "domain": "csv-processing",
  "query": "hotspots",
  "results": [
    {
      "callers": 9,
      "file": "src/lib/csv/domino-contact-normalizer.ts",
      "function": "isNonEmpty",
      "line": 22,
      "rank": 1
    },
    {
      "callers": 7,
      "file": "src/lib/csv/parser.ts",
      "function": "parseDate",
      "line": 123,
      "rank": 2
    }
  ],
  "status": "success",
  "summary": {
    "avg_callers": 5.3,
    "max_callers": 9,
    "total": 10
  }
}
```

### Algorithm

Group by callee, count, sort descending:

```bash
jq '[.g[] | .[1]] | group_by(.) | map({func: .[0], callers: length}) | sort_by(-.callers)' < domain.json
```

### Performance

- ~100-200ms (jq aggregation)

---

## 8. cross-domain

**Purpose**: Find functions called from outside the domain (external dependencies / coupling)

**Use Case**: "What external functions does csv-processing depend on?"

### Input Schema

```json
{
  "domain": "csv-processing",
  "query": "cross-domain"
}
```

| Field  | Required | Type   | Description    |
| ------ | -------- | ------ | -------------- |
| query  | ✅       | string | "cross-domain" |
| domain | ✅       | string | Domain name    |

### Output Schema

```json
{
  "domain": "csv-processing",
  "query": "cross-domain",
  "results": [
    {
      "called_by": ["parseCsv", "loadCsvFromBlob"],
      "coupling_strength": 2,
      "from_domain": "service-factory",
      "function": "getBlobServiceClient"
    },
    {
      "called_by": ["parseRow", "validateData"],
      "coupling_strength": 2,
      "from_domain": "utilities",
      "function": "logError"
    }
  ],
  "status": "success",
  "summary": {
    "coupled_domains": ["service-factory", "utilities", "dataverse-repositories"],
    "coupling_score": 12,
    "total_external_deps": 5
  }
}
```

### Algorithm

1. Extract functions defined in this domain (from `.f`)
2. Extract functions called by this domain (from `.g`)
3. Set difference: called - defined = external deps
4. Group by source domain, count coupling strength

### Performance

- ~150-250ms (jq set operations)

---

## Usage Patterns

### Sequential Queries (Agent Workflow)

**Example: Debug assistant investigating error**

```
1. trace-to-error (file:line) → Get call stack
2. find-calls for each function in stack → Understand data flow
3. blast-radius for suspected bug location → Assess fix impact
```

**Example: Refactor planner**

```
1. blast-radius (target function) → Find affected code
2. hotspots (domain) → Identify high-risk functions to avoid
3. cross-domain (domain) → Check external coupling
```

### Combined Analysis

**Example: Domain health assessment**

```
1. dead-code → Find unused functions
2. cycles → Find circular deps
3. hotspots → Find high-maintenance functions
4. cross-domain → Assess coupling

Combined metrics → Domain health score
```

---

## Performance Summary

See @performance.md for detailed performance characteristics, optimization strategies, and
scalability limits.

**Quick Reference**:

- Simple queries (find-callers, hotspots): ~20-200ms
- Complex queries (blast-radius, cycles): ~300-1000ms
- All queries complete in <2 seconds

---

## Error Handling

See @error-handling.md for complete error patterns and recovery strategies.

**Quick Reference**:

- All queries return structured JSON errors with helpful hints
- Common errors: function not found, domain not found, invalid query type
- Recovery guidance provided in `hint` field

---

**Fast • Deterministic • Token-Efficient**
