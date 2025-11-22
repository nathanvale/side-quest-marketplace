#!/usr/bin/env python3
"""
Detect circular dependencies using DFS with recursion stack
Queries PROJECT_INDEX.json directly

Usage:
  python3 cycles.py                 # Find all cycles
  python3 cycles.py --json          # Full JSON output

Returns: Circular dependency chains
"""

import json
import sys
from pathlib import Path

# Import shared utility for finding PROJECT_INDEX.json
from lib.find_project_index import find_project_index_or_exit

def build_graph(edges):
    """Build forward dependency graph (caller -> callees)"""
    graph = {}
    for edge in edges:
        if isinstance(edge, list) and len(edge) >= 2:
            caller, callee = edge[0], edge[1]
            if caller not in graph:
                graph[caller] = []
            graph[caller].append(callee)
    return graph

def find_cycles_dfs(graph):
    """Find all cycles using DFS with recursion stack"""
    visited = set()
    rec_stack = []
    cycles = []

    def dfs(node):
        if node in rec_stack:
            # Found cycle!
            cycle_start = rec_stack.index(node)
            cycle = rec_stack[cycle_start:] + [node]
            cycles.append(cycle)
            return

        if node in visited:
            return

        visited.add(node)
        rec_stack.append(node)

        for neighbor in graph.get(node, []):
            dfs(neighbor)

        rec_stack.pop()

    # Try DFS from all nodes
    for node in graph.keys():
        if node not in visited:
            dfs(node)

    return cycles

def main():
    import argparse

    parser = argparse.ArgumentParser(description='Find circular dependencies')
    parser.add_argument('--json', action='store_true', help='Output JSON format')
    args = parser.parse_args()

    # Find PROJECT_INDEX.json (searches upward from current directory)
    index_path = find_project_index_or_exit()

    # Load index
    with open(index_path) as f:
        data = json.load(f)

    edges = data.get('g', [])
    graph = build_graph(edges)

    # Find cycles
    cycles_raw = find_cycles_dfs(graph)

    # Format results
    results = []
    for cycle in cycles_raw:
        results.append({
            'cycle': cycle,
            'length': len(cycle) - 1  # -1 because first and last are same
        })

    if args.json:
        output = {
            'status': 'success',
            'query': 'cycles',
            'results': results,
            'summary': {
                'total_cycles': len(results),
                'min_length': min((r['length'] for r in results), default=0),
                'max_length': max((r['length'] for r in results), default=0)
            }
        }
        print(json.dumps(output, indent=2))
    else:
        if len(results) == 0:
            print("No cycles found")
        else:
            for r in results:
                print(f"Cycle (length {r['length']}): {' → '.join(r['cycle'])}")

if __name__ == '__main__':
    main()
