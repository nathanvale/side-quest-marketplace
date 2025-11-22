#!/usr/bin/env python3
"""
Analyze PROJECT_INDEX.json and generate MANIFEST.json with domain metadata.
Does NOT create separate domain JSON files - all queries use PROJECT_INDEX.json directly.

**Token Efficiency**: This script runs OUTSIDE Claude's context.
It analyzes the index and produces a lightweight MANIFEST (~2-5 KB) with domain metadata.

Usage:
  python3 extract-domains.py                    # Generate MANIFEST.json
  python3 extract-domains.py --check            # Check if regeneration needed (exit 0=no, 1=yes)
  python3 extract-domains.py --json             # Output JSON format

Output:
  .claude/state/index-graph-navigator/
    └── MANIFEST.json              # Domain metadata (files count, functions count, etc.)

Exit codes:
  0 = Success (or no regeneration needed for --check)
  1 = Regeneration needed (for --check mode) or error
"""

import json
import os
import sys
from collections import defaultdict
from pathlib import Path

# Add lib directory to path for imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'lib'))
from domain_mapping import extract_domain_from_path, kebab_case, load_custom_rules
from find_project_index import find_project_index_or_exit

def load_index(index_path: Path) -> dict:
    """Load PROJECT_INDEX.json"""
    try:
        with open(index_path, 'r') as f:
            return json.load(f)
    except FileNotFoundError:
        return {
            'status': 'error',
            'error': f'PROJECT_INDEX.json not found at {index_path}',
            'hint': 'Run the /index command to generate PROJECT_INDEX.json',
            'searched_paths': [str(index_path)]
        }

def analyze_domains(full_index: dict, custom_rules) -> dict:
    """
    Analyze PROJECT_INDEX.json and return domain statistics.
    Does NOT extract separate files - just analyzes what's there.
    """
    files = full_index.get('f', {})
    edges = full_index.get('g', [])

    # Group files by domain
    domains_data = defaultdict(lambda: {
        'files': [],
        'functions': set(),
        'edges_count': 0
    })

    for filepath, content in files.items():
        domain = extract_domain_from_path(filepath, custom_rules)
        domains_data[domain]['files'].append(filepath)

        # Extract function names
        if isinstance(content, list) and len(content) > 1:
            funcs = content[1] if isinstance(content[1], list) else []
            for func_def in funcs:
                if isinstance(func_def, str):
                    func_name = func_def.split(':')[0]
                    domains_data[domain]['functions'].add(func_name)

    # Count edges per domain
    if isinstance(edges, list):
        for edge in edges:
            if isinstance(edge, list) and len(edge) >= 2:
                caller = edge[0]
                # Find which domain owns this caller
                for domain, data in domains_data.items():
                    if caller in data['functions']:
                        data['edges_count'] += 1
                        break

    return domains_data

def check_regeneration_needed(project_root: Path, index_path: Path) -> bool:
    """
    Check if MANIFEST regeneration is needed (missing or stale)

    Returns:
        True if regeneration needed, False otherwise
    """
    manifest_path = project_root / '.claude' / 'state' / 'index-graph-navigator' / 'MANIFEST.json'

    # If manifest doesn't exist, regeneration needed
    if not manifest_path.exists():
        return True

    # Check if PROJECT_INDEX.json is newer than manifest
    index_mtime = index_path.stat().st_mtime
    manifest_mtime = manifest_path.stat().st_mtime

    if index_mtime > manifest_mtime:
        return True

    return False

def main():
    import argparse

    parser = argparse.ArgumentParser(description='Generate domain MANIFEST from PROJECT_INDEX.json')
    parser.add_argument('--check', action='store_true', help='Check if regeneration needed (exit 0=no, 1=yes)')
    parser.add_argument('--json', action='store_true', help='Output JSON format')
    args = parser.parse_args()

    # Find PROJECT_INDEX.json (searches upward from current directory)
    index_path = find_project_index_or_exit()
    project_root = index_path.parent


    # Check mode
    if args.check:
        needed = check_regeneration_needed(project_root, index_path)
        sys.exit(1 if needed else 0)

    # Load full index
    full_index = load_index(index_path)

    if 'status' in full_index and full_index['status'] == 'error':
        if args.json:
            print(json.dumps(full_index, indent=2))
        else:
            print(f"❌ Error: {full_index['error']}")
        sys.exit(1)

    # Create output directory
    output_dir = project_root / '.claude' / 'state' / 'index-graph-navigator'
    output_dir.mkdir(parents=True, exist_ok=True)

    # Load custom domain rules if available
    custom_rules = load_custom_rules(str(project_root))

    # Analyze domains
    domains_data = analyze_domains(full_index, custom_rules)

    if not args.json:
        print("=" * 80)
        print("DOMAIN MANIFEST GENERATOR")
        print("=" * 80)
        print()
        print(f"Project root:  {project_root}")
        print(f"Index source:  {index_path}")
        print(f"Total files:   {len(full_index.get('f', {}))}")
        print(f"Total domains: {len(domains_data)}")
        print()

    # Build MANIFEST
    manifest = {
        'generated': full_index.get('at', 'unknown'),
        'source': str(index_path),
        'project_root': str(project_root),
        'total_domains': len(domains_data),
        'domains': {}
    }

    if not args.json:
        print(f"{'Domain':<50} {'Files':<8} {'Functions':<12} {'Edges':<8}")
        print("-" * 80)

    for domain_name in sorted(domains_data.keys()):
        data = domains_data[domain_name]
        files_count = len(data['files'])
        functions_count = len(data['functions'])
        edges_count = data['edges_count']

        # Add to manifest
        manifest['domains'][domain_name] = {
            'files_count': files_count,
            'functions_count': functions_count,
            'edges_count': edges_count,
            'kebab_name': kebab_case(domain_name)
        }

        if not args.json:
            print(f"{domain_name:<50} {files_count:<8} {functions_count:<12} {edges_count:<8}")

    # Save manifest
    manifest_file = output_dir / "MANIFEST.json"
    with open(manifest_file, 'w') as f:
        json.dump(manifest, f, indent=2)

    if args.json:
        output = {
            'status': 'success',
            'manifest': str(manifest_file),
            'total_domains': len(domains_data),
            'domains': list(manifest['domains'].keys())
        }
        print(json.dumps(output, indent=2))
    else:
        print()
        print("=" * 80)
        print("✅ MANIFEST GENERATED")
        print("=" * 80)
        print()
        print(f"Location: {manifest_file}")
        print(f"Domains:  {len(domains_data)}")
        print()
        print("Note: All queries use PROJECT_INDEX.json directly.")
        print("      Domain metadata is for reference only.")

if __name__ == '__main__':
    main()
