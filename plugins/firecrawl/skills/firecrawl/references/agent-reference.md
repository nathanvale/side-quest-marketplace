# Agent Reference

AI-powered research agent that autonomously browses the web and extracts
structured data from natural language prompts.

## Usage

```bash
firecrawl agent "<prompt>" [flags]
firecrawl agent <job-id> --status    # check existing job
```

## Flags

| Flag | Description |
|------|-------------|
| `--urls <urls>` | Comma-separated focus URLs (optional - agent can discover on its own) |
| `--model <model>` | `spark-1-mini` (default, cheaper) or `spark-1-pro` (more accurate) |
| `--schema '<json>'` | Inline JSON schema for structured output |
| `--schema-file <path>` | Path to JSON schema file |
| `--max-credits <n>` | Maximum credits to spend (fails if exceeded) |
| `--wait` | Wait for agent to complete (recommended) |
| `--poll-interval <sec>` | Status check frequency (default: 5) |
| `--timeout <sec>` | Maximum wait time |
| `--status` | Check status of existing job |
| `--output <path>` | Save to file |
| `--json` | JSON output format |
| `--pretty` | Pretty-print JSON |

## Examples

```bash
# Open-ended research
firecrawl agent "Find the top 5 AI startups founded in 2025 and their funding" --wait

# Focused extraction with URLs
firecrawl agent "Compare pricing plans" \
  --urls https://slack.com/pricing,https://notion.so/pricing \
  --wait

# Structured output with schema
firecrawl agent "Get company details" \
  --urls https://example.com \
  --schema '{"name": "string", "founded": "number", "employees": "number"}' \
  --wait

# Use schema file
firecrawl agent "Extract product catalog" \
  --urls https://store.example.com \
  --schema-file products-schema.json \
  --wait

# Higher accuracy model with credit limit
firecrawl agent "Analyze competitor pricing strategies" \
  --model spark-1-pro \
  --max-credits 100 \
  --wait

# Save results
firecrawl agent "Research React frameworks 2026" --wait -o research.json --pretty

# Check status of running job
firecrawl agent abc123-job-id --status
```

## Model Selection

| Model | Best For | Cost |
|-------|----------|------|
| `spark-1-mini` | Simple queries, known URLs, budget-conscious | Lower |
| `spark-1-pro` | Complex research, multi-step reasoning, accuracy-critical | Higher |

## Tips

- Tasks typically take 2-5 minutes
- Use `--max-credits` to prevent runaway costs
- Provide `--urls` when you know where the data lives
- Omit `--urls` for open-ended research (agent discovers sources)
- Use `--schema` for predictable, typed output
- Always use `--wait` unless polling manually
