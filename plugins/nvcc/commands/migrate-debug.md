---
name: migrate-debug
description:
  Debugs a migration run by analyzing logs for a specific correlation ID, then runs code analysis if
  issues are found. Use when troubleshooting failed or problematic migrations, or when mentioned
  'debug migration', 'debug run', 'debug correlation'.
argument-hint: [correlation-id]
---

# Debug Migration

Debugs a migration run by analyzing logs for a specific correlation ID. Uses file-analyzer to
examine migration logs for errors, warnings, validation issues, duplicates, rollback events, and
success metrics. If any issues are found, runs code-analyzer to identify root causes and suggest
fixes.

## Pattern

**Pattern 3**: Agent Orchestration

Multi-step workflow that coordinates specialized agents to investigate and debug migration runs:

1. **Log Extraction**: Filters migration logs by correlation ID from today's log file
2. **File Analysis**: Examines logs for errors, warnings, validation issues, duplicates, rollback
   events, and success metrics
3. **Code Analysis** (conditional): Only if issues found - identifies root causes in source code
4. **Reporting**: Comprehensive debug report with findings, source locations, and suggested fixes

## How It Works

### Phase 1: Log Extraction & Confirmation

Extracts all log entries matching the correlation ID from today's migration log file:

```
apps/migration-cli/logs/migration-{YYYY-MM-DD}.jsonl
```

**If correlation ID provided**: Proceeds directly to Phase 2.

**If correlation ID not provided**: Automatically looks at the tail end of the log file to find the
most recent migration run and extracts the correlation ID. Then **asks the user to confirm** with
the correlation ID and the run date before proceeding.

Example confirmation prompt:

```
Detected most recent migration run:
- Correlation ID: be8ce52a-cc8a-45da-9b7c-ef895b1c5c58
- Run Date: 2025-11-11

Proceed with analyzing this run?
```

Each log entry contains:

- `level`: 20=info, 30=warn, 40=error, 50=critical, 60=fatal
- `correlationId`: Run identifier
- `msg`: Human-readable message
- `component`: Service that logged the entry
- `entity`: Dataverse entity name (if applicable)
- Stack traces for errors

### Phase 2: File Analysis

Launches file-analyzer agent to examine extracted logs for:

**Errors & Warnings**:

- Level 40+ entries (errors, critical, fatal)
- Level 30 entries (warnings)
- TaxonomyError codes (e.g., DATAVERSE-E005)

**Validation Issues**:

- Query failures
- OData filter syntax errors
- Connection problems
- Metadata resolution failures

**Duplicate Operations**:

- Repeated actions with same correlationId
- Multiple attempts on same entity

**Rollback Events**:

- COMPENSATION phase entries
- Rollback reasons and outcomes

**Success Metrics**:

- `successRate` percentage
- `processedCount` and `failedRows`
- `explosionRatio` (records created per CSV row)
- Duration and performance

### Phase 3: Code Analysis (Conditional)

**Only if Phase 2 finds issues**, launches code-analyzer agent to:

1. Extract stack traces from error log entries
2. Locate source files from stack trace paths
3. Analyze error patterns and root causes
4. Identify problematic code:
   - Missing null checks
   - Incorrect OData filters
   - Race conditions
   - Configuration issues
5. Suggest fixes with exact file:line references

### Phase 4: Summary Report

Consolidates findings:

**If No Issues Found**:

- Migration completed successfully
- Summary of operations performed
- Success metrics and performance

**If Issues Found**:

- Error count and types
- Warning count by category
- Source files affected with line numbers
- Root cause analysis
- Suggested fixes for each issue
- Validation issues and duplicates if present
- Rollback events and compensation actions

## Examples

```
# Debug a specific migration run by correlation ID
/debug-migration be8ce52a-cc8a-45da-9b7c-ef895b1c5c58

# Debug the most recent migration run (auto-detects correlation ID from tail of logs)
/debug-migration

# Debug another specific run
/debug-migration c501f831-a5be-f011-bbd3-6045bdc366ee
```

## Log Format Reference

**JSONL Entry Example**:

```json
{
  "component": "referral-creation-service",
  "correlationId": "be8ce52a-cc8a-45da-9b7c-ef895b1c5c58",
  "entity": "exco_referral",
  "error": "Query failed: Invalid filter syntax",
  "level": 40,
  "msg": "[createReferral] OData query failed",
  "recordId": "c501f831-a5be-f011-bbd3-6045bdc366ee",
  "stack": "Error: OData filter parsing failed\n    at parseFilter (src/lib/services/dataverse-service.ts:152)\n    at createReferral (src/lib/services/referral-creation-service.ts:89)",
  "time": "2025-11-11T03:05:17.232Z"
}
```

## Use Cases

- **Debugging failed migrations**: Find root cause of errors and get suggested fixes
- **Performance troubleshooting**: Analyze explosion ratio and identify bottlenecks
- **Validation testing**: Verify data transformation correctness
- **Duplicate detection**: Identify repeated operations in migration run
- **Rollback analysis**: Understand compensation events and retry logic
