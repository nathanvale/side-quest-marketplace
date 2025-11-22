#!/bin/bash

# Claude Docs Expert Skill
# Wrapper for Claude Code documentation helper
# Version: 1.0.0

set -e

# Path to the Claude docs helper script
CLAUDE_DOCS_HELPER="$HOME/.claude-code-docs/claude-docs-helper.sh"

# Function to display usage
usage() {
    cat << EOF
Claude Docs Expert - Access Claude Code documentation

Usage:
  claude-docs-expert [command] [options]

Commands:
  (no args)         List all available documentation topics
  <topic>           Read specific documentation with link to official docs
  -t               Check sync status without reading a doc
  -t <topic>       Check freshness then read documentation
  whats new        Show recent documentation changes
  what's new       Show recent documentation changes (alternative)
  --help, -h       Show this help message

Examples:
  claude-docs-expert                    # List all topics
  claude-docs-expert mcp               # Read MCP documentation
  claude-docs-expert -t                # Check sync status
  claude-docs-expert -t artifacts      # Check freshness then read artifacts docs
  claude-docs-expert "whats new"       # Show recent changes

Note: This skill wraps ~/.claude-code-docs/claude-docs-helper.sh
EOF
}

# Function to check if the Claude docs helper exists
check_docs_helper() {
    if [[ ! -f "$CLAUDE_DOCS_HELPER" ]]; then
        echo "Error: Claude docs helper not found at $CLAUDE_DOCS_HELPER"
        echo "Please ensure Claude Code documentation is properly installed."
        exit 1
    fi

    if [[ ! -x "$CLAUDE_DOCS_HELPER" ]]; then
        echo "Error: Claude docs helper is not executable at $CLAUDE_DOCS_HELPER"
        echo "Run: chmod +x $CLAUDE_DOCS_HELPER"
        exit 1
    fi
}

# Main function
main() {
    # Check for help flags
    if [[ "$1" == "--help" || "$1" == "-h" ]]; then
        usage
        exit 0
    fi

    # Check if docs helper exists
    check_docs_helper

    # Handle different argument patterns
    case "$#" in
        0)
            # No arguments - list all topics
            exec "$CLAUDE_DOCS_HELPER"
            ;;
        1)
            case "$1" in
                "-t")
                    # Check sync status only
                    exec "$CLAUDE_DOCS_HELPER" -t
                    ;;
                "whats new"|"what's new")
                    # Show recent changes
                    exec "$CLAUDE_DOCS_HELPER" "whats new"
                    ;;
                *)
                    # Read specific topic
                    exec "$CLAUDE_DOCS_HELPER" "$1"
                    ;;
            esac
            ;;
        2)
            if [[ "$1" == "-t" ]]; then
                # Check freshness then read topic
                exec "$CLAUDE_DOCS_HELPER" -t "$2"
            else
                echo "Error: Invalid arguments. Use --help for usage information."
                exit 1
            fi
            ;;
        *)
            echo "Error: Too many arguments. Use --help for usage information."
            exit 1
            ;;
    esac
}

# Execute main function with all arguments
main "$@"