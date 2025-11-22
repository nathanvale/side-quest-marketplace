# Integration Best Practices

**Best practices, error handling, and token metrics for integrating with index-graph-navigator**

## Best Practices for Skill Integration

### 1. Query Before Reading

**Always** get structural information from navigator before reading files.

**❌ Wrong**:

```
Read entire codebase → Analyze manually
```

**✅ Correct**:

```
Query navigator → Get file:line references → Read only those locations
```

---

### 2. Use Natural Language Queries

The dispatcher handles ambiguous requests well.

**Good**:

```
Skill(index-graph-navigator) with query: "who calls parseDate in csv-processing"
```

**Also Good**:

```
Skill(index-graph-navigator) with query:
{
  "query": "find-callers",
  "target": "parseDate",
  "domain": "csv-processing"
}
```

Both work - use natural language for simplicity, structured for precision.

---

### 3. Handle Errors Gracefully

Navigator returns structured errors - parse and present to user.

**Example**:

```javascript
const result = await queryNavigator("blast radius of parseDate");
if (result.status === "error") {
  if (result.suggestions) {
    // Show suggestions to user
    console.log(`Did you mean: ${result.suggestions.join(", ")}?`);
  }
  if (result.hint) {
    // Show actionable guidance
    console.log(result.hint);
  }
}
```

---

### 4. Cache Results Within Session

Don't query the same information twice.

**Pattern**:

```javascript
const cache = new Map();

function queryCached(query) {
  if (cache.has(query)) return cache.get(query);
  const result = queryNavigator(query);
  cache.set(query, result);
  return result;
}
```

---

### 5. Combine Queries for Richer Context

Use multiple queries to build comprehensive understanding.

**Example**:

```
1. Get hotspots → Find critical functions
2. Get blast radius for each hotspot → Understand impact
3. Get cross-domain for each domain → Understand coupling
4. Present: "Critical functions + their impact + coupling analysis"
```

---

## Error Handling Patterns

### Pattern 1: Function Not Found → Fuzzy Match

**Error**:

```json
{
  "error": "Function 'parsDate' not found",
  "status": "error",
  "suggestions": ["parseDate", "parseData"]
}
```

**Handling**:

```
if (error.suggestions && error.suggestions.length === 1) {
  // Auto-correct to single suggestion
  retryWith(error.suggestions[0])
} else {
  // Ask user to clarify
  askUser("Did you mean: " + error.suggestions.join(", "))
}
```

---

### Pattern 2: Indices Not Found → Guide User

**Error**:

```json
{
  "error": "PROJECT_INDEX.json not found",
  "hint": "Run /index command",
  "status": "error"
}
```

**Handling**:

```
presentToUser("Please run `/index` command first to generate the project index.")
```

---

### Pattern 3: Domain Not Found → List Available

**Error**:

```json
{
  "available_domains": ["csv-processing", "csv-adapters", "migration-pipelines"],
  "error": "Domain 'csv-process' not found",
  "status": "error"
}
```

**Handling**:

```
presentToUser("Available domains: " + error.available_domains.join(", "))
```

---

## Token Efficiency Metrics

### Typical Token Savings by Use Case

| Use Case             | Traditional Approach               | Navigator Approach            | Savings |
| -------------------- | ---------------------------------- | ----------------------------- | ------- |
| **Find callers**     | Read 5-10 files (10K tokens)       | Query + targeted reads (1.2K) | 88%     |
| **Blast radius**     | Read 20+ files (30K tokens)        | Query + targeted reads (3.6K) | 88%     |
| **Dead code**        | Read all files (50K tokens)        | Query only (500 tokens)       | 99%     |
| **Debug error**      | Read 15+ files (20K tokens)        | Query + trace (2.2K)          | 90%     |
| **Refactor plan**    | Read 25+ files (30K tokens)        | Query + analysis (3.6K)       | 88%     |
| **Dependency audit** | Read entire codebase (50K+ tokens) | Query all domains (2K)        | 96%     |

**Average savings**: 50-90% across all use cases

---

### Token Budget Guidelines

**For simple queries** (find-callers, find-calls):

- Navigator query: ~100 tokens
- Response: ~200 tokens
- Targeted reads: ~1000 tokens
- **Total**: ~1.3K tokens

**For complex queries** (blast-radius, trace-to-error):

- Navigator query: ~200 tokens
- Response: ~500 tokens
- Targeted reads: ~3000 tokens
- **Total**: ~3.7K tokens

**For comprehensive analysis** (multiple queries):

- Navigator queries (3-5): ~1000 tokens
- Responses: ~1500 tokens
- Targeted reads: ~5000 tokens
- **Total**: ~7.5K tokens

**Still 50-70% savings** compared to reading entire codebase!

---

## Integration Checklist

Before integrating index-graph-navigator into your skill:

- [ ] Skill has clear use case requiring codebase navigation
- [ ] Use navigator for structure, Read tool for details
- [ ] Handle all error types (function not found, index missing, domain invalid)
- [ ] Cache results within session (avoid redundant queries)
- [ ] Present file:line references to user (enable easy navigation)
- [ ] Measure token savings (compare before/after)
- [ ] Document integration in skill's README

---

## Performance Expectations

**Query Response Times**:

- Simple queries (hotspots, find-callers): < 100ms
- Complex queries (blast-radius, cycles): < 500ms
- Very large codebases: < 2s

**Token Costs**:

- Query: 100-200 tokens
- Response: 200-500 tokens
- Total per query: < 700 tokens

**Scalability**:

- Tested on codebases up to 100K LOC
- Handles 10K+ functions efficiently
- No significant degradation with size

---

## Future Improvements

Potential enhancements for integration:

1. **Streaming responses** for very large results
2. **Pagination** for queries returning 100+ items
3. **Caching layer** for frequently queried functions
4. **Incremental updates** when codebase changes
5. **Graph visualization** export (DOT format)

**Note**: Current implementation handles most use cases efficiently without these enhancements.
