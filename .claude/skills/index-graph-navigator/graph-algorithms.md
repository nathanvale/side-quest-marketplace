# Graph Algorithms for Domain Navigation

**Python and jq implementations for complex graph queries**

## Table of Contents

- [Domain Index Structure Reference](#domain-index-structure-reference)
  - [Root Object](#root-object)
  - [File Entry (.f section)](#file-entry-f-section)
  - [Graph Edges (.g section)](#graph-edges-g-section)
- [Algorithm 1: Find Direct Callers](#algorithm-1-find-direct-callers)
  - [Bash Implementation (jq)](#bash-implementation-jq)
  - [Python Implementation](#python-implementation)
- [Algorithm 2: Find Direct Calls](#algorithm-2-find-direct-calls)
  - [Bash Implementation (jq)](#bash-implementation-jq-1)
- [Algorithm 3: Compute Blast Radius (Transitive Callers)](#algorithm-3-compute-blast-radius-transitive-callers)
  - [Python Implementation](#python-implementation-1)
- [Algorithm 4: Detect Dead Code](#algorithm-4-detect-dead-code)
  - [Python Implementation](#python-implementation-2)
- [Algorithm 5: Detect Circular Dependencies](#algorithm-5-detect-circular-dependencies)
  - [Python Implementation](#python-implementation-3)
- [Algorithm 6: Find Cross-Domain Dependencies](#algorithm-6-find-cross-domain-dependencies)
  - [Python Implementation](#python-implementation-4)
- [Algorithm 7: Find Hotspots (Most Connected Functions)](#algorithm-7-find-hotspots-most-connected-functions)
  - [Bash Implementation (jq)](#bash-implementation-jq-2)
- [Algorithm 8: Trace to Error (Reverse BFS from file:line)](#algorithm-8-trace-to-error-reverse-bfs-from-fileline)
  - [Python Implementation](#python-implementation-5)
- [Performance Summary](#performance-summary)

---

## Domain Index Structure Reference

### Root Object

```json
{
  "d": {
    /* Dependencies */
  },
  "f": {
    /* Files map */
  },
  "g": [
    /* Graph edges */
  ],
  "metadata": {
    "domain_files_count": 12,
    "domain_name": "CSV Processing",
    "timestamp": "2025-11-09T10:00:00Z"
  },
  "stats": {
    "domain_files": 12,
    "domain_functions": 35
  }
}
```

### File Entry (`.f` section)

```json
"file/path.ts": [
  "t",                          // Type indicator
  [                             // Top-level functions
    "funcName:line:(params):returnType:calls:"
  ],
  {                             // Classes (optional)
    "ClassName": [
      "startLine",
      ["methodName:line:(params):returnType:calls:"]
    ]
  }
]
```

### Graph Edges (`.g` section)

```json
"g": [
  ["caller", "callee"],
  ["functionA", "functionB"]
]
```

**Key**: `[A, B]` means "A calls B" (directional)

---

## Algorithm 1: Find Direct Callers

**Purpose**: Find who directly calls a function (reverse dependencies)

**Complexity**: O(E) where E = number of edges

### Bash Implementation (jq)

```bash
#!/bin/bash
# Usage: find-callers.sh <function_name> <domain_file>

FUNC="$1"
DOMAIN_FILE="$2"

jq -r --arg func "$FUNC" '
  .g[] | select(.[1] == $func) | .[0]
' < "$DOMAIN_FILE" | sort -u
```

### Python Implementation

```python
import json
import sys

def find_callers(target_func, domain_file):
    with open(domain_file) as f:
        data = json.load(f)

    edges = data.get('g', [])
    callers = [edge[0] for edge in edges if edge[1] == target_func]
    return sorted(set(callers))

if __name__ == '__main__':
    func = sys.argv[1]
    domain_file = sys.argv[2]
    callers = find_callers(func, domain_file)
    for caller in callers:
        print(caller)
```

**Performance**: ~20-50ms (jq), ~100ms (Python)

---

## Algorithm 2: Find Direct Calls

**Purpose**: Find what a function directly calls (forward dependencies)

**Complexity**: O(E)

### Bash Implementation (jq)

```bash
#!/bin/bash
# Usage: find-calls.sh <function_name> <domain_file>

FUNC="$1"
DOMAIN_FILE="$2"

jq -r --arg func "$FUNC" '
  .g[] | select(.[0] == $func) | .[1]
' < "$DOMAIN_FILE" | sort -u
```

**Performance**: ~20-50ms

---

## Algorithm 3: Compute Blast Radius (Transitive Callers)

**Purpose**: Find ALL functions affected if target changes (BFS traversal)

**Complexity**: O(V + E) where V = vertices, E = edges

### Python Implementation

```python
#!/usr/bin/env python3
"""
Compute blast radius: all transitive callers of a function.
Usage: python blast-radius.py <function_name> <domain_file>
"""

import json
import sys
from collections import defaultdict, deque

def build_reverse_graph(edges):
    """Build adjacency list: function -> [functions that call it]"""
    graph = defaultdict(list)
    for caller, callee in edges:
        graph[callee].append(caller)
    return graph

def compute_blast_radius(target, graph, max_depth=None):
    """BFS to find all transitive callers"""
    visited = set()
    queue = deque([(target, 0)])  # (function, depth)
    results = []

    while queue:
        func, depth = queue.popleft()

        # Check depth limit
        if max_depth and depth > max_depth:
            continue

        if func in visited:
            continue

        visited.add(func)

        # Don't include target itself in results
        if func != target:
            results.append({'function': func, 'depth': depth})

        # Add all callers to queue
        for caller in graph.get(func, []):
            if caller not in visited:
                queue.append((caller, depth + 1))

    return results

def main():
    if len(sys.argv) < 3:
        print("Usage: blast-radius.py <function_name> <domain_file> [max_depth]")
        sys.exit(1)

    target_func = sys.argv[1]
    domain_file = sys.argv[2]
    max_depth = int(sys.argv[3]) if len(sys.argv) > 3 else None

    # Load domain index
    with open(domain_file) as f:
        data = json.load(f)

    # Build reverse dependency graph
    edges = data.get('g', [])
    graph = build_reverse_graph(edges)

    # Compute blast radius
    affected = compute_blast_radius(target_func, graph, max_depth)

    if not affected:
        print(f"No functions call '{target_func}' (dead code or entry point)")
        return

    # Group by depth
    by_depth = defaultdict(list)
    for item in affected:
        by_depth[item['depth']].append(item['function'])

    # Print results
    print(f"Blast Radius for '{target_func}':\n")
    for depth in sorted(by_depth.keys()):
        funcs = sorted(by_depth[depth])
        print(f"Level {depth} ({len(funcs)} functions):")
        for func in funcs:
            print(f"  - {func}")
        print()

    print(f"Total affected functions: {len(affected)}")

if __name__ == '__main__':
    main()
```

**Performance**: ~300-500ms for typical functions

**Example Output**:

```
Blast Radius for 'parseDate':

Level 1 (3 functions):
  - mapRow
  - validateData
  - enrichContactRecord

Level 2 (2 functions):
  - executeMigration
  - runValidation

Total affected functions: 5
```

---

## Algorithm 4: Detect Dead Code

**Purpose**: Find functions with zero callers (never called)

**Complexity**: O(V + E)

### Python Implementation

```python
#!/usr/bin/env python3
"""
Find dead code: functions never called.
Usage: python find-dead-code.py <domain_file>
"""

import json
import sys

def extract_all_functions(files_section):
    """Extract all defined functions with their locations"""
    functions = {}

    for filepath, content in files_section.items():
        if not isinstance(content, list) or len(content) < 2:
            continue

        # Extract top-level functions
        func_list = content[1] if len(content) > 1 else []
        for func_sig in func_list:
            if isinstance(func_sig, str):
                parts = func_sig.split(':')
                if len(parts) >= 2:
                    func_name = parts[0]
                    line = parts[1]
                    functions[func_name] = {'file': filepath, 'line': line}

        # Extract class methods
        if len(content) > 2 and isinstance(content[2], dict):
            for class_name, class_data in content[2].items():
                if isinstance(class_data, list) and len(class_data) > 1:
                    methods = class_data[1]
                    for method_sig in methods:
                        if isinstance(method_sig, str):
                            parts = method_sig.split(':')
                            if len(parts) >= 2:
                                method_name = parts[0]
                                line = parts[1]
                                functions[method_name] = {
                                    'file': filepath,
                                    'line': line,
                                    'class': class_name
                                }

    return functions

def find_dead_code(domain_file, exclude_entry_points=True):
    """Find functions with no callers"""
    with open(domain_file) as f:
        data = json.load(f)

    # Get all defined functions
    all_functions = extract_all_functions(data.get('f', {}))

    # Get all called functions from graph
    edges = data.get('g', [])
    called_functions = set(edge[1] for edge in edges)

    # Find uncalled functions
    dead_code = []
    entry_point_patterns = ['main', 'default', 'run', 'runCli', 'execute']

    for func_name, location in all_functions.items():
        if func_name not in called_functions:
            # Exclude entry points if requested
            if exclude_entry_points:
                if any(func_name.startswith(pattern) for pattern in entry_point_patterns):
                    continue

            dead_code.append({
                'name': func_name,
                'file': location['file'],
                'line': location['line'],
                'class': location.get('class')
            })

    return dead_code

def main():
    if len(sys.argv) != 2:
        print("Usage: find-dead-code.py <domain_file>")
        sys.exit(1)

    domain_file = sys.argv[1]
    dead_code = find_dead_code(domain_file)

    if not dead_code:
        print("✅ No dead code found!")
        return

    print(f"⚠️  Found {len(dead_code)} potentially unused functions:\n")

    for item in sorted(dead_code, key=lambda x: (x['file'], int(x['line']))):
        location = f"{item['file']}:{item['line']}"
        if item.get('class'):
            print(f"  - {item['name']} (in {item['class']}) - {location}")
        else:
            print(f"  - {item['name']} - {location}")

if __name__ == '__main__':
    main()
```

**Performance**: ~200-300ms

---

## Algorithm 5: Detect Circular Dependencies

**Purpose**: Find cycles in call graph (functions that call each other)

**Complexity**: O(V + E)

### Python Implementation

```python
#!/usr/bin/env python3
"""
Detect circular dependencies using DFS.
Usage: python find-cycles.py <domain_file>
"""

import json
import sys
from collections import defaultdict

def build_graph(edges):
    """Build adjacency list: function -> [functions it calls]"""
    graph = defaultdict(list)
    for caller, callee in edges:
        graph[caller].append(callee)
    return graph

def find_all_cycles(graph):
    """Find all cycles using DFS with path tracking"""
    def dfs(node, path, visited, rec_stack):
        visited.add(node)
        rec_stack.add(node)
        path.append(node)

        for neighbor in graph.get(node, []):
            if neighbor not in visited:
                dfs(neighbor, path, visited, rec_stack)
            elif neighbor in rec_stack:
                # Found cycle - extract it
                cycle_start_idx = path.index(neighbor)
                cycle = path[cycle_start_idx:] + [neighbor]
                cycles.append(cycle)

        path.pop()
        rec_stack.remove(node)

    cycles = []
    visited = set()

    for node in graph.keys():
        if node not in visited:
            dfs(node, [], visited, set())

    return cycles

def main():
    if len(sys.argv) != 2:
        print("Usage: find-cycles.py <domain_file>")
        sys.exit(1)

    domain_file = sys.argv[1]

    with open(domain_file) as f:
        data = json.load(f)

    edges = data.get('g', [])
    graph = build_graph(edges)
    cycles = find_all_cycles(graph)

    if not cycles:
        print("✅ No circular dependencies found!")
        return

    print(f"⚠️  Found {len(cycles)} circular dependencies:\n")

    for i, cycle in enumerate(cycles, 1):
        print(f"Cycle {i}:")
        print("  " + " → ".join(cycle))
        print()

if __name__ == '__main__':
    main()
```

**Performance**: ~500ms-1s

---

## Algorithm 6: Find Cross-Domain Dependencies

**Purpose**: Find functions called from outside the domain (external coupling)

**Complexity**: O(V + E)

### Python Implementation

```python
#!/usr/bin/env python3
"""
Find cross-domain dependencies (external function calls).
Usage: python find-cross-domain.py <domain_file>
"""

import json
import sys

def find_cross_domain_dependencies(domain_file):
    with open(domain_file) as f:
        data = json.load(f)

    # Extract all functions defined in THIS domain
    domain_functions = set()
    for filepath, content in data.get('f', {}).items():
        if isinstance(content, list) and len(content) > 1:
            for func_sig in content[1]:
                if isinstance(func_sig, str):
                    func_name = func_sig.split(':')[0]
                    domain_functions.add(func_name)

    # Find calls to external functions
    external_deps = set()
    edges = data.get('g', [])
    for caller, callee in edges:
        if caller in domain_functions and callee not in domain_functions:
            external_deps.add(callee)

    return sorted(external_deps)

def main():
    if len(sys.argv) != 2:
        print("Usage: find-cross-domain.py <domain_file>")
        sys.exit(1)

    domain_file = sys.argv[1]
    external = find_cross_domain_dependencies(domain_file)

    if not external:
        print("✅ No cross-domain dependencies")
        return

    print(f"Cross-domain dependencies ({len(external)}):\n")
    for func in external:
        print(f"  - {func}")

if __name__ == '__main__':
    main()
```

**Performance**: ~150-250ms

---

## Algorithm 7: Find Hotspots (Most Connected Functions)

**Purpose**: Find functions with most callers (high change risk)

**Complexity**: O(E)

### Bash Implementation (jq)

```bash
#!/bin/bash
# Usage: find-hotspots.sh <domain_file> [limit]

DOMAIN_FILE="$1"
LIMIT="${2:-10}"

jq -r --argjson limit "$LIMIT" '
  [.g[] | .[1]] |
  group_by(.) |
  map({func: .[0], callers: length}) |
  sort_by(-.callers) |
  .[:$limit] |
  .[] |
  "\(.func) (\(.callers) callers)"
' < "$DOMAIN_FILE"
```

**Performance**: ~100-200ms

---

## Algorithm 8: Trace to Error (Reverse BFS from file:line)

**Purpose**: Find call paths leading to a specific file:line

**Complexity**: O(V + E)

### Python Implementation

```python
#!/usr/bin/env python3
"""
Trace execution paths to a specific file:line.
Usage: python trace-to-error.py <file> <line> <domain_file>
"""

import json
import sys
from collections import defaultdict, deque

def find_function_at_line(files_section, target_file, target_line):
    """Find which function is defined at file:line"""
    target_line = int(target_line)

    for filepath, content in files_section.items():
        if filepath != target_file:
            continue

        if not isinstance(content, list) or len(content) < 2:
            continue

        # Check top-level functions
        for func_sig in content[1]:
            if isinstance(func_sig, str):
                parts = func_sig.split(':')
                if len(parts) >= 2:
                    func_name = parts[0]
                    line = int(parts[1])
                    if line == target_line:
                        return func_name

    return None

def trace_to_error(target_file, target_line, domain_file):
    with open(domain_file) as f:
        data = json.load(f)

    # Find function at target location
    target_func = find_function_at_line(data.get('f', {}), target_file, target_line)

    if not target_func:
        return {"error": f"No function found at {target_file}:{target_line}"}

    # Build reverse graph
    reverse_graph = defaultdict(list)
    for caller, callee in data.get('g', []):
        reverse_graph[callee].append(caller)

    # BFS to find all paths
    paths = []
    queue = deque([[target_func]])

    while queue:
        path = queue.popleft()
        current = path[-1]

        callers = reverse_graph.get(current, [])

        if not callers:
            # Found entry point
            paths.append(path)
        else:
            for caller in callers:
                if caller not in path:  # Avoid cycles
                    queue.append(path + [caller])

    return {
        "function_at_line": target_func,
        "paths": paths,
        "total_paths": len(paths)
    }

def main():
    if len(sys.argv) != 4:
        print("Usage: trace-to-error.py <file> <line> <domain_file>")
        sys.exit(1)

    target_file = sys.argv[1]
    target_line = sys.argv[2]
    domain_file = sys.argv[3]

    result = trace_to_error(target_file, target_line, domain_file)

    if "error" in result:
        print(f"Error: {result['error']}")
        return

    print(f"Function at {target_file}:{target_line}: {result['function_at_line']}")
    print(f"\nFound {result['total_paths']} call paths:\n")

    for i, path in enumerate(result['paths'], 1):
        print(f"Path {i}:")
        print("  " + " → ".join(reversed(path)))
        print()

if __name__ == '__main__':
    main()
```

**Performance**: ~400-600ms

---

## Performance Summary

| Algorithm      | Complexity | Typical Time | Scales To   |
| -------------- | ---------- | ------------ | ----------- |
| Find callers   | O(E)       | ~20ms (jq)   | 10K edges   |
| Find calls     | O(E)       | ~20ms (jq)   | 10K edges   |
| Blast radius   | O(V+E)     | ~300ms       | 1K vertices |
| Dead code      | O(V+E)     | ~200ms       | 5K vertices |
| Cycles         | O(V+E)     | ~500ms       | 1K vertices |
| Cross-domain   | O(V+E)     | ~150ms       | 5K vertices |
| Hotspots       | O(E)       | ~100ms (jq)  | 10K edges   |
| Trace to error | O(V+E)     | ~400ms       | 1K vertices |

**Optimization Strategy**:

- Use **jq** for simple queries (find-callers, find-calls, hotspots)
- Use **Python** for graph algorithms (blast-radius, cycles, trace-to-error)
- Never load entire files (defeats token efficiency purpose)

---

**Fast • Deterministic • Scalable**
