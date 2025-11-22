#!/usr/bin/env python3
"""
Shared domain mapping rules for domain extraction from PROJECT_INDEX.json.
Provides deterministic domain identification for any codebase.

Usage:
    from lib.domain_mapping import extract_domain_from_path, DOMAIN_RULES
"""

# Domain extraction rules (pattern → domain name)
# Order matters: more specific patterns first
# These are EXAMPLES - each project should customize based on their structure
DEFAULT_DOMAIN_RULES = [
    ('commands/', 'commands-cli-operations'),
    ('lib/services/', 'service-factory-abstractions'),
    ('lib/dynamics/', 'dataverse-repositories'),
    ('lib/config/', 'configuration-management'),
    ('lib/csv/', 'csv-processing'),
    ('lib/migration/', 'migration-pipelines'),
    ('lib/adapters/', 'csv-adapters'),
    ('lib/sanitization/', 'pii-sanitization'),
    ('lib/validation/', 'data-validation'),
    ('lib/utils/', 'utilities-helpers'),
    ('lib/extraction/', 'data-extraction'),
    ('lib/mocks/', 'test-fixtures-mocks'),
    ('lib/errors/', 'error-handling'),
    ('tests/', 'tests'),
    ('test/', 'tests'),
    ('examples/', 'examples-documentation'),
    ('src/components/', 'ui-components'),
    ('src/pages/', 'pages-routes'),
    ('src/api/', 'api-endpoints'),
    ('src/hooks/', 'react-hooks'),
    ('src/utils/', 'utilities'),
]

def extract_domain_from_path(filepath: str, rules=None) -> str:
    """
    Extract domain from file path using rule-based matching.

    Args:
        filepath: File path to analyze
        rules: Optional custom rules, defaults to DEFAULT_DOMAIN_RULES

    Returns:
        Domain name matching the file path, defaults to 'core-cli'

    Examples:
        >>> extract_domain_from_path("apps/migration-cli/src/commands/migrate.ts")
        'commands-cli-operations'
        >>> extract_domain_from_path("apps/migration-cli/src/lib/services/blob-storage.ts")
        'service-factory-abstractions'
        >>> extract_domain_from_path("apps/migration-cli/src/cli.ts")
        'core-cli'
    """
    if rules is None:
        rules = DEFAULT_DOMAIN_RULES

    path_lower = filepath.lower()

    for pattern, domain in rules:
        if pattern in path_lower:
            return domain

    # Default fallback for files not matching any pattern
    return 'core-cli'

def normalize_path(path: str) -> str:
    """
    Normalize file path for cross-platform comparison.

    Args:
        path: File path to normalize

    Returns:
        Normalized path with forward slashes and lowercase

    Examples:
        >>> normalize_path("Apps\\Migration\\File.ts")
        'apps/migration/file.ts'
    """
    return path.replace('\\', '/').lower()

def kebab_case(name: str) -> str:
    """
    Convert domain name to kebab-case for filenames.

    Examples:
        >>> kebab_case("Commands CLI Operations")
        'commands-cli-operations'
        >>> kebab_case("Service Factory")
        'service-factory'
    """
    return name.lower().replace(' ', '-')

def load_custom_rules(project_root: str):
    """
    Load custom domain rules from .claude/domain-rules.py if exists.

    Args:
        project_root: Path to project root

    Returns:
        Custom rules list or DEFAULT_DOMAIN_RULES if file doesn't exist
    """
    import os
    import importlib.util

    rules_file = os.path.join(project_root, '.claude', 'domain-rules.py')

    if not os.path.exists(rules_file):
        return DEFAULT_DOMAIN_RULES

    # Dynamically load custom rules
    spec = importlib.util.spec_from_file_location("domain_rules", rules_file)
    if spec and spec.loader:
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        return getattr(module, 'DOMAIN_RULES', DEFAULT_DOMAIN_RULES)

    return DEFAULT_DOMAIN_RULES
