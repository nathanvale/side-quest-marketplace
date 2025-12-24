---
description: Trace logs by correlation ID for debugging para-obsidian operations
argument-hint: [correlation-id]
allowed-tools: Bash(grep:*), Bash(cat:*), Bash(jq:*), Bash(wc:*), Bash(awk:*), Bash(sort:*)
model: haiku
---

# Trace Logs for Correlation ID: `$1`

Analyze para-obsidian operation logs for correlation ID `$1`.

## Overview

The correlation ID is shown at the start and end of CLI commands:
```
▸ para scan [a1b2c3d4]
... command output ...
Session: a1b2c3d4 (3.2s)
```

## Instructions

Follow these steps to analyze the trace:

### Step 1: Extract Log Entries

First check if the correlation ID exists:

```bash
grep "$1" ~/.claude/logs/para-obsidian.jsonl | wc -l
```

If the count is 0, skip to Step 6 (Handle Missing Logs). Otherwise continue.

Fetch logs for this session (limited to 1000 most recent entries) and parse as JSON stream:

```bash
grep "$1" ~/.claude/logs/para-obsidian.jsonl | tail -n 1000 | jq -c 'select(.) | .' | jq -s 'sort_by(.["@timestamp"])'
```

**Note:** Result limit prevents memory exhaustion on large log files. To analyze older entries, filter by timestamp or use smaller correlation ID queries.

**Note:** Log file location defaults to `~/.claude/logs/para-obsidian.jsonl`
- Override with: `PARA_OBSIDIAN_LOG_DIR=/custom/path`

### Step 2: Build Trace Tree

Parse the JSON logs and build a hierarchical tree structure showing parent-child operation relationships.

**Instructions:**
1. Find the root operation (where `properties.sessionCid == properties.cid` OR `properties.parentCid` is null/empty)
2. For each operation, find its children (where `properties.parentCid == operation.cid`)
3. Build ASCII tree showing hierarchy with indentation
4. Include operation name (from `message` or `properties.event`), duration, and status for each node

**Expected Format:**
```
Session: a1b2c3d4 (3.2s total)
├─ scan [e400fff2] 3.2s
│  ├─ enrichFile [7c3a3dcf] 2.1s ⚠️ 142% over threshold
│  │  └─ firecrawlScrape 2.0s (network)
│  ├─ extractContent [6776a3c6] 0.8s ✓
│  └─ classify [45c84df0] 0.3s ✓
└─ execute [75f5c2a9] 0.14s ✓
   └─ createNote 0.09s ✓
```

**Status Icons:**
- `✓` - Operation within threshold
- `⚠️` - Operation exceeded threshold
- `✗` - Operation failed (level="error")

### Step 3: Identify Performance Issues

Check each operation with `properties.durationMs` against these thresholds:

**Thresholds (from src/inbox/shared/thresholds.ts):**
- `scanTotalMs`: 60,000ms (60s)
- `executeTotalMs`: 30,000ms (30s)
- `extractionMs`: 5,000ms (5s)
- `enrichmentMs`: 5,000ms (5s)
- `llmCallMs`: 10,000ms (10s)

**SLO Definitions (from src/inbox/shared/slos.ts):**
- `scan_latency`: 95% under 60s (threshold: 60,000ms)
- `execute_latency`: 95% under 30s (threshold: 30,000ms)
- `extraction_latency`: 95% under 5s (threshold: 5,000ms)
- `enrichment_latency`: 95% under 5s (threshold: 5,000ms)
- `llm_latency`: 90% under 10s (threshold: 10,000ms)
- `execute_success`: 99% success rate
- `llm_availability`: 80% available

**Calculation:**
For each operation with `durationMs`:
1. Identify which threshold applies based on operation type (from `logger` or `event` field)
2. Compare actual duration against threshold
3. Calculate percentage: `Math.round((durationMs / threshold) * 100)`
4. Mark as ⚠️ if exceeded (>100%), ✓ if within (≤100%)

**Mapping operations to thresholds:**
- `scan_*` events → `scanTotalMs` (60s)
- `execute_*` events → `executeTotalMs` (30s)
- `extract_*`, `*_extraction` events → `extractionMs` (5s)
- `enrich_*`, `slow_enrichment` events → `enrichmentMs` (5s)
- `llm_*`, `slow_llm_call` events → `llmCallMs` (10s)

### Step 4: Generate Report

Provide a comprehensive analysis with these sections:

#### 1. Operation Timeline
Chronological list of operations from parsed logs:
```
14:23:45.123 → scan started [e400fff2]
14:23:45.234 → enrichFile started [7c3a3dcf]
14:23:47.345 → enrichFile completed (2.1s) ⚠️ 142% over 5s threshold
14:23:48.456 → scan completed (3.2s) ✓
```

**Format:** `HH:MM:SS.mmm → {operation} [{cid}] {duration}ms {status}`

#### 2. Trace Tree
ASCII tree structure from Step 2 showing operation hierarchy

#### 3. Performance Summary
```
Total session duration: 3.2s
Operations executed: 5

Slowest operations:
  1. enrichFile: 2.1s (142% over 5s threshold) [7c3a3dcf]
  2. extractContent: 0.8s (16% of 5s threshold) [6776a3c6]
  3. classify: 0.3s (3% of 10s threshold) [45c84df0]

Threshold violations: 1 operation
  - enrichFile: 2,100ms vs 5,000ms threshold (exceeded by 2,100ms / 142%)

SLO compliance:
  - scan_latency: ✓ PASS (3.2s < 60s target)
  - enrichment_latency: ✗ FAIL (2.1s > 5s target)
```

**For each threshold violation:**
- Operation name
- Actual duration in ms
- Threshold value in ms
- Amount exceeded by (ms and percentage)

**For SLO compliance:**
- Check actual durations against SLO thresholds
- Mark ✓ PASS if within target, ✗ FAIL if exceeded
- Only report SLOs relevant to operations found in logs

#### 4. Errors/Warnings
List any log entries with `level="error"` or `level="warn"`:
```
Errors (2):
  - 14:23:46.123 [llm] LLM timeout after 10s [abc123def]
  - 14:23:47.456 [inbox] Failed to process file: invalid JSON

Warnings (1):
  - 14:23:45.890 [enrich] Firecrawl rate limit approaching
```

If none found, display: `No errors or warnings detected`

#### 5. Recommendations
Based on issues found, provide actionable debugging steps:

**For slow enrichment (>5s):**
- Check network connectivity to external APIs (Firecrawl, etc.)
- Verify API keys and rate limits
- Consider enabling caching if available

**For slow LLM calls (>10s):**
- Check Ollama/Claude API availability
- Verify model is downloaded (Ollama) or API key is valid (Claude)
- Consider switching to faster model (e.g., haiku instead of sonnet)

**For slow extraction (>5s):**
- Verify pdf-to-text installation: `which pdf-to-text`
- Check file size (large PDFs take longer)
- Consider pre-processing large files

**For errors:**
- Check specific error messages for root cause
- Review relevant subsystem logs (logger field)
- Verify environment configuration (PARA_VAULT, API keys)

**If no issues found:**
```
✓ All operations completed within performance targets
✓ No errors or warnings detected
```

### Step 5: Calculate Session Metrics

From the logs, extract and calculate:

**Session Duration:**
- First log timestamp vs last log timestamp
- Convert to human readable (e.g., "3.2s" or "1m 23s")

**Operation Counts:**
- Total operations logged
- Operations with errors (level="error")
- Operations with warnings (level="warn")
- Operations exceeding thresholds

**Average Durations (where available):**
- Average scan time
- Average enrichment time
- Average LLM call time

### Step 6: Handle Missing Logs

If `grep "$1"` returns no results (count = 0):

```
⚠️ No logs found for correlation ID: $1

Possible reasons:
  - Typo in correlation ID (check CLI output carefully)
  - Logs rotated (events older than 90 days are pruned)
  - Logging disabled (check PARA_OBSIDIAN_LOG_DIR)
  - Session never ran (no operations executed)

How to find recent correlation IDs:
```bash
# List last 20 unique session IDs
grep -o '"sessionCid":"[a-f0-9]*"' ~/.claude/logs/para-obsidian.jsonl | sort -u | tail -20 | cut -d'"' -f4

# Show recent sessions with timestamps
grep '"sessionCid"' ~/.claude/logs/para-obsidian.jsonl | jq -r '[."@timestamp", .properties.sessionCid] | @tsv' | tail -20
```

**Next steps:**
1. Verify the correlation ID from CLI output (look for `▸ para scan [CID]`)
2. Check if logging is enabled: `ls -la ~/.claude/logs/para-obsidian.jsonl`
3. Try a recent session ID from the suggestions above
```

---

## Implementation Notes

**JSON Parsing:**
- **CRITICAL:** Use `tail -n 1000` before `jq -s` to prevent OOM on large logs
- Stream mode: `jq -c 'select(.) | .'` filters and compacts before slurp
- Slurp mode: `jq -s '.'` only after limiting results (safe for arrays)
- Sort by timestamp: `sort_by(.["@timestamp"])`
- Group by field: `group_by(.properties.cid)`

**Memory Safety:**
- Always limit grep results before using `jq -s` (slurp mode)
- For large result sets, use streaming `jq '.'` instead of `jq -s '.'`
- Maximum 1000 log entries processed to prevent resource exhaustion

**Duration Formatting:**
- <1000ms: Display as "XXXms"
- ≥1000ms <60s: Display as "X.Xs"
- ≥60s: Display as "Xm XXs"

**Tree Building Algorithm:**
1. Parse all logs into array
2. Build map of `cid → log entries`
3. Find root (where `sessionCid == cid` OR no `parentCid`)
4. Recursively build tree by finding children (where `parentCid == current cid`)
5. Format with ASCII tree characters: `├─`, `│`, `└─`

**Threshold Mapping Logic:**
```bash
# Pseudo-code for determining threshold
if event matches "scan_*" OR logger="inbox.scan":
  threshold = 60000ms (scanTotalMs)
elif event matches "execute_*":
  threshold = 30000ms (executeTotalMs)
elif event matches "enrich_*" OR event="slow_enrichment":
  threshold = 5000ms (enrichmentMs)
elif event matches "llm_*" OR event="slow_llm_call":
  threshold = 10000ms (llmCallMs)
elif event matches "extract_*" OR logger contains "extract":
  threshold = 5000ms (extractionMs)
```

---

**Now execute the analysis for correlation ID `$1`.**
