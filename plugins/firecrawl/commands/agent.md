---
description: AI-powered web research and structured data extraction
argument-hint: "<prompt>" [--urls <urls>] [--wait]
allowed-tools: Bash
---

# Firecrawl Agent

Run AI agent for: `$ARGUMENTS`

## Instructions

1. Parse the arguments:
   - First argument (quoted) is the natural language prompt
   - Always add `--wait` if not already present
   - Key flags: `--urls`, `--model`, `--schema`, `--max-credits`

2. Run the command:
   ```bash
   npx firecrawl agent $ARGUMENTS
   ```

3. Present the results to the user

## Example Usage

```
/firecrawl:agent "Find top 5 AI startups and their funding" --wait
/firecrawl:agent "Compare pricing plans" --urls https://slack.com/pricing,https://notion.so/pricing --wait
/firecrawl:agent "Get company info" --urls https://example.com --schema '{"name": "string", "founded": "number"}' --wait
```

## Key Flags

- `--wait` - Block until agent completes (always recommended)
- `--urls <urls>` - Comma-separated focus URLs
- `--model <model>` - `spark-1-mini` (default) or `spark-1-pro` (accurate)
- `--schema '<json>'` - JSON schema for structured output
- `--schema-file <path>` - Path to schema file
- `--max-credits <n>` - Spending limit
- `-o <path>` - Save to file

For full flag reference, see `skills/firecrawl/references/agent-reference.md`

## Notes

- Tasks typically take 2-5 minutes
- Use `--max-credits` to control costs
- Provide `--urls` when you know the data source
- Omit `--urls` for open-ended research
- Requires FIRECRAWL_API_KEY or `firecrawl login`
