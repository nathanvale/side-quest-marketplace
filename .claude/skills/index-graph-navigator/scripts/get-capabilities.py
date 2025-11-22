#!/usr/bin/env python3
"""
Return capabilities API for index-graph-navigator skill.
This allows other skills to discover what queries are supported and how to invoke them.

Usage:
  python3 get-capabilities.py           # Full capabilities JSON
  python3 get-capabilities.py --query blast-radius  # Specific query docs

Returns: JSON with schemas, XML examples, and composability patterns
"""

import json
import sys

CAPABILITIES = {
    "skill": "index-graph-navigator",
    "version": "1.0.0",
    "description": "Token-efficient graph navigation for codebase analysis. Queries PROJECT_INDEX.json without loading into Claude's context.",
    "integration": {
        "invocation_method": "Skill(index-graph-navigator)",
        "response_format": "JSON",
        "zero_context_pollution": True,
        "note": "All scripts run outside Claude's context. Only results (200-500 tokens) are returned."
    },
    "capabilities": [
        {
            "query_type": "blast-radius",
            "category": "impact-analysis",
            "description": "Find all functions affected if target changes (transitive callers using BFS)",
            "use_cases": [
                "What breaks if I refactor this function?",
                "Impact analysis before making changes",
                "Assess change risk"
            ],
            "input_schema": {
                "type": "object",
                "required": ["target"],
                "properties": {
                    "target": {"type": "string", "description": "Function name to analyze"},
                    "depth": {"type": "number", "description": "Max traversal depth (optional)"},
                    "limit": {"type": "number", "description": "Max results (default: 100)"}
                }
            },
            "output_schema": {
                "type": "object",
                "properties": {
                    "status": {"enum": ["success", "error"]},
                    "results": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "function": {"type": "string"},
                                "depth": {"type": "number"},
                                "type": {"enum": ["direct-caller", "transitive-caller"]}
                            }
                        }
                    },
                    "summary": {
                        "type": "object",
                        "properties": {
                            "total": {"type": "number"},
                            "max_depth": {"type": "number"}
                        }
                    }
                }
            },
            "examples": {
                "basic": '<example>\n<query>python3 scripts/blast-radius.py parseDate --json</query>\n<returns>JSON with affected functions and depths</returns>\n</example>',
                "with_depth_limit": '<example>\n<query>python3 scripts/blast-radius.py parseDate --depth 3 --json</query>\n<returns>Only functions within 3 levels of depth</returns>\n</example>'
            },
            "performance": {
                "typical_time_ms": 300,
                "token_cost": 400,
                "scales_to": "1K functions"
            },
            "script": "scripts/blast-radius.py"
        },
        {
            "query_type": "find-callers",
            "category": "dependency-analysis",
            "description": "Find direct callers of a function (reverse dependencies)",
            "use_cases": [
                "Who directly calls this function?",
                "Find immediate dependencies",
                "Usage analysis"
            ],
            "input_schema": {
                "type": "object",
                "required": ["target"],
                "properties": {
                    "target": {"type": "string", "description": "Function name"},
                    "domain": {"type": "string", "description": "Optional: filter to domain"}
                }
            },
            "output_schema": {
                "type": "object",
                "properties": {
                    "status": {"enum": ["success", "error"]},
                    "results": {
                        "type": "array",
                        "items": {"type": "string"}
                    },
                    "summary": {
                        "type": "object",
                        "properties": {
                            "total": {"type": "number"}
                        }
                    }
                }
            },
            "examples": {
                "basic": '<example>\n<query>bash scripts/find-callers.sh parseDate --json</query>\n<returns>List of direct callers</returns>\n</example>',
                "with_domain": '<example>\n<query>bash scripts/find-callers.sh parseDate --domain csv-processing --json</query>\n<returns>Callers only in csv-processing domain</returns>\n</example>'
            },
            "performance": {
                "typical_time_ms": 20,
                "token_cost": 200,
                "scales_to": "10K functions"
            },
            "script": "scripts/find-callers.sh"
        },
        {
            "query_type": "find-calls",
            "category": "dependency-analysis",
            "description": "Find what a function directly calls (forward dependencies)",
            "use_cases": [
                "What does this function call?",
                "Understand function dependencies",
                "Trace execution flow"
            ],
            "input_schema": {
                "type": "object",
                "required": ["target"],
                "properties": {
                    "target": {"type": "string", "description": "Function name"}
                }
            },
            "output_schema": {
                "type": "object",
                "properties": {
                    "status": {"enum": ["success", "error"]},
                    "results": {
                        "type": "array",
                        "items": {"type": "string"}
                    }
                }
            },
            "examples": {
                "basic": '<example>\n<query>bash scripts/find-calls.sh migrateAttachments --json</query>\n<returns>List of called functions</returns>\n</example>'
            },
            "performance": {
                "typical_time_ms": 20,
                "token_cost": 200,
                "scales_to": "10K functions"
            },
            "script": "scripts/find-calls.sh"
        },
        {
            "query_type": "trace-to-error",
            "category": "debugging",
            "description": "Find call stack leading to a file:line (how does execution reach an error?)",
            "use_cases": [
                "Error at file:line, how did we get here?",
                "Debug execution paths",
                "Understand error origins"
            ],
            "input_schema": {
                "type": "object",
                "required": ["file", "line"],
                "properties": {
                    "file": {"type": "string", "description": "File path"},
                    "line": {"type": "number", "description": "Line number"}
                }
            },
            "output_schema": {
                "type": "object",
                "properties": {
                    "status": {"enum": ["success", "error"]},
                    "function_at_line": {"type": "string"},
                    "call_stacks": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "entry_point": {"type": "string"},
                                "path": {"type": "array", "items": {"type": "string"}},
                                "depth": {"type": "number"}
                            }
                        }
                    }
                }
            },
            "examples": {
                "basic": '<example>\n<query>python3 scripts/trace-to-error.py src/lib/csv/parser.ts 123 --json</query>\n<returns>All call paths from entry points to line 123</returns>\n</example>'
            },
            "performance": {
                "typical_time_ms": 400,
                "token_cost": 500,
                "scales_to": "1K functions"
            },
            "script": "scripts/trace-to-error.py"
        },
        {
            "query_type": "dead-code",
            "category": "code-quality",
            "description": "Find functions that are never called (potential dead code)",
            "use_cases": [
                "What can I safely delete?",
                "Find unused code",
                "Code cleanup candidates"
            ],
            "input_schema": {
                "type": "object",
                "properties": {
                    "limit": {"type": "number", "description": "Max results (optional)"}
                }
            },
            "output_schema": {
                "type": "object",
                "properties": {
                    "status": {"enum": ["success", "error"]},
                    "results": {
                        "type": "array",
                        "items": {"type": "string"}
                    },
                    "summary": {
                        "type": "object",
                        "properties": {
                            "total": {"type": "number"}
                        }
                    }
                }
            },
            "examples": {
                "basic": '<example>\n<query>bash scripts/dead-code.sh --json</query>\n<returns>List of functions with no callers</returns>\n</example>',
                "limited": '<example>\n<query>bash scripts/dead-code.sh --limit 20 --json</query>\n<returns>First 20 dead code candidates</returns>\n</example>'
            },
            "performance": {
                "typical_time_ms": 200,
                "token_cost": 300,
                "scales_to": "5K functions"
            },
            "script": "scripts/dead-code.sh"
        },
        {
            "query_type": "cycles",
            "category": "code-quality",
            "description": "Detect circular dependencies using DFS",
            "use_cases": [
                "Find circular refs in code",
                "Detect architectural issues",
                "Refactoring candidates"
            ],
            "input_schema": {
                "type": "object",
                "properties": {}
            },
            "output_schema": {
                "type": "object",
                "properties": {
                    "status": {"enum": ["success", "error"]},
                    "results": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "cycle": {"type": "array", "items": {"type": "string"}},
                                "length": {"type": "number"}
                            }
                        }
                    }
                }
            },
            "examples": {
                "basic": '<example>\n<query>python3 scripts/cycles.py --json</query>\n<returns>All circular dependency chains</returns>\n</example>'
            },
            "performance": {
                "typical_time_ms": 500,
                "token_cost": 400,
                "scales_to": "1K functions"
            },
            "script": "scripts/cycles.py"
        },
        {
            "query_type": "hotspots",
            "category": "code-quality",
            "description": "Find most-connected functions (highest change risk)",
            "use_cases": [
                "Which functions have most callers?",
                "Identify high-maintenance code",
                "Refactoring priorities"
            ],
            "input_schema": {
                "type": "object",
                "properties": {
                    "limit": {"type": "number", "description": "Max results (default: 10)"}
                }
            },
            "output_schema": {
                "type": "object",
                "properties": {
                    "status": {"enum": ["success", "error"]},
                    "results": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "function": {"type": "string"},
                                "callers": {"type": "number"}
                            }
                        }
                    }
                }
            },
            "examples": {
                "basic": '<example>\n<query>bash scripts/hotspots.sh --json</query>\n<returns>Top 10 most-connected functions</returns>\n</example>',
                "custom_limit": '<example>\n<query>bash scripts/hotspots.sh --limit 20 --json</query>\n<returns>Top 20 hotspots</returns>\n</example>'
            },
            "performance": {
                "typical_time_ms": 100,
                "token_cost": 300,
                "scales_to": "10K functions"
            },
            "script": "scripts/hotspots.sh"
        },
        {
            "query_type": "cross-domain",
            "category": "architecture",
            "description": "Find cross-domain dependencies (coupling analysis)",
            "use_cases": [
                "What external functions does this domain use?",
                "Assess domain coupling",
                "Architectural boundaries"
            ],
            "input_schema": {
                "type": "object",
                "required": ["domain"],
                "properties": {
                    "domain": {"type": "string", "description": "Domain to analyze"}
                }
            },
            "output_schema": {
                "type": "object",
                "properties": {
                    "status": {"enum": ["success", "error"]},
                    "results": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "from_domain": {"type": "string"},
                                "functions": {"type": "array", "items": {"type": "string"}},
                                "coupling_strength": {"type": "number"}
                            }
                        }
                    }
                }
            },
            "examples": {
                "basic": '<example>\n<query>python3 scripts/cross-domain.py csv-processing --json</query>\n<returns>External dependencies for csv-processing domain</returns>\n</example>'
            },
            "performance": {
                "typical_time_ms": 150,
                "token_cost": 400,
                "scales_to": "5K functions"
            },
            "script": "scripts/cross-domain.py"
        }
    ],
    "composability_patterns": [
        {
            "pattern_name": "debug_workflow",
            "description": "Investigate a bug by tracing execution and impact",
            "steps": [
                "trace-to-error (find how execution reaches error)",
                "blast-radius (find what would break if we fix it)",
                "find-calls (understand what the buggy function does)"
            ],
            "example": '<workflow>\n<step1>python3 scripts/trace-to-error.py src/parser.ts 123 --json</step1>\n<step2>python3 scripts/blast-radius.py parseDate --json</step2>\n<step3>bash scripts/find-calls.sh parseDate --json</step3>\n<result>Complete picture: how we got here, what breaks, what it calls</result>\n</workflow>'
        },
        {
            "pattern_name": "refactor_planning",
            "description": "Plan safe refactoring by analyzing impact",
            "steps": [
                "blast-radius (what breaks?)",
                "hotspots (is it high-risk?)",
                "cross-domain (does it affect other domains?)"
            ],
            "example": '<workflow>\n<step1>python3 scripts/blast-radius.py parseDate --json</step1>\n<step2>bash scripts/hotspots.sh --json</step2>\n<step3>python3 scripts/cross-domain.py csv-processing --json</step3>\n<result>Risk assessment + refactoring plan</result>\n</workflow>'
        },
        {
            "pattern_name": "code_cleanup",
            "description": "Find dead code and circular dependencies",
            "steps": [
                "dead-code (find unused functions)",
                "cycles (find circular refs)",
                "blast-radius (verify truly unused)"
            ],
            "example": '<workflow>\n<step1>bash scripts/dead-code.sh --json</step1>\n<step2>python3 scripts/cycles.py --json</step2>\n<step3>For each dead code: verify with blast-radius</step3>\n<result>Safe-to-delete candidates</result>\n</workflow>'
        }
    ]
}

def main():
    import argparse

    parser = argparse.ArgumentParser(description='Get index-graph-navigator capabilities')
    parser.add_argument('--query', help='Get docs for specific query type')
    args = parser.parse_args()

    if args.query:
        # Find specific capability
        capability = next((c for c in CAPABILITIES['capabilities'] if c['query_type'] == args.query), None)
        if capability:
            print(json.dumps(capability, indent=2))
        else:
            error = {
                'status': 'error',
                'error': f'Unknown query type: {args.query}',
                'available_queries': [c['query_type'] for c in CAPABILITIES['capabilities']]
            }
            print(json.dumps(error, indent=2), file=sys.stderr)
            sys.exit(1)
    else:
        # Return full capabilities
        print(json.dumps(CAPABILITIES, indent=2))

if __name__ == '__main__':
    main()
