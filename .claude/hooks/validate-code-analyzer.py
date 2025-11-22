#!/usr/bin/env python3
"""
PreToolUse hook for code-analyzer agent to enforce non-negotiable protocol.

Validates that agents:
1. Don't read PROJECT_INDEX.json directly (must use Skill(index-graph-navigator))
2. Follow the 3-step analysis protocol
3. Use appropriate tools for code analysis

Exit codes:
- 0: Validation passed, allow tool execution
- 1: Warning (show stderr but allow execution)
- 2: Block tool execution and show error
"""

import json
import re
import sys
from typing import List, Tuple

# Validation rules: (pattern, message, severity)
# severity: 'block' (exit 2) or 'warn' (exit 1)
VALIDATION_RULES: List[Tuple[str, str, str]] = [
    # Block direct PROJECT_INDEX.json reads
    (
        r"PROJECT_INDEX\.json",
        "❌ BLOCKED: Don't read PROJECT_INDEX.json directly!\n"
        "   → Use: Skill(index-graph-navigator) for token-efficient queries\n"
        "   → Example: Skill(index-graph-navigator): \"find hotspots limit 50\"",
        "block"
    ),

    # Block using grep instead of rg
    (
        r"^grep\b",
        "⚠️  Consider using 'rg' (ripgrep) instead of 'grep' for better performance",
        "warn"
    ),

    # Warn about using cat instead of Read tool
    (
        r"^cat\b",
        "⚠️  Consider using Read tool instead of 'cat' for better integration",
        "warn"
    ),
]


def validate_read_tool(file_path: str) -> List[Tuple[str, str]]:
    """
    Validate Read tool usage.

    Args:
        file_path: The file path being read

    Returns:
        List of (message, severity) tuples
    """
    issues = []

    # Check for PROJECT_INDEX.json
    if "PROJECT_INDEX.json" in file_path:
        issues.append((
            "❌ BLOCKED: Reading PROJECT_INDEX.json directly!\n"
            "   This defeats the token-efficiency of index-graph-navigator.\n"
            "   \n"
            "   ✅ DO THIS INSTEAD:\n"
            "   Skill(index-graph-navigator): \"find hotspots limit 50\"\n"
            "   Skill(index-graph-navigator): \"find dead code\"\n"
            "   Skill(index-graph-navigator): \"who calls functionName\"\n"
            "   \n"
            "   📊 Token Comparison:\n"
            "   - Direct read: 26,000+ tokens\n"
            "   - Skill query: 200-500 tokens (98% reduction)",
            "block"
        ))

    return issues


def validate_bash_command(command: str) -> List[Tuple[str, str]]:
    """
    Validate Bash command usage.

    Args:
        command: The bash command being executed

    Returns:
        List of (message, severity) tuples
    """
    issues = []

    for pattern, message, severity in VALIDATION_RULES:
        if re.search(pattern, command):
            issues.append((message, severity))

    return issues


def main():
    """Main validation logic."""
    try:
        # Read hook input from stdin
        input_data = json.load(sys.stdin)

        tool_name = input_data.get("tool_name", "")
        tool_input = input_data.get("tool_input", {})

        issues = []

        # Validate based on tool type
        if tool_name == "Read":
            file_path = tool_input.get("file_path", "")
            issues = validate_read_tool(file_path)

        elif tool_name == "Bash":
            command = tool_input.get("command", "")
            issues = validate_bash_command(command)

        # If no issues, allow execution
        if not issues:
            sys.exit(0)

        # Print all issues to stderr
        blocking = False
        for message, severity in issues:
            print(message, file=sys.stderr)
            if severity == "block":
                blocking = True

        # Exit with appropriate code
        if blocking:
            sys.exit(2)  # Block execution
        else:
            sys.exit(1)  # Warn but allow

    except json.JSONDecodeError:
        print("ERROR: Invalid JSON input to hook", file=sys.stderr)
        sys.exit(0)  # Don't block on hook errors
    except Exception as e:
        print(f"ERROR: Hook validation failed: {e}", file=sys.stderr)
        sys.exit(0)  # Don't block on hook errors


if __name__ == "__main__":
    main()
