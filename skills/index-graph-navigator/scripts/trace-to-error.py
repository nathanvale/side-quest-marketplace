#!/usr/bin/env python3
"""
Trace call stack to a file:line location (how does execution reach an error?)
Queries PROJECT_INDEX.json directly

Usage:
  python3 trace-to-error.py src/lib/csv/parser.ts 123     # Find call stacks to line 123
  python3 trace-to-error.py src/lib/csv/parser.ts 123 --json

Returns: All call paths leading to the target location
"""

import json
import sys
from collections import deque
from pathlib import Path

# Import shared utility for finding PROJECT_INDEX.json
from lib.find_project_index import find_project_index_or_exit

def find_function_at_line(files, target_file, target_line):
    """Find which function is defined at the target file:line"""
    # Normalize target file path
    target_file_normalized = target_file.lower().replace('\\', '/')

    for filepath, content in files.items():
        filepath_normalized = filepath.lower().replace('\\', '/')

        # Check if this is the target file
        if target_file_normalized in filepath_normalized or filepath_normalized.endswith(target_file_normalized):
            # Parse function definitions
            if isinstance(content, list) and len(content) > 1:
                funcs = content[1] if isinstance(content[1], list) else []
                for func_def in funcs:
                    if isinstance(func_def, str):
                        # Format: "funcName:line:..."
                        parts = func_def.split(':')
                        if len(parts) >= 2:
                            func_name = parts[0]
                            try:
                                func_line = int(parts[1])
                                # Check if target line is at or near this function definition
                                if abs(func_line - target_line) <= 50:  # Within 50 lines
                                    return func_name, filepath
                            except ValueError:
                                continue

    return None, None

def build_reverse_graph(edges):
    """Build reverse dependency graph (callee -> callers)"""
    graph = {}
    for edge in edges:
        if isinstance(edge, list) and len(edge) >= 2:
            caller, callee = edge[0], edge[1]
            if callee not in graph:
                graph[callee] = []
            graph[callee].append(caller)
    return graph

def find_call_paths(graph, target_func, max_paths=10):
    """Find all paths from entry points to target function using reverse BFS"""
    # Find entry points (functions that are never called, or have no callers)
    all_callees = set(graph.keys())
    all_callers = set()
    for callers in graph.values():
        all_callers.update(callers)

    entry_points = all_callers - all_callees

    # BFS from target backward to find paths
    paths = []
    visited = set()

    queue = deque([([target_func], target_func)])

    while queue and len(paths) < max_paths:
        path, current = queue.popleft()

        if current in entry_points:
            # Found a complete path
            paths.append(list(reversed(path)))
            continue

        if current in visited:
            continue

        visited.add(current)

        # Add callers to queue
        for caller in graph.get(current, []):
            new_path = path + [caller]
            queue.append((new_path, caller))

    return paths, list(entry_points)

def main():
    import argparse

    parser = argparse.ArgumentParser(description='Trace call stack to file:line')
    parser.add_argument('file', help='Target file path')
    parser.add_argument('line', type=int, help='Target line number')
    parser.add_argument('--json', action='store_true', help='Output JSON format')
    args = parser.parse_args()

    # Find PROJECT_INDEX.json (searches upward from current directory)
    index_path = find_project_index_or_exit()

    # Load index
    with open(index_path) as f:
        data = json.load(f)

    files = data.get('f', {})
    edges = data.get('g', [])

    # Find function at target location
    target_func, target_file_full = find_function_at_line(files, args.file, args.line)

    if target_func is None:
        error = {
            'status': 'error',
            'error': f'No function found at {args.file}:{args.line}',
            'hint': 'Check file path and line number'
        }
        print(json.dumps(error, indent=2), file=sys.stderr)
        sys.exit(1)

    # Build reverse graph and find paths
    graph = build_reverse_graph(edges)
    paths, entry_points = find_call_paths(graph, target_func)

    # Format call stacks
    call_stacks = []
    for path in paths:
        call_stacks.append({
            'entry_point': path[0] if path else None,
            'path': path,
            'depth': len(path) - 1
        })

    if args.json:
        output = {
            'status': 'success',
            'query': 'trace-to-error',
            'file': args.file,
            'line': args.line,
            'function_at_line': target_func,
            'call_stacks': call_stacks,
            'summary': {
                'total_paths': len(call_stacks),
                'min_depth': min((cs['depth'] for cs in call_stacks), default=0),
                'max_depth': max((cs['depth'] for cs in call_stacks), default=0)
            }
        }
        print(json.dumps(output, indent=2))
    else:
        print(f"Function at {args.file}:{args.line}: {target_func}")
        print(f"\nFound {len(call_stacks)} call paths:\n")
        for i, cs in enumerate(call_stacks, 1):
            print(f"{i}. {' → '.join(cs['path'])} (depth {cs['depth']})")

if __name__ == '__main__':
    main()
