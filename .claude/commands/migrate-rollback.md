---
name: migrate-rollback
description:
  Generates a rollback command for referrals created in a migration run by extracting their IDs from
  migration logs. Use when rolling back a failed migration, recovering from data issues, or when
  mentioned 'rollback migration', 'undo migration', 'rollback referrals'.
argument-hint: [migration-correlation-id-optional]
allowed-tools:
  Read, Bash(grep:*), Bash(command:*), Bash(date:*), Bash(cut:*), Bash(paste:*), Bash(tail:*),
  Bash(jq:*)
---

# Migrate Rollback

Generates a CLI command to rollback all referrals created during a specific migration run.

## Pattern

**Pattern 2**: Script Orchestration

This command uses deterministic log parsing to extract successful referral creations and generates a
structured rollback command for the user to execute.

## How It Works

1. **Extract Correlation ID**: Uses provided correlation ID or auto-detects the latest from today's
   migration log
2. **Show Confirmation**: Displays correlation ID and completion date, asks user to confirm
3. **Parse Logs**: Searches migration logs for all successful referral creation entries (using JSON
   parsing for robustness)
4. **Extract IDs**: Collects referral record IDs from the logs, handling malformed entries
   gracefully
5. **Generate Command**: Creates CLI command with comma-separated IDs
6. **Output & Copy**: Prints command to screen and copies to clipboard using platform-aware
   clipboard tool

## Implementation

### Core Logic

```bash
#!/bin/bash

# Get today's log file
LOG_FILE="apps/migration-cli/logs/migration-$(date +%Y-%m-%d).jsonl"

# Verify log file exists
if [[ ! -f "$LOG_FILE" ]]; then
  echo "Error: Log file not found: $LOG_FILE"
  exit 1
fi

# Extract correlation ID (user-provided or auto-detect latest)
if [[ -n "$1" ]]; then
  CORRELATION_ID="$1"
else
  CORRELATION_ID=$(jq -r '.correlationId' "$LOG_FILE" 2>/dev/null | tail -1)
fi

if [[ -z "$CORRELATION_ID" ]]; then
  echo "Error: No migration runs found in today's log"
  exit 1
fi

# Validate UUID format
if ! [[ "$CORRELATION_ID" =~ ^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$ ]]; then
  echo "Error: Invalid correlation ID format (not a valid UUID)"
  exit 1
fi

# Extract completion date and referral IDs in single pass
COMPLETION_DATE=$(jq -r "select(.correlationId == \"$CORRELATION_ID\") | .time" "$LOG_FILE" 2>/dev/null | tail -1)

REFERRAL_IDS=$(jq -r "select(.correlationId == \"$CORRELATION_ID\" and .msg == \"Dataverse create success\" and .entity == \"exco_referral\" and .recordId) | .recordId" "$LOG_FILE" 2>/dev/null | sort -u | paste -sd ',' -)

# Fallback for systems without jq
if [[ -z "$REFERRAL_IDS" ]]; then
  REFERRAL_IDS=$(grep "\"correlationId\":\"$CORRELATION_ID\"" "$LOG_FILE" | \
    grep '"msg":"Dataverse create success"' | \
    grep '"entity":"exco_referral"' | \
    grep -o '"recordId":"[^"]*"' | cut -d'"' -f4 | sort -u | paste -sd ',' -)
fi

# Count referrals (handle empty string)
if [[ -z "$REFERRAL_IDS" ]]; then
  REFERRAL_COUNT=0
else
  REFERRAL_COUNT=$(echo "$REFERRAL_IDS" | tr ',' '\n' | grep -v '^$' | wc -l)
fi

# Display summary
echo "Detected migration run:"
echo "- Correlation ID: $CORRELATION_ID"
echo "- Completion Date: $COMPLETION_DATE"
echo "- Referrals Found: $REFERRAL_COUNT"
echo ""

if [[ $REFERRAL_COUNT -eq 0 ]]; then
  echo "No referrals found for correlation ID: $CORRELATION_ID"
  exit 0
fi

read -p "Proceed with generating rollback command? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  exit 0
fi

# Generate rollback command
ROLLBACK_CMD="LOG_LEVEL=trace USE_FIXTURES=true npx tsx src/cli.ts rollback referral --id=$REFERRAL_IDS"

# Copy to clipboard (platform-aware with error checking)
CLIPBOARD_TOOL=""
if command -v pbcopy &> /dev/null; then
  CLIPBOARD_TOOL="pbcopy"
  PLATFORM="macOS"
elif command -v xclip &> /dev/null; then
  CLIPBOARD_TOOL="xclip"
  PLATFORM="Linux"
elif command -v clip.exe &> /dev/null; then
  CLIPBOARD_TOOL="clip.exe"
  PLATFORM="Windows"
fi

if [[ -n "$CLIPBOARD_TOOL" ]]; then
  if echo "$ROLLBACK_CMD" | $CLIPBOARD_TOOL 2>/dev/null; then
    echo "✓ Command copied to clipboard ($PLATFORM)"
  else
    echo "⚠ Failed to copy to clipboard - displaying below:"
  fi
else
  echo "⚠ Clipboard tool not available on this platform"
fi

echo ""
echo "Generated command:"
echo ""
echo "$ROLLBACK_CMD"
echo ""
echo "Ready to paste into terminal!"
```

### Platform Compatibility

The clipboard handling automatically detects the platform:

- **macOS**: Uses `pbcopy`
- **Linux**: Uses `xclip`
- **Windows**: Uses `clip.exe` (Git Bash)
- **Fallback**: Prints command to screen if no tool found

## Log File Location

Migration logs are stored at:

```
apps/migration-cli/logs/migration-{YYYY-MM-DD}.jsonl
```

Each log entry contains:

- `correlationId`: Migration run identifier (UUID)
- `level`: Log level (20=info, 30=warn, 40=error, 50=critical, 60=fatal)
- `msg`: Human-readable message with operation details
- `recordId`: Dataverse record ID (for creation events)
- `time`: ISO timestamp
- `component`: Service that generated the log entry

## Examples

```
# Auto-detect latest migration run and generate rollback command
/migrate-rollback

# Generate rollback command for a specific migration run
/migrate-rollback be8ce52a-cc8a-45da-9b7c-ef895b1c5c58
```

## Output Format

If referrals found:

```
Detected migration run:
- Correlation ID: be8ce52a-cc8a-45da-9b7c-ef895b1c5c58
- Completion Date: 2025-11-11 03:15:22 UTC
- Referrals Found: 8

Proceed with generating rollback command?

Generated command (copied to clipboard):
LOG_LEVEL=trace USE_FIXTURES=true npx tsx src/cli.ts rollback referral --id=<id1>,<id2>,<id3>,...
```

If no referrals found:

```
No successful referral creations found for correlation ID: be8ce52a-cc8a-45da-9b7c-ef895b1c5c58
```

## Implementation Notes

### JSON Parsing Strategy

The command uses **optimized single-pass parsing** for robustness:

1. **Primary**: Uses `jq` for native JSON parsing when available
   - Filters for entries with `entity == "exco_referral"` and `msg == "Dataverse create success"`
     (actual referral creations)
   - Excludes referral roles (`exco_referralrole`) and other operations
   - Extracts `recordId` field for matching entries
   - Single pass through log file (more efficient)
   - Sorts and deduplicates IDs to handle edge cases

2. **Fallback**: Uses `grep` + `cut` pattern matching if `jq` fails
   - Filters by "Dataverse create success" message and "exco_referral" entity
   - Works on systems without `jq` installed
   - Handles standard JSONL format variations

### Error Handling

- **Missing log file**: Exits with clear error message
- **No migrations found**: Reports "no migration runs" rather than failing
- **Invalid UUID format**: Validates correlation ID before searching (prevents silent failures)
- **Malformed JSON entries**: Automatically falls back to regex parsing
- **Empty referral list**: Reports cleanly without attempting rollback
- **Clipboard operation failure**: Detects failed copy and warns user while still displaying command

### Extraction Behavior

- Extracts **only `exco_referral` entities with "Dataverse create success" message** (excludes
  referral roles and other operations)
- Auto-detects **latest migration** from log file tail if no correlation ID provided
- Deduplicates referral IDs (handles duplicate entries in logs)
- Counts referrals accurately and displays summary **before confirmation prompt**
- Output command includes environment variables (`LOG_LEVEL=trace USE_FIXTURES=true`)

### Platform Support

- **macOS**: Uses `pbcopy` for clipboard integration
- **Linux**: Uses `xclip` for clipboard integration
- **Windows**: Uses `clip.exe` (Git Bash/WSL) for clipboard integration
- **Fallback**: Prints command to terminal if clipboard unavailable
