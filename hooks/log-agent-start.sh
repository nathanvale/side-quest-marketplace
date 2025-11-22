#!/bin/bash
# Log agent session start with ID and log path

# Read hook input from stdin
INPUT=$(cat)

# Extract session info
SESSION_ID=$(echo "$INPUT" | jq -r '.session_id // "unknown"')
TRANSCRIPT_PATH=$(echo "$INPUT" | jq -r '.transcript_path // "unknown"')
CWD=$(echo "$INPUT" | jq -r '.cwd // "unknown"')
SOURCE=$(echo "$INPUT" | jq -r '.source // "unknown"')

# Convert transcript path to agent log path
# Transcript path: ~/.claude/projects/PROJECT_NAME/SESSION_ID.jsonl
# Agent log path: ~/.claude/projects/PROJECT_NAME/agent-HASH.jsonl
PROJECT_DIR=$(dirname "$TRANSCRIPT_PATH")
AGENT_LOG=$(ls -t "${PROJECT_DIR}"/agent-*.jsonl 2>/dev/null | head -1)

# Format timestamp
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')

# Output to Claude (shown in transcript with CTRL-R)
echo "========================================="
echo "🚀 Claude Code Agent Session Started"
echo "========================================="
echo ""
echo "Timestamp:    $TIMESTAMP"
echo "Session ID:   $SESSION_ID"
echo "Source:       $SOURCE"
echo "Working Dir:  $CWD"
echo ""
echo "📋 Log Files:"
echo "  Transcript: $TRANSCRIPT_PATH"
if [ -n "$AGENT_LOG" ]; then
  echo "  Agent Log:  $AGENT_LOG"
else
  echo "  Agent Log:  (will be created)"
fi
echo ""
echo "To analyze this session later, run:"
echo "  /analyze-last-run"
echo ""
echo "========================================="

# Exit 0 so stdout is shown to user in transcript mode
exit 0
