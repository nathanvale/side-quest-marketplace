#!/usr/bin/env bash
# SessionStart hook for Claude Code
# Logs session metadata at the start of every session

# Get session metadata
SESSION_ID="${CLAUDE_SESSION_ID:-unknown}"
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
WORKING_DIR="${PWD}"

# Determine source
if [ "${CLAUDE_STARTUP_SOURCE}" = "resume" ]; then
    SOURCE="resume"
elif [ "${CLAUDE_STARTUP_SOURCE}" = "compact" ]; then
    SOURCE="compact"
elif [ "${CLAUDE_STARTUP_SOURCE}" = "clear" ]; then
    SOURCE="clear"
else
    SOURCE="startup"
fi

# Get log file paths
PROJECT_LOGS="${HOME}/.claude/projects/$(echo "${WORKING_DIR}" | sed 's/\//-/g')"
TRANSCRIPT_LOG="${PROJECT_LOGS}/${SESSION_ID}.jsonl"
AGENT_LOG="${PROJECT_LOGS}/agent-${SESSION_ID:0:8}.jsonl"

# Output session info
cat <<EOF

=========================================
🚀 Claude Code Agent Session Started
=========================================

Timestamp:    ${TIMESTAMP}
Session ID:   ${SESSION_ID}
Source:       ${SOURCE}
Working Dir:  ${WORKING_DIR}

📋 Log Files:
  Transcript: ${TRANSCRIPT_LOG}
  Agent Log:  ${AGENT_LOG}

To analyze this session later, run:
  /analyze-last-run

=========================================
EOF
