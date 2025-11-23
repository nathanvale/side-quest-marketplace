#!/usr/bin/env python3
"""
Find blast radius: all transitive callers of a function (BFS traversal)
Queries PROJECT_INDEX.json directly

Usage:
  python3 blast-radius.py parseDate                    # All transitive callers
  python3 blast-radius.py parseDate --depth 3          # Max depth 3
  python3 blast-radius.py parseDate --limit 50         # Max 50 results
  python3 blast-radius.py parseDate --json             # Full JSON output

Returns: Functions affected if target changes, with depth information
"""

import json
import sys
from collections import deque
from pathlib import Path

# Import shared utility for finding PROJECT_INDEX.json
from lib.find_project_index import find_project_index_or_exit

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

def blast_radius(edges, target, max_depth=None, max_results=100):
    """Find all transitive callers using BFS"""
    graph = build_reverse_graph(edges)

    visited = set()
    queue = deque([(target, 0)])
    results = []

    while queue and len(results) < max_results:
        func, depth = queue.popleft()

        if max_depth is not None and depth > max_depth:
            continue

        if func in visited:
            continue

        visited.add(func)

        # Add to results (skip the target itself)
        if func != target:
            results.append({
                'function': func,
                'depth': depth,
                'type': 'direct-caller' if depth == 1 else 'transitive-caller'
            })

        # Add callers to queue
        for caller in graph.get(func, []):
            if caller not in visited:
                queue.append((caller, depth + 1))

    return results

def main():
    import argparse

    parser = argparse.ArgumentParser(description='Find blast radius of a function')
    parser.add_argument('target', help='Function name to analyze')
    parser.add_argument('--depth', type=int, help='Max traversal depth')
    parser.add_argument('--limit', type=int, default=100, help='Max results')
    parser.add_argument('--json', action='store_true', help='Output JSON format')
    args = parser.parse_args()

    # Find PROJECT_INDEX.json (searches upward from current directory)
    index_path = find_project_index_or_exit()

    # Load index
    with open(index_path) as f:
        data = json.load(f)

    edges = data.get('g', [])

    # Run blast radius
    results = blast_radius(edges, args.target, args.depth, args.limit)

    # Calculate depth distribution
    depth_counts = {}
    for r in results:
        depth = r['depth']
        depth_counts[depth] = depth_counts.get(depth, 0) + 1

    max_depth = max((r['depth'] for r in results), default=0)

    if args.json:
        output = {
            'status': 'success',
            'query': 'blast-radius',
            'target': args.target,
            'results': results,
            'summary': {
                'total': len(results),
                'max_depth': max_depth,
                'by_depth': depth_counts
            }
        }
        print(json.dumps(output, indent=2))
    else:
        # Formatted output
        for r in results:
            print(f"{r['function']} (depth {r['depth']})")

if __name__ == '__main__':
    main()
