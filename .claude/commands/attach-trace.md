---
name: attach-trace
description: Phase B attachment migration with trace logging, log analysis, and code debugging. Auto-discovers latest manifests and runs complete diagnostic workflow.
argument-hint: [limit N] [dry-run] [using fixtures]
---

# Attachment Migration Trace & Debug

## AGENT INSTRUCTIONS

**Goal**: Run Phase B migration with trace logging, analyze results, debug issues.

### VARIABLE DECLARATIONS

Parse user input and set variables (defaults shown):

```bash
# Configuration
LIMIT=""                    # Extract from: "limit N" (default: all files)
DRY_RUN="false"            # Extract from: "dry-run" or "dry-run true" (default: false)
USE_FIXTURES="true"        # Extract from: "using fixtures" (default: true)
LOG_LEVEL="trace"          # Always trace for debug workflow

# Directories
MIGRATIONS_DIR="migrations"
ATTACHMENTS_DIR="fixtures/blobs/attachments/manifests"
LOGS_DIR="logs"

# Files (discovered)
LATEST_PHASE_A=""          # Migrated referrals manifest
LATEST_PHASE_B=""          # Attachment batch manifest
LOG_FILE=""                # Today's log file
OUTPUT_FILE="/tmp/attach-trace-output.log"

# Results (extracted)
CORRELATION_ID=""          # From migration output
EXIT_CODE=""               # Migration exit code
ISSUES_FOUND="false"       # From file-analyzer
```

### WORKFLOW

**Step 1: Discover Latest Manifests**

```bash
LATEST_PHASE_A=$(ls -t "$MIGRATIONS_DIR"/*.json 2>/dev/null | head -1)
LATEST_PHASE_B=$(ls -t "$ATTACHMENTS_DIR"/*.json 2>/dev/null | \
  grep -v '\.state\.json$' | grep -v '\.run\.' | head -1)

# Validation
if [ -z "$LATEST_PHASE_A" ] || [ -z "$LATEST_PHASE_B" ]; then
  echo "❌ ERROR: Manifests not found"
  echo "  Phase A directory: $MIGRATIONS_DIR"
  echo "  Phase B directory: $ATTACHMENTS_DIR"
  exit 1
fi

echo "✅ Manifests discovered:"
echo "  Phase A: $(basename "$LATEST_PHASE_A")"
echo "  Phase B: $(basename "$LATEST_PHASE_B")"
```

**Step 2: Build CLI Command**

```bash
# Build flags
LIMIT_FLAG=""
[ -n "$LIMIT" ] && LIMIT_FLAG="--limit=$LIMIT"

DRY_RUN_FLAG=""
[ "$DRY_RUN" = "true" ] && DRY_RUN_FLAG="--dry-run"

# Build command
CLI_CMD="LOG_LEVEL=$LOG_LEVEL USE_FIXTURES=$USE_FIXTURES npx tsx src/cli.ts migrate attachments"
CLI_CMD="$CLI_CMD --manifest-migrated=\"$LATEST_PHASE_A\""
CLI_CMD="$CLI_CMD --manifest-attachments=\"$LATEST_PHASE_B\""
[ -n "$LIMIT_FLAG" ] && CLI_CMD="$CLI_CMD $LIMIT_FLAG"
[ -n "$DRY_RUN_FLAG" ] && CLI_CMD="$CLI_CMD $DRY_RUN_FLAG"

echo "✅ Command built: $CLI_CMD"
```

**Step 3: Execute Migration**

```bash
echo "🚀 Running migration..."
eval "$CLI_CMD" 2>&1 | tee "$OUTPUT_FILE"
EXIT_CODE=${PIPESTATUS[0]}

# Validation
if [ $EXIT_CODE -ne 0 ]; then
  echo "❌ ERROR: Migration failed (exit code: $EXIT_CODE)"
  echo "  Output saved to: $OUTPUT_FILE"
  exit $EXIT_CODE
fi

echo "✅ Migration completed (exit code: $EXIT_CODE)"
```

**Step 4: Extract Correlation ID**

```bash
CORRELATION_ID=$(grep -o 'Correlation ID: [a-f0-9-]*' "$OUTPUT_FILE" | head -1 | cut -d' ' -f3)

# Validation
if [ -z "$CORRELATION_ID" ]; then
  echo "❌ ERROR: Could not extract correlation ID"
  echo "  Check output file: $OUTPUT_FILE"
  exit 1
fi

LOG_FILE="$LOGS_DIR/migration-$(date +%Y-%m-%d).jsonl"

echo "✅ Correlation ID: $CORRELATION_ID"
echo "✅ Log file: $LOG_FILE"
```

**Step 5: Launch file-analyzer Agent**

Use Task tool with file-analyzer to analyze logs:

```
Analyze attachment migration logs for correlation ID: $CORRELATION_ID

Log file: $LOG_FILE

Report:
1. Upload counts: total, uploaded, skipped, errors
2. Performance: duration, throughput
3. Errors: level 40/50/60 with details
4. Warnings: level 30 with context
5. Validation issues: preflight failures, missing files
6. Root cause summary: why files failed/skipped

Format:
- Concise bullet points
- Specific file names and ref numbers for failures
- Error codes and messages
- Actionable findings

Set ISSUES_FOUND=true if any errors/warnings detected.
```

**Validation**: Wait for agent to complete and return findings.

**Step 6: Launch code-analyzer Agent (Conditional)**

Only if `ISSUES_FOUND=true`:

```
Debug attachment migration issues found by file-analyzer.

Findings from file-analyzer:
[Insert findings here]

Investigate:
1. Trace code paths for each error type
2. Identify root causes with file:line references
3. Suggest fixes with code examples
4. Assess impact

Provide:
- Root cause analysis for each issue
- File:line references
- Before/after code snippets
- Priority (P0/P1/P2)
```

**Validation**: Wait for agent to complete analysis.

**Step 7: Generate Summary Report**

Consolidate findings:

```
📋 ATTACHMENT MIGRATION DEBUG REPORT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📌 Configuration
  Phase A: $(basename "$LATEST_PHASE_A")
  Phase B: $(basename "$LATEST_PHASE_B")
  Limit: ${LIMIT:-all}
  Dry-run: $DRY_RUN
  Fixtures: $USE_FIXTURES
  Correlation: $CORRELATION_ID

📊 Results
  [file-analyzer summary]

[If ISSUES_FOUND=true]
🔴 Issues & Root Causes
  [code-analyzer findings]

🎯 Recommendations
  [Prioritized action items]

📋 Artifacts
  Output: $OUTPUT_FILE
  Logs: $LOG_FILE
```

### ERROR HANDLING

- **Step 1 failure**: Manifests not found → Exit with error, show directories
- **Step 3 failure**: Migration failed → Exit with code, preserve logs
- **Step 4 failure**: No correlation ID → Exit, show output file
- **Step 5 failure**: Agent error → Report agent output, continue to summary
- **Step 6 failure**: Agent error → Report partial findings

### FINAL VALIDATION

Checklist:

- ✅ Both manifests found
- ✅ Migration executed
- ✅ Correlation ID extracted
- ✅ Logs analyzed
- ✅ Issues investigated (if any)
- ✅ Summary generated

Exit with code 0 if all validations pass.

## EXAMPLES

```bash
# Auto-discover, use defaults
/attach-trace

# Process 5 files only
/attach-trace limit 5

# Dry-run mode
/attach-trace dry-run true

# Custom parameters
/attach-trace limit 10 using fixtures
```

## NOTES

- Agents run **sequentially**: file-analyzer → code-analyzer
- code-analyzer receives file-analyzer findings as input
- Manifests sorted by mtime (newest first)
- State/run log files excluded from discovery
- Trace logging provides maximum visibility
