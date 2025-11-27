#!/bin/bash
#
# PostToolUse Hook: Atuin Integration
# Captures Bash commands executed by Claude Code and adds them to:
# - Atuin history (with metadata tags)
# - Zsh history (fallback)
#
# Enable debug logging: export CLAUDE_ATUIN_DEBUG=1

set -euo pipefail

# Check for jq dependency
if ! command -v jq >/dev/null 2>&1; then
    echo "Warning: 'jq' is not installed. Atuin hook skipping." >&2
    exit 0
fi

# Configuration
DEBUG="${CLAUDE_ATUIN_DEBUG:-0}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_FILE="${SCRIPT_DIR}/atuin-hook.log"
# Respect HISTFILE or fallback to standard locations
HISTORY_FILE="${HISTFILE:-${HOME}/.zsh_history}"
if [[ ! -f "$HISTORY_FILE" && -f "${HOME}/.bash_history" ]]; then
    HISTORY_FILE="${HOME}/.bash_history"
fi
# Context log for git branch and session tracking
CONTEXT_FILE="${HOME}/.claude/atuin-context.jsonl"

# Helper: Log debug messages
debug_log() {
    if [[ "$DEBUG" == "1" ]]; then
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" >> "$LOG_FILE"
    fi
}

# Helper: Log errors (always logged)
error_log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ERROR: $*" >> "$LOG_FILE"
    echo "[Atuin Hook Error] $*" >&2
}

# Helper: Write context to JSONL for later searching by git branch/session
write_context() {
    local cmd="$1"
    local session="$2"
    local cwd="$3"

    # Capture git branch (fast, fails gracefully outside git repos)
    local git_branch=""
    git_branch=$(git -C "$cwd" rev-parse --abbrev-ref HEAD 2>/dev/null || echo "")

    # Ensure context directory exists
    mkdir -p "$(dirname "$CONTEXT_FILE")"

    # Get ISO timestamp
    local timestamp
    timestamp=$(date -u +%Y-%m-%dT%H:%M:%SZ)

    # Escape command for JSON (replace quotes and newlines)
    local escaped_cmd
    escaped_cmd=$(printf '%s' "$cmd" | sed 's/\\/\\\\/g; s/"/\\"/g' | tr '\n' ' ')

    # Write JSONL entry (lightweight, no jq dependency for writing)
    printf '{"ts":"%s","cmd":"%s","branch":"%s","session":"%s","cwd":"%s"}\n' \
        "$timestamp" \
        "$escaped_cmd" \
        "$git_branch" \
        "$session" \
        "$cwd" \
        >> "$CONTEXT_FILE"

    debug_log "Wrote context: branch=$git_branch, session=$session"
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
    # Get working directory from tool input, or fall back to current directory
    CWD=$(echo "$INPUT" | jq -r '.cwd // empty')
    if [[ -z "$CWD" ]]; then
        CWD="$(pwd)"
    fi

    debug_log "Tool: $TOOL_NAME, Exit: $EXIT_CODE, CWD: $CWD"

    # Filter: Only process Bash tool calls
    if [[ "$TOOL_NAME" != "Bash" ]]; then
        debug_log "Skipping non-Bash tool: $TOOL_NAME"
        exit 0
    fi

    # Append to history file if it exists
    if [[ -f "$HISTORY_FILE" ]]; then
        # Format depends on shell, simple append for now
        echo "$COMMAND" >> "$HISTORY_FILE"
    fi

    # Validate command exists
    if [[ -z "$COMMAND" ]]; then
        debug_log "No command found in tool_input"
        exit 0
    fi

    debug_log "Processing command: $COMMAND"

    # Use atuin's native history tracking for rich metadata
    # This captures: command, exit code, duration, timestamp, cwd, hostname

    # Helper function to add to shell history as fallback
    add_to_shell_history() {
        local timestamp
        timestamp=$(date +%s)
        if [[ -f "$HISTORY_FILE" ]]; then
            local escaped_cmd
            escaped_cmd=$(echo "$COMMAND" | tr '\n' ';' | sed 's/\\/\\\\/g')
            echo ": ${timestamp}:0;${escaped_cmd}" >> "$HISTORY_FILE"
            debug_log "Fallback: Added to shell history"
            return 0
        fi
        return 1
    }

    # Step 1: Start history entry and capture the ID
    # Wrap in conditional to handle atuin not being available
    HISTORY_ID=""
    if ! HISTORY_ID=$(atuin history start -- "$COMMAND" 2>&1); then
        debug_log "Atuin history start failed, using fallback"
        add_to_shell_history
        # Still write context even when using fallback
        write_context "$COMMAND" "$SESSION_ID" "$CWD"
        exit 0
    fi
    debug_log "Started atuin history entry: $HISTORY_ID"

    # Step 2: End history entry with exit code and duration
    # Duration is set to 0 since we don't track execution time in post-hook
    if atuin history end --exit "$EXIT_CODE" --duration 0 "$HISTORY_ID" 2>&1; then
        debug_log "Added to atuin with exit code: $EXIT_CODE"
    else
        error_log "Failed to end atuin history entry"
        add_to_shell_history
    fi

    # Step 3: Write context (git branch, session ID) for later searching
    write_context "$COMMAND" "$SESSION_ID" "$CWD"

    debug_log "=== Hook completed successfully ==="
    exit 0
}

# Run main function with error handling
if ! main; then
    error_log "Hook execution failed"
    exit 0  # Always exit 0 to not block Claude Code
fi
