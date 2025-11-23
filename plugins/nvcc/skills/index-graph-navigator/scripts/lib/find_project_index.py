#!/usr/bin/env python3
"""
Shared utility: Find PROJECT_INDEX.json by searching upward (like git's .git search)

Priority order:
1. CLAUDE_PROJECT_DIR env var (if set)
2. Search upward from current directory

Usage:
    from lib.find_project_index import find_project_index

    index_path = find_project_index()
    if not index_path:
        print("PROJECT_INDEX.json not found")
        sys.exit(1)
"""

import os
import sys
from pathlib import Path


def find_project_index() -> Path | None:
    """
    Find PROJECT_INDEX.json by searching upward from current directory.

    Returns:
        Path to PROJECT_INDEX.json if found, None otherwise
    """
    # Priority 1: Check CLAUDE_PROJECT_DIR if set
    if 'CLAUDE_PROJECT_DIR' in os.environ:
        candidate = Path(os.environ['CLAUDE_PROJECT_DIR']) / 'PROJECT_INDEX.json'
        if candidate.exists():
            return candidate

    # Priority 2: Search upward from current directory
    current_dir = Path.cwd()

    while True:
        candidate = current_dir / 'PROJECT_INDEX.json'

        # Found it!
        if candidate.exists():
            return candidate

        # Reached filesystem root without finding it
        if current_dir.parent == current_dir:
            return None

        # Move up one directory
        current_dir = current_dir.parent


def find_project_index_or_exit() -> Path:
    """
    Find PROJECT_INDEX.json or exit with error message.

    Returns:
        Path to PROJECT_INDEX.json

    Exits:
        With status 1 and error message if not found
    """
    index_path = find_project_index()

    if not index_path:
        error_msg = {
            "status": "error",
            "error": "PROJECT_INDEX.json not found in current directory or any parent",
            "hint": "Run /index command in your project directory"
        }
        import json
        print(json.dumps(error_msg), file=sys.stderr)
        sys.exit(1)

    return index_path


# If run directly, print the path or error
if __name__ == '__main__':
    index_path = find_project_index()
    if index_path:
        print(index_path)
    else:
        print("PROJECT_INDEX.json not found", file=sys.stderr)
        sys.exit(1)
