# Tool Catalog

Detailed descriptions, usage patterns, pros/cons for all code analysis tools.

---

## 1. ripgrep (rg) - Fast Text Search

**Purpose**: Blazing fast literal/regex search across files

**When to use**:

- Finding strings, TODOs, log lines, config values
- Searching non-code assets (JSON, YAML, markdown)
- Pre-filtering: narrow candidate files before precise analysis
- Reconnaissance: "does this string exist anywhere?"

**Examples**: See @examples.md for detailed code examples

**Pros**:

- Fastest search tool available
- Great for broad reconnaissance
- Works on any text file

**Cons**:

- Matches text in comments/strings (false positives)
- No structural understanding of code
- Can't safely rewrite code

---

## 2. ast-grep - Structural Code Search

**Purpose**: Parse code and match AST nodes, ignore comments/strings

**When to use**:

- Refactors/codemods: rename APIs, change imports, rewrite calls
- Policy enforcement: ensure patterns across repo
- Finding code patterns (not text): "all functions that call X"
- Safe code rewrites: only change real code, not strings/comments

**Examples**: See @examples.md for detailed code examples

**Pros**:

- Structurally correct (ignores comments/strings)
- Safe rewrites (first-class feature)
- Low false positives
- Can output JSON for tooling

**Cons**:

- Slower than ripgrep
- Requires understanding AST patterns
- Language-specific

---

## 3. Grep Tool (Claude's Built-in)

**Purpose**: Pattern search with Claude Code integration

**When to use**:

- Search file contents with regex
- Get context lines (before/after)
- Filter by file type or glob pattern
- Count matches

**Examples**: See @examples.md for detailed usage

**Pros**:

- Integrated with Claude Code
- Can get line numbers, context
- Supports glob patterns

**Cons**:

- Not as fast as ripgrep
- Text-based (no AST awareness)

---

## 4. Glob Tool - File Pattern Matching

**Purpose**: Find files by name patterns

**When to use**:

- Find all files of a type: "\*.test.ts"
- Find files in directories: "src/\*_/_.tsx"
- Narrow file set before analysis

**Examples**: See @examples.md for detailed usage

**Pros**:

- Fast file discovery
- Supports complex glob patterns
- Works across any codebase size

**Cons**:

- Only finds files, doesn't search content

---

## 5. jq - JSON Query Processor

**Purpose**: Query and transform JSON data (configs, logs, API responses)

**When to use**:

- Parsing package.json, tsconfig.json, or other config files
- Analyzing JSON log files and error reports
- Extracting data from API responses or OpenAPI specs
- Calculating metrics from structured JSON data

**Examples**: See @examples.md for detailed code examples

**Pros**:

- Fast JSON queries
- Deterministic results
- Low token cost
- Works with any JSON file

**Cons**:

- Only works on JSON data
- Requires understanding jq syntax

---

## 6. Python Scripts - Complex Algorithms

**Purpose**: Statistical analysis, metrics calculation, complex computations

**When to use**:

- Calculating cyclomatic complexity
- Analyzing import dependency graphs
- Finding duplicate code blocks
- Generating code metrics reports
- Schema validation

**Examples**: See @examples.md for script invocations

**Pros**:

- Complex algorithms implemented
- Token-efficient (200-500 token responses)
- Deterministic results
- Fast execution

**Cons**:

- Requires Python runtime
- May need custom scripts for specific tasks

---

## 7. Read Tool - Source Code Inspection

**Purpose**: Read actual source files for deep analysis

**When to use**:

- Understanding code logic
- Verifying code smells found by graph analysis
- Checking for edge cases
- Reading documentation/comments

**Examples**: See @examples.md for usage patterns

**Pros**:

- See actual code
- Understand context
- Verify issues

**Cons**:

- Slower than text search
- Token usage for large files

---

## 8. Sequential Thinking Tool - Deep Analysis

**Purpose**: Structured thinking for complex code analysis

**When to use**:

- Understanding "why" code is problematic
- Analyzing edge cases and failure modes
- Calculating production impact
- Reasoning through fix strategies

**Examples**: See @examples.md for analysis patterns

**Pros**:

- Deep analytical thinking
- Structured reasoning
- Uncovers hidden issues

**Cons**:

- Time-intensive
- Use after narrowing candidates
