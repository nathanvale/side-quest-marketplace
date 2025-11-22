# Error Handling Reference

**Complete error handling patterns for all query types**

All queries return structured JSON errors with helpful hints for recovery.

---

## Error Response Schema

```json
{
  "available_options": ["<list of valid options>"],
  "error": "<human-readable description>",
  "hint": "<actionable guidance>",
  "status": "error",
  "suggestions": ["<alternative1>", "<alternative2>"]
}
```

---

## Common Errors

### 1. Function Not Found

**Trigger**: Target function doesn't exist in the domain

**Response**:

```json
{
  "error": "Function 'parsDate' not found in domain 'csv-processing'",
  "hint": "Check function spelling or use 'hotspots' query to list all functions",
  "status": "error",
  "suggestions": ["parseDate", "parseData"]
}
```

**Recovery**:

- Use fuzzy match suggestions
- Run `hotspots` query to see all available functions
- Check spelling in original codebase

---

### 2. Domain Not Found

**Trigger**: Domain name not in MANIFEST

**Response**:

```json
{
  "available_domains": ["csv-adapters", "migration-pipelines", "core-cli"],
  "error": "Domain 'csv-processing' not found in MANIFEST",
  "hint": "Run '/index' to regenerate domain indices",
  "status": "error"
}
```

**Recovery**:

- Check available_domains list for correct name
- Run `/index` command to regenerate PROJECT_INDEX.json
- Verify MANIFEST.json exists at project root

---

### 3. Invalid Query Type

**Trigger**: Unrecognized query type

**Response**:

```json
{
  "available_queries": [
    "blast-radius",
    "find-callers",
    "find-calls",
    "trace-to-error",
    "dead-code",
    "cycles",
    "hotspots",
    "cross-domain"
  ],
  "error": "Unknown query type 'find-dependencies'",
  "hint": "See @query-library.md for supported queries",
  "status": "error"
}
```

**Recovery**:

- Use one of the available_queries
- Consult @query-library.md for query documentation
- Rephrase request using supported terminology

---

### 4. PROJECT_INDEX.json Missing

**Trigger**: No index file found at project root

**Response**:

```json
{
  "error": "PROJECT_INDEX.json not found at project root",
  "hint": "Run /index command to generate PROJECT_INDEX.json",
  "status": "error"
}
```

**Recovery**:

- Run `/index` slash command
- Verify git repository root
- Check file permissions

---

### 5. Could Not Extract Function Name

**Trigger**: Query dispatcher cannot parse function name from natural language

**Response**:

```json
{
  "error": "Could not extract function name from query",
  "hint": "Wrap function name in backticks like `functionName` or use 'function X' syntax",
  "status": "error"
}
```

**Recovery**:

- Use backticks: `functionName`
- Use explicit syntax: "who calls function parseDate"
- Use camelCase/PascalCase: "who calls parseDate"

---

### 6. File:Line Not Found

**Trigger**: trace-to-error can't find function at specified location

**Response**:

```json
{
  "error": "No function found at apps/cli/src/main.ts:999",
  "hint": "Line number may be out of range or function definition not indexed",
  "status": "error"
}
```

**Recovery**:

- Verify line number is correct
- Check if file is in indexed domain
- Run `/index` to refresh index

---

### 7. Empty Results

**Trigger**: Query succeeds but returns no results

**Response**:

```json
{
  "domain": "csv-processing",
  "message": "No dead code found - all functions are called",
  "query": "dead-code",
  "results": [],
  "status": "success",
  "summary": {
    "total": 0
  }
}
```

**Interpretation**: Not an error - query succeeded but found nothing

---

### 8. Domain Index Corrupted

**Trigger**: Malformed JSON in PROJECT_INDEX.json

**Response**:

```json
{
  "error": "Failed to parse domain index for 'csv-processing'",
  "hint": "Run /index to regenerate indices",
  "status": "error"
}
```

**Recovery**:

- Run `/index` command
- Check git status (may have merge conflict)
- Verify PROJECT_INDEX.json is valid JSON

---

## Error Handling Best Practices

### For AI Agents

**Always check status field first**:

```python
result = run_query(query)
if result["status"] == "error":
    # Show user the error message
    print(result["error"])
    # Show actionable hint
    print("Suggestion:", result["hint"])
    # Offer alternatives if available
    if "suggestions" in result:
        print("Did you mean:", result["suggestions"])
```

**Graceful degradation**:

```python
# If query fails, fall back to reading files
if result["status"] == "error":
    if "PROJECT_INDEX.json not found" in result["error"]:
        # Fall back to grep/glob
        return search_files_manually(target)
```

**User-friendly messaging**:

```python
# Transform technical errors into user guidance
if "Function not found" in result["error"]:
    return f"I couldn't find {target}. Did you mean {result['suggestions'][0]}?"
```

---

## Debugging Failed Queries

### Step 1: Check Index Exists

```bash
ls PROJECT_INDEX.json
# If missing: run /index
```

### Step 2: Validate JSON

```bash
jq . PROJECT_INDEX.json > /dev/null
# If fails: regenerate with /index
```

### Step 3: Check Domain Exists

```bash
jq -r '.m.domains[].name' PROJECT_INDEX.json
# Should list all available domains
```

### Step 4: Check Function Exists

```bash
jq -r '.f[].n' PROJECT_INDEX.json | grep parseDate
# Should return function name if indexed
```

---

## Error Code Reference

| Error Pattern                | Cause               | Fix                              |
| ---------------------------- | ------------------- | -------------------------------- |
| Function not found           | Typo or not indexed | Check suggestions, run /index    |
| Domain not found             | Wrong domain name   | Check available_domains list     |
| Invalid query type           | Unsupported query   | Use available_queries            |
| PROJECT_INDEX.json not found | Index not generated | Run /index command               |
| Could not extract function   | Ambiguous input     | Use backticks or explicit syntax |
| File:line not found          | Wrong location      | Verify file path and line number |
| Empty results                | No matches          | Query succeeded, no data found   |
| Domain index corrupted       | Malformed JSON      | Regenerate with /index           |

---

**Fast • Deterministic • Token-Efficient**
