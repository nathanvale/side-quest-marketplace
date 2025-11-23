#!/bin/bash
#
# PostToolUse Hook: Atuin Integration
# Captures Bash commands executed by Claude Code and adds them to:
# - Atuin history (with metadata tags)
# - Zsh history
#
# Enable debug logging: export CLAUDE_ATUIN_DEBUG=1

set -euo pipefail

# Configuration
DEBUG="${CLAUDE_ATUIN_DEBUG:-0}"
# Use CLAUDE_PROJECT_DIR if available, otherwise derive from script location
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="${CLAUDE_PROJECT_DIR:-$(dirname "$(dirname "$SCRIPT_DIR")")}"
LOG_FILE="${PROJECT_ROOT}/.claude/hooks/atuin-hook.log"
ZSH_HISTORY="${HOME}/.zsh_history"

# Helper: Log debug messages
debug_log() {
    if [[ "$DEBUG" == "1" ]]; then
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" >> "$LOG_FILE"
    fi
}

# Helper: Log errors (always logged)
error_log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ERROR: $*" >> "$LOG_FILE"
}

# Main execution
main() {
    debug_log "=== Hook started ==="

    # Read JSON input from stdin
    INPUT=$(cat)
    debug_log "Received input: $INPUT"

    # Parse JSON fields
    TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name // empty')
    COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty')
    EXIT_CODE=$(echo "$INPUT" | jq -r '.tool_response.exit_code // 0')
    SESSION_ID=$(echo "$INPUT" | jq -r '.session_id // "unknown"')

    debug_log "Tool: $TOOL_NAME, Exit: $EXIT_CODE"

    # Filter: Only process Bash tool calls
    if [[ "$TOOL_NAME" != "Bash" ]]; then
        debug_log "Skipping non-Bash tool: $TOOL_NAME"
        exit 0
    fi

    # Validate command exists
    if [[ -z "$COMMAND" ]]; then
        debug_log "No command found in tool_input"
        exit 0
    fi

    debug_log "Processing command: $COMMAND"

    # Use atuin's native history tracking for rich metadata
    # This captures: command, exit code, duration, timestamp, cwd, hostname

    # Step 1: Start history entry and capture the ID
    HISTORY_ID=$(atuin history start -- "$COMMAND" 2>&1)
    debug_log "Started atuin history entry: $HISTORY_ID"

    # Step 2: End history entry with exit code and duration
    # Duration is set to 0 since we don't track execution time in post-hook
    if atuin history end --exit "$EXIT_CODE" --duration 0 "$HISTORY_ID" 2>&1; then
        debug_log "Added to atuin with exit code: $EXIT_CODE"
    else
        error_log "Failed to add command to atuin history"
        # Fallback: Add to zsh history as before
        TIMESTAMP=$(date +%s)
        if [[ -f "$ZSH_HISTORY" ]]; then
            ESCAPED_CMD=$(echo "$COMMAND" | tr '\n' ';' | sed 's/\\/\\\\/g')
            echo ": ${TIMESTAMP}:0;${ESCAPED_CMD}" >> "$ZSH_HISTORY"
            debug_log "Fallback: Added to zsh history instead"
        fi
    fi

    debug_log "=== Hook completed successfully ==="
    exit 0
}

# Run main function with error handling
if ! main; then
    error_log "Hook execution failed"
    exit 0  # Always exit 0 to not block Claude Code
fi
