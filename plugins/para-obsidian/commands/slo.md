---
description: Monitor SLO health and burn rates for para-obsidian operations
argument-hint: [slo-name|--breaches]
allowed-tools: Bash(cat:*), Bash(jq:*), Bash(date:*)
model: claude-haiku-4-5-20251001
---

# SLO Health Monitor

Monitor Service Level Objectives for para-obsidian inbox processing operations.

## Available SLOs

From `src/inbox/shared/slos.ts`:

1. **scan_latency** - 95% of scans complete under 60s (30d window)
2. **execute_success** - 99% of executions succeed (7d window)
3. **llm_availability** - 80% of LLM calls succeed (24h window)
4. **execute_latency** - 95% of executions complete under 30s (30d window)
5. **extraction_latency** - 95% of extractions complete under 5s (7d window)
6. **enrichment_latency** - 95% of enrichments complete under 5s (7d window)
7. **llm_latency** - 90% of LLM calls complete under 10s (24h window)

## Usage

```bash
/para-obsidian:slo                  # All SLOs dashboard
/para-obsidian:slo scan_latency     # Specific SLO details
/para-obsidian:slo --breaches       # Recent violations only
```

## Instructions

### 1. Check if SLO Events Exist

First, check if the SLO events file exists:

```bash
if [ -f ~/.claude/logs/slo-events.jsonl ]; then
  wc -l ~/.claude/logs/slo-events.jsonl
else
  echo "FILE_NOT_FOUND"
fi
```

If the output is `FILE_NOT_FOUND`, skip to the "Handle Missing File" section below.

### 2. Determine Display Mode

Based on the argument `$1`:
- **No argument** → Dashboard mode (all SLOs)
- **`--breaches`** → Breaches mode (recent violations)
- **Specific SLO name** → Detail mode (single SLO analysis)

### 3. Dashboard Mode (No Argument)

Show all SLOs with health status (limited to 5000 most recent events):

```bash
tail -n 5000 ~/.claude/logs/slo-events.jsonl | jq -s '
  # Define metadata mapping
  {
    scan_latency: {target: 0.95, threshold: 60000, unit: "ms", window: "30d", error_budget: 0.05},
    execute_success: {target: 0.99, threshold: 99, unit: "percent", window: "7d", error_budget: 0.01},
    llm_availability: {target: 0.8, threshold: 80, unit: "percent", window: "24h", error_budget: 0.2},
    execute_latency: {target: 0.95, threshold: 30000, unit: "ms", window: "30d", error_budget: 0.05},
    extraction_latency: {target: 0.95, threshold: 5000, unit: "ms", window: "7d", error_budget: 0.05},
    enrichment_latency: {target: 0.95, threshold: 5000, unit: "ms", window: "7d", error_budget: 0.05},
    llm_latency: {target: 0.9, threshold: 10000, unit: "ms", window: "24h", error_budget: 0.1}
  } as $meta_map |

  # Group by SLO name and calculate metrics
  group_by(.sloName) |
  map(
    {
      slo: .[0].sloName,
      total: length,
      violated: [.[] | select(.violated == true)] | length,
      recent_24h: [.[] | select(.timestamp > (now - 86400) * 1000)] | length,
      recent_violated_24h: [.[] | select(.violated == true and .timestamp > (now - 86400) * 1000)] | length,
      last_violation: ([.[] | select(.violated == true)] | max_by(.timestamp) // null)
    } |
    . as $item |
    ($meta_map[.slo] // {target: 1, threshold: 0, unit: "unknown", window: "unknown", error_budget: 0.01}) as $meta |
    ((.total - .violated) / .total) as $compliance |
    ($meta.error_budget - (.violated / .total)) as $budget_remaining |
    (if .total == 0 then 0 else ((.violated / .total) / $meta.error_budget) end) as $burn_rate |
    (if $compliance >= $meta.target then "✓" elif $budget_remaining < 0.3 then "⚠️" else "✗" end) as $status |

    . + {
      meta: $meta,
      compliance: $compliance,
      budget_remaining: $budget_remaining,
      burn_rate: $burn_rate,
      status: $status
    }
  )
' | jq -r '
  def format_duration(ms):
    if ms == null then "never"
    else
      ((now * 1000 - ms) / 1000) |
      if . < 60 then "\(. | floor)s ago"
      elif . < 3600 then "\((. / 60) | floor)m ago"
      elif . < 86400 then "\((. / 3600) | floor)h ago"
      else "\((. / 86400) | floor)d ago"
      end
    end;

  "=== SLO Health Dashboard ===",
  "",
  (.[] |
    "\(.slo) (\((.meta.target * 100 | floor))% target, \(.meta.threshold)\(.meta.unit), \(.meta.window) window)",
    "  Status: \(.status) \(if .compliance >= .meta.target then "PASSING" else "BREACHED" end)",
    "  Compliance: \((.compliance * 100 * 100 | floor) / 100)% (target: \((.meta.target * 100 | floor))%)",
    "  Error Budget: \((.budget_remaining * 100 | floor))% remaining",
    "  Burn Rate: \((.burn_rate * 100 | floor) / 100)x \(if .burn_rate > 1 then "(fast burn, investigate!)" elif .burn_rate > 0.5 then "(moderate burn)" else "(slow burn, safe)" end)",
    "  Recent Events: \(.recent_24h) total, \(.recent_violated_24h) violated (\(if .recent_24h > 0 then ((.recent_violated_24h / .recent_24h * 100) | floor) else 0 end)%)",
    "  Last Breach: \(format_duration(.last_violation.timestamp))",
    ""
  )
'
```

### 4. Detail Mode (Specific SLO)

When `$1` is an SLO name (e.g., `scan_latency`):

```bash
# Validate SLO name
case "$1" in
  scan_latency|execute_success|llm_availability|execute_latency|extraction_latency|enrichment_latency|llm_latency)
    # Valid SLO
    ;;
  *)
    echo "❌ Unknown SLO: $1"
    echo ""
    echo "Available SLOs:"
    echo "  - scan_latency"
    echo "  - execute_success"
    echo "  - llm_availability"
    echo "  - execute_latency"
    echo "  - extraction_latency"
    echo "  - enrichment_latency"
    echo "  - llm_latency"
    echo ""
    echo "Usage: /para-obsidian:slo [slo-name]"
    exit 1
    ;;
esac

# Filter events for specific SLO (limit to 5000 most recent)
tail -n 5000 ~/.claude/logs/slo-events.jsonl | jq -s --arg slo "$1" '
  [.[] | select(.sloName == $slo)] as $events |

  # Define SLO metadata
  (if $slo == "scan_latency" then
    {name: "Scan Latency", target: 0.95, threshold: 60000, unit: "ms", window: "30d", error_budget: 0.05, window_ms: 2592000000}
   elif $slo == "execute_success" then
    {name: "Execute Success Rate", target: 0.99, threshold: 99, unit: "percent", window: "7d", error_budget: 0.01, window_ms: 604800000}
   elif $slo == "llm_availability" then
    {name: "LLM Availability", target: 0.8, threshold: 80, unit: "percent", window: "24h", error_budget: 0.2, window_ms: 86400000}
   elif $slo == "execute_latency" then
    {name: "Execute Latency", target: 0.95, threshold: 30000, unit: "ms", window: "30d", error_budget: 0.05, window_ms: 2592000000}
   elif $slo == "extraction_latency" then
    {name: "Extraction Latency", target: 0.95, threshold: 5000, unit: "ms", window: "7d", error_budget: 0.05, window_ms: 604800000}
   elif $slo == "enrichment_latency" then
    {name: "Enrichment Latency", target: 0.95, threshold: 5000, unit: "ms", window: "7d", error_budget: 0.05, window_ms: 604800000}
   elif $slo == "llm_latency" then
    {name: "LLM Latency", target: 0.9, threshold: 10000, unit: "ms", window: "24h", error_budget: 0.1, window_ms: 86400000}
   else
    null
   end) as $meta |

  # Filter to window
  ((now * 1000) - $meta.window_ms) as $cutoff |
  [$events[] | select(.timestamp >= $cutoff)] as $recent |

  # Calculate metrics
  ($recent | length) as $total |
  ([$recent[] | select(.violated == true)] | length) as $violations |
  (if $total > 0 then ($total - $violations) / $total else 1 end) as $compliance |
  (if $total > 0 then ($violations / $total) / $meta.error_budget else 0 end) as $burn_rate |
  ($meta.error_budget - (if $total > 0 then $violations / $total else 0 end)) as $budget_remaining |
  (if $burn_rate > 0 then ($budget_remaining * ($meta.window_ms / 86400000) / $burn_rate) else 999 end) as $days_until_exhausted |

  # Get violations for display
  [$recent[] | select(.violated == true)] | sort_by(.timestamp) | reverse | .[0:10] as $recent_violations |

  # Calculate percentiles
  [$recent[] | .value] | sort as $sorted_values |
  ($sorted_values | length) as $count |
  {
    p50: (if $count > 0 then $sorted_values[($count * 0.5) | floor] else 0 end),
    p90: (if $count > 0 then $sorted_values[($count * 0.9) | floor] else 0 end),
    p95: (if $count > 0 then $sorted_values[($count * 0.95) | floor] else 0 end),
    p99: (if $count > 0 then $sorted_values[($count * 0.99) | floor] else 0 end)
  } as $percentiles |

  {
    meta: $meta,
    total: $total,
    violations: $violations,
    compliance: $compliance,
    burn_rate: $burn_rate,
    budget_remaining: $budget_remaining,
    days_until_exhausted: $days_until_exhausted,
    recent_violations: $recent_violations,
    percentiles: $percentiles
  }
' | jq -r '
  def format_date(ms):
    (ms / 1000) | strftime("%Y-%m-%d %H:%M");

  "=== SLO: \(.meta.name) ===\n",
  "Target: \((.meta.target * 100) | floor)% under \(.meta.threshold)\(.meta.unit) (\(.meta.window) window)",
  "Error Budget: \((.meta.error_budget * 100) | floor)%\n",

  "Current Status:",
  "  Compliance: \((.compliance * 100) | floor * 100 / 100)% (\(.total - .violations)/\(.total) within SLO)",
  "  Violations: \(.violations) events exceeded threshold",
  "  Burn Rate: \((.burn_rate | floor * 100) / 100)x (consuming budget at \(((.burn_rate * 100) | floor))% of allowed rate)\n",

  "Error Budget Status:",
  "  Remaining: \(((.budget_remaining * 100) | floor))% (\(((.meta.error_budget - .budget_remaining) * 100) | floor)% of \((.meta.error_budget * 100) | floor)% budget used)",
  "  Consumption Rate: \((.burn_rate | floor * 100) / 100)x sustainable rate",
  "  Days Until Exhausted: \(if .days_until_exhausted > 365 then "∞ (healthy)" else "\(.days_until_exhausted | floor) days (at current rate)" end)\n",

  (if (.recent_violations | length) > 0 then
    "Recent Violations (last 7d):",
    (.recent_violations[] |
      "  \(format_date(.timestamp)) → \(.value)\(.meta.unit) (threshold: \(.threshold)\(.meta.unit), +\(((.value - .threshold) / .threshold * 100) | floor)%)"
    ),
    ""
  else
    "No violations in window\n"
  end),

  "Percentiles (\(.meta.window)):",
  "  p50: \(.percentiles.p50)\(.meta.unit)",
  "  p90: \(.percentiles.p90)\(.meta.unit)",
  "  p95: \(.percentiles.p95)\(.meta.unit)",
  "  p99: \(.percentiles.p99)\(.meta.unit)\n",

  "Recommendations:",
  (if .compliance >= .meta.target then
    "  ✓ SLO is healthy (within target)"
  else
    "  ❌ SLO is breached (below target)"
  end),
  (if .burn_rate > 1 then
    "  ⚠️ Fast burn rate detected - investigate root causes"
  else
    "  ✓ Burn rate is sustainable"
  end),
  (if .budget_remaining < 0.3 then
    "  ⚠️ Error budget below 30% - consider freeze on risky changes"
  else
    "  ✓ Error budget is healthy"
  end),
  (if (.percentiles.p95 > .meta.threshold) then
    "  ℹ️ Consider investigating slow operations >\(.meta.threshold)\(.meta.unit)"
  else ""
  end)
'
```

### 5. Breaches Mode (`--breaches`)

Show only recent SLO violations:

```bash
# Get violations in last 7 days (7 * 24 * 60 * 60 * 1000 = 604800000 ms)
# Limit to 5000 most recent events to prevent OOM
tail -n 5000 ~/.claude/logs/slo-events.jsonl | jq -s '
  # Calculate cutoff time
  ((now * 1000) - 604800000) as $cutoff |

  # Filter to violations in last 7 days
  [.[] | select(.violated == true and .timestamp > $cutoff)] |
  sort_by(.timestamp) | reverse |

  # Group by SLO name
  group_by(.sloName) |
  map({
    slo: .[0].sloName,
    violations: .
  })
' | jq -r '
  def format_date(ms):
    (ms / 1000) | strftime("%Y-%m-%d %H:%M");

  "=== Recent SLO Breaches (7d) ===\n",

  (if length == 0 then
    "No SLO breaches in the last 7 days ✓"
  else
    (.[] |
      "\n\(.slo):",
      (.violations[] |
        "  \(format_date(.timestamp)) → \(.value) (threshold: \(.threshold), +\(((.value - .threshold) / .threshold * 100) | floor)%)"
      )
    ),
    "\n",
    "Total Breaches: \([.[] | .violations | length] | add) across \(length) SLOs",
    "Most Breached: \(sort_by(.violations | length) | reverse | .[0].slo) (\(sort_by(.violations | length) | reverse | .[0].violations | length) violations)"
  end)
'
```

### 6. Handle Missing File

If the SLO events file doesn't exist, display:

```
⚠️ No SLO events found at ~/.claude/logs/slo-events.jsonl

This means SLO recording has never run. Try:
1. Run: para scan
2. Run: para execute
3. Run: /para-obsidian:slo again

SLO events are recorded during scan and execute operations.
```

---

## Burn Rate Formula

Burn rate indicates how fast error budget is being consumed:

- **0** = No errors, budget not consumed
- **1** = Consuming at exactly target rate (sustainable)
- **>1** = Consuming faster than sustainable (investigate!)

**Formula:** `burnRate = (violations / totalEvents) / errorBudget`

**Example:**
- Target: 95% (errorBudget: 0.05)
- Actual: 94% violations (violationRate: 0.06)
- Burn Rate: 0.06 / 0.05 = **1.2x** (consuming 20% faster than sustainable)

---

## Status Icons

- **✓ PASSING** - Compliance >= target
- **⚠️ AT RISK** - Error budget < 30%
- **✗ BREACHED** - Compliance < target

---

## Implementation Notes

**Memory Safety:**
- **CRITICAL:** Use `tail -n 5000` before `jq -s` to prevent OOM on large logs
- SLO events file can grow unbounded - always limit before slurp mode
- For streaming analysis, use `jq '.'` instead of `jq -s '.'`
- 5000 events ~= 30 days of high-volume operations (safe limit)

**File Location:**
- Default: `~/.claude/logs/slo-events.jsonl`
- Each line is a self-contained JSON object (JSONL format)
- Events are appended chronologically (newest at bottom)
- `tail` reads from end, so we get most recent events first

---

**Now execute the SLO analysis based on the argument `$1`.**
