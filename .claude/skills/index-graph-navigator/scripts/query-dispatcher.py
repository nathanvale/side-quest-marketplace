#!/usr/bin/env python3
"""
Query dispatcher for index-graph-navigator skill.

Parses natural language requests and routes to appropriate scripts.
Returns JSON responses with comprehensive error handling.

Usage:
    python3 query-dispatcher.py "find hotspots"
    python3 query-dispatcher.py "who calls parseDate"
    python3 query-dispatcher.py "find dead code"
"""
import sys
import json
import subprocess
import re
from pathlib import Path
from typing import Dict, List, Optional, Any

# Resolve paths
SKILL_DIR = Path(__file__).resolve().parent.parent
SCRIPTS_DIR = SKILL_DIR / "scripts"

# Query type mappings
QUERY_PATTERNS = {
    "hotspots": {
        "keywords": ["hotspot", "most connected", "high risk", "change risk", "maintenance burden"],
        "script": ["bash", "hotspots.sh", "--json"],
        "requires_target": False
    },
    "find-callers": {
        "keywords": ["who calls", "find caller", "what calls", "reverse dep", "called by"],
        "script": ["bash", "find-callers.sh"],
        "requires_target": True
    },
    "find-calls": {
        "keywords": ["what does", "calls what", "forward dep", "depends on", "invokes"],
        "script": ["bash", "find-calls.sh"],
        "requires_target": True
    },
    "dead-code": {
        "keywords": ["dead code", "unused", "never called", "orphan"],
        "script": ["bash", "dead-code.sh", "--json"],
        "requires_target": False
    },
    "blast-radius": {
        "keywords": ["blast radius", "impact", "transitive caller", "what breaks"],
        "script": ["python3", "blast-radius.py"],
        "requires_target": True
    },
    "cycles": {
        "keywords": ["cycle", "circular", "circular dep", "loop"],
        "script": ["python3", "cycles.py"],
        "requires_target": False
    }
}


def safe_execute(cmd: List[str], cwd: Path, timeout: int = 30) -> Dict[str, Any]:
    """
    Execute command with comprehensive error handling.

    Args:
        cmd: Command and arguments to execute
        cwd: Working directory for execution
        timeout: Maximum execution time in seconds

    Returns:
        Dictionary with status and results or error information
    """
    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=timeout,
            cwd=cwd
        )

        # Check for script failure
        if result.returncode != 0:
            error_msg = result.stderr.strip() if result.stderr else "Script failed with no error message"

            # Parse common errors for helpful hints
            if "PROJECT_INDEX.json not found" in error_msg:
                return {
                    "status": "error",
                    "error": "PROJECT_INDEX.json not found at project root",
                    "hint": "Run /index command to generate PROJECT_INDEX.json",
                    "returncode": result.returncode
                }

            return {
                "status": "error",
                "error": error_msg,
                "returncode": result.returncode
            }

        # Try to parse JSON output
        output = result.stdout.strip()
        if not output:
            return {
                "status": "error",
                "error": "Script produced no output",
                "command": " ".join(cmd)
            }

        try:
            return json.loads(output)
        except json.JSONDecodeError as e:
            # Script succeeded but didn't return valid JSON
            return {
                "status": "error",
                "error": f"Invalid JSON from script: {e}",
                "raw_output": output[:500],  # First 500 chars for debugging
                "command": " ".join(cmd)
            }

    except subprocess.TimeoutExpired:
        return {
            "status": "error",
            "error": f"Script timed out after {timeout} seconds",
            "hint": "PROJECT_INDEX.json may be corrupted or extremely large",
            "command": " ".join(cmd)
        }
    except FileNotFoundError:
        return {
            "status": "error",
            "error": f"Script not found: {cmd[0]}",
            "hint": "Ensure the script exists and is executable",
            "scripts_dir": str(SCRIPTS_DIR)
        }
    except Exception as e:
        return {
            "status": "error",
            "error": str(e),
            "error_type": type(e).__name__,
            "command": " ".join(cmd)
        }


def extract_function_name(user_input: str) -> Optional[str]:
    """
    Extract function name from natural language input.

    Tries multiple patterns:
    1. Backtick-wrapped: `functionName`
    2. "function X" or "X function"
    3. camelCase or PascalCase words

    Args:
        user_input: Raw user query

    Returns:
        Extracted function name or None if not found
    """
    # Pattern 1: Backtick-wrapped
    match = re.search(r'`([^`]+)`', user_input)
    if match:
        return match.group(1)

    # Pattern 2: "function X" or "X function"
    match = re.search(r'function\s+(\w+)|(\w+)\s+function', user_input, re.IGNORECASE)
    if match:
        return match.group(1) or match.group(2)

    # Pattern 3: Look for camelCase/PascalCase words (likely function names)
    words = user_input.split()
    for word in words:
        # Strip punctuation
        clean_word = re.sub(r'[^\w]', '', word)
        # Check if it looks like a function name (camelCase or PascalCase)
        if re.match(r'^[a-z][a-zA-Z0-9]*$', clean_word) or re.match(r'^[A-Z][a-zA-Z0-9]*$', clean_word):
            return clean_word

    return None


def parse_query(user_input: str) -> Dict[str, Any]:
    """
    Parse natural language query into structured request.

    Args:
        user_input: Raw user query

    Returns:
        Dictionary with query type, target (if needed), and options
    """
    lower_input = user_input.lower()

    # Try to match query type based on keywords
    for query_type, config in QUERY_PATTERNS.items():
        if any(keyword in lower_input for keyword in config["keywords"]):
            result = {"query": query_type}

            # Extract target if required
            if config["requires_target"]:
                target = extract_function_name(user_input)
                if target:
                    result["target"] = target
                else:
                    return {
                        "status": "error",
                        "error": f"Could not extract function name from query",
                        "query_type": query_type,
                        "input": user_input,
                        "hint": "Wrap function name in backticks like `functionName` or use 'function X' syntax"
                    }

            # Extract limit if present
            limit_match = re.search(r'(?:top|limit|first)\s+(\d+)', lower_input)
            if limit_match:
                result["limit"] = int(limit_match.group(1))

            return result

    # No match found
    return {
        "status": "error",
        "error": "Could not determine query type from input",
        "input": user_input,
        "supported_queries": list(QUERY_PATTERNS.keys()),
        "hint": "Use keywords like 'hotspots', 'who calls', 'dead code', 'blast radius', etc."
    }


def execute_query(query: Dict[str, Any]) -> Dict[str, Any]:
    """
    Execute the parsed query by calling appropriate script.

    Args:
        query: Parsed query dictionary

    Returns:
        JSON response from script or error information
    """
    # Check for parse errors
    if query.get("status") == "error":
        return query

    query_type = query["query"]
    config = QUERY_PATTERNS[query_type]

    # Build command
    cmd = config["script"].copy()

    # Add target if provided
    if "target" in query:
        cmd.append(query["target"])

    # Add --json flag if not already present
    if "--json" not in cmd:
        cmd.append("--json")

    # Add limit option if provided and supported
    if "limit" in query and query_type in ["hotspots"]:
        cmd.extend(["--limit", str(query["limit"])])

    # Execute with error handling
    return safe_execute(cmd, SCRIPTS_DIR)


def main():
    """Main entry point for query dispatcher."""
    # Validate scripts directory exists
    if not SCRIPTS_DIR.exists():
        print(json.dumps({
            "status": "error",
            "error": f"Scripts directory not found: {SCRIPTS_DIR}",
            "skill_dir": str(SKILL_DIR),
            "hint": "Check skill installation"
        }, indent=2))
        sys.exit(1)

    # Check for input
    if len(sys.argv) < 2:
        print(json.dumps({
            "status": "error",
            "error": "No query provided",
            "usage": "query-dispatcher.py 'find hotspots'",
            "examples": [
                "query-dispatcher.py 'find hotspots'",
                "query-dispatcher.py 'who calls parseDate'",
                "query-dispatcher.py 'find dead code'",
                "query-dispatcher.py 'blast radius of sanitizeEmail'"
            ]
        }, indent=2))
        sys.exit(1)

    # Combine all arguments into query string
    user_input = " ".join(sys.argv[1:])

    # Parse and execute
    parsed_query = parse_query(user_input)
    result = execute_query(parsed_query)

    # Output JSON result
    print(json.dumps(result, indent=2))

    # Exit with appropriate code
    sys.exit(0 if result.get("status") != "error" else 1)


if __name__ == "__main__":
    main()
