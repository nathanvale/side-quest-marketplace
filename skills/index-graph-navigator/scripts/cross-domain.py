#!/usr/bin/env python3
"""
Find cross-domain dependencies (functions called from outside a domain)
Queries PROJECT_INDEX.json directly with domain mapping

Usage:
  python3 cross-domain.py csv-processing           # External deps for csv-processing
  python3 cross-domain.py csv-processing --json    # Full JSON output

Returns: Functions from other domains that this domain depends on
"""

import json
import sys
from pathlib import Path

# Add lib directory to path
sys.path.insert(0, str(Path(__file__).parent / 'lib'))
from domain_mapping import extract_domain_from_path, load_custom_rules
from find_project_index import find_project_index_or_exit

def analyze_cross_domain_deps(files, edges, target_domain, custom_rules):
    """Find external dependencies for a domain"""
    # Map each function to its domain
    func_to_domain = {}

    for filepath, content in files.items():
        domain = extract_domain_from_path(filepath, custom_rules)

        # Extract functions in this file
        if isinstance(content, list) and len(content) > 1:
            funcs = content[1] if isinstance(content[1], list) else []
            for func_def in funcs:
                if isinstance(func_def, str):
                    func_name = func_def.split(':')[0]
                    func_to_domain[func_name] = domain

    # Find functions defined in target domain
    target_functions = {func for func, domain in func_to_domain.items() if domain == target_domain}

    # Find functions called by target domain
    called_functions = set()
    for edge in edges:
        if isinstance(edge, list) and len(edge) >= 2:
            caller, callee = edge[0], edge[1]
            if caller in target_functions:
                called_functions.add(callee)

    # External dependencies = called but not in target domain
    external_deps = {}
    for func in called_functions:
        func_domain = func_to_domain.get(func)
        if func_domain and func_domain != target_domain:
            if func_domain not in external_deps:
                external_deps[func_domain] = []
            external_deps[func_domain].append(func)

    return external_deps

def main():
    import argparse

    parser = argparse.ArgumentParser(description='Find cross-domain dependencies')
    parser.add_argument('domain', help='Domain to analyze')
    parser.add_argument('--json', action='store_true', help='Output JSON format')
    args = parser.parse_args()

    # Find PROJECT_INDEX.json (searches upward from current directory)
    index_path = find_project_index_or_exit()

    # Load index
    with open(index_path) as f:
        data = json.load(f)

    files = data.get('f', {})
    edges = data.get('g', [])

    # Load custom rules
    custom_rules = load_custom_rules(str(project_root))

    # Analyze dependencies
    external_deps = analyze_cross_domain_deps(files, edges, args.domain, custom_rules)

    # Format results
    results = []
    total_coupling = 0

    for domain, funcs in sorted(external_deps.items()):
        coupling_strength = len(funcs)
        total_coupling += coupling_strength
        results.append({
            'from_domain': domain,
            'functions': funcs,
            'coupling_strength': coupling_strength
        })

    if args.json:
        output = {
            'status': 'success',
            'query': 'cross-domain',
            'domain': args.domain,
            'results': results,
            'summary': {
                'total_external_deps': sum(r['coupling_strength'] for r in results),
                'coupled_domains': [r['from_domain'] for r in results],
                'coupling_score': total_coupling
            }
        }
        print(json.dumps(output, indent=2))
    else:
        print(f"Cross-domain dependencies for '{args.domain}':\n")
        if not results:
            print("  No external dependencies")
        else:
            for r in results:
                print(f"  {r['from_domain']}: {r['coupling_strength']} dependencies")
                for func in r['functions'][:5]:  # Show first 5
                    print(f"    - {func}")
                if len(r['functions']) > 5:
                    print(f"    ... and {len(r['functions']) - 5} more")
                print()

if __name__ == '__main__':
    main()
