# Using Scripts in Skills

## Purpose

Scripts are executable code that Claude runs as-is rather than regenerating each time. They ensure reliable, error-free execution of repeated operations.

## When to Use

Use scripts when:
- The same code runs across multiple skill invocations
- Operations are error-prone when rewritten from scratch
- Complex shell commands or API interactions are involved
- Consistency matters more than flexibility

Common script types:
- **Deployment** - Deploy to Vercel, publish packages, push releases
- **Setup** - Initialize projects, install dependencies, configure environments
- **API calls** - Authenticated requests, webhook handlers, data fetches
- **Data processing** - Transform files, batch operations, migrations
- **Build processes** - Compile, bundle, test runners

### Execution vs Reference

Make clear whether Claude should:
- **Execute the script** (most common): "Run `analyze_form.py` to extract fields"
- **Read it as reference** (for complex logic): "See `analyze_form.py` for the extraction algorithm"

For most utility scripts, execution is preferred.

### How Scripts Work

When Claude executes a script via bash:
1. Script code never enters context window
2. Only script output consumes tokens
3. Far more efficient than having Claude generate equivalent code

## File Organization

Place all executable scripts in a `scripts/` subdirectory within the skill folder:

```
skill-name/
├── SKILL.md
├── scripts/
│   ├── main_utility.py
│   ├── helper_script.py
│   └── validator.py
└── references/
    └── api-docs.md
```

**Benefits:**
- Keeps skill root clean and organized
- Clear separation between documentation and executable code
- Consistent pattern across all skills
- Easy to reference: `python scripts/script_name.py`

**Reference pattern:** In SKILL.md, reference scripts using the `scripts/` path:

```bash
python ~/.claude/skills/skill-name/scripts/analyze.py input.har
```

## Utility Scripts Pattern

**analyze_form.py**: Extract all form fields from PDF

```bash
python scripts/analyze_form.py input.pdf > fields.json
```

Output format:
```json
{
  "field_name": { "type": "text", "x": 100, "y": 200 },
  "signature": { "type": "sig", "x": 150, "y": 500 }
}
```

**validate_boxes.py**: Check for overlapping bounding boxes

```bash
python scripts/validate_boxes.py fields.json
# Returns: "OK" or lists conflicts
```

**fill_form.py**: Apply field values to PDF

```bash
python scripts/fill_form.py input.pdf fields.json output.pdf
```

## Solve, Don't Punt

Handle error conditions rather than punting to Claude.

**Good:**
```python
def process_file(path):
    """Process a file, creating it if it doesn't exist."""
    try:
        with open(path) as f:
            return f.read()
    except FileNotFoundError:
        print(f"File {path} not found, creating default")
        with open(path, 'w') as f:
            f.write('')
        return ''
    except PermissionError:
        print(f"Cannot access {path}, using default")
        return ''
```

**Bad:**
```python
def process_file(path):
    # Just fail and let Claude figure it out
    return open(path).read()
```

### Configuration Values

Document configuration parameters to avoid "voodoo constants":

**Good:**
```python
# HTTP requests typically complete within 30 seconds
REQUEST_TIMEOUT = 30

# Three retries balances reliability vs speed
MAX_RETRIES = 3
```

**Bad:**
```python
TIMEOUT = 47  # Why 47?
RETRIES = 5   # Why 5?
```

## Package Dependencies

Skills run in code execution environment with platform-specific limitations:
- **claude.ai**: Can install packages from npm and PyPI
- **Anthropic API**: No network access and no runtime package installation

List required packages in your SKILL.md and verify they're available.

**Good:**
```
Install required package: `pip install pypdf`

Then use it:

```python
from pypdf import PdfReader
reader = PdfReader("file.pdf")
```
```

**Bad:**
```
"Use the pdf library to process the file."
```

## MCP Tool References

If your Skill uses MCP (Model Context Protocol) tools, always use fully qualified tool names.

**Format:** `ServerName:tool_name`

**Examples:**
- Use the BigQuery:bigquery_schema tool to retrieve table schemas.
- Use the GitHub:create_issue tool to create issues.

Without the server prefix, Claude may fail to locate the tool, especially when multiple MCP servers are available.

## Workflow Integration

Workflows reference scripts like this:

```markdown
### Step 5: Deploy

1. Ensure all tests pass
2. Run `scripts/deploy.sh production`
3. Verify deployment succeeded
4. Update user with deployment URL
```

The workflow tells Claude WHEN to run the script. The script handles HOW the operation executes.

## Best Practices

**Do:**
- Make scripts idempotent (safe to run multiple times)
- Include clear usage comments
- Validate inputs before executing
- Provide meaningful error messages
- Use `set -euo pipefail` in bash scripts

**Don't:**
- Hardcode secrets or credentials (use environment variables)
- Create scripts for one-off operations
- Skip error handling
- Make scripts do too many unrelated things
- Forget to make scripts executable (`chmod +x`)

## Security Considerations

- Never embed API keys, tokens, or secrets in scripts
- Use environment variables for sensitive configuration
- Validate and sanitize any user-provided inputs
- Be cautious with scripts that delete or modify data
- Consider adding `--dry-run` options for destructive operations
