# Extract Reference

Extract structured data from web pages using LLM prompts and schemas.

**Note:** The Firecrawl CLI does not have a standalone `extract` subcommand.
The `/firecrawl:extract` slash command wraps `firecrawl agent` with schema
enforcement to provide extraction functionality.

## Usage (via slash command)

```
/firecrawl:extract <url> --prompt "..." [--schema '{...}'] [--schema-file path]
```

## How It Works

Under the hood, `/firecrawl:extract` runs:
```bash
firecrawl agent "<prompt>" --urls <url> --schema '<schema>' --wait
```

## Flags

| Flag | Description |
|------|-------------|
| `--prompt "text"` | What to extract (required) |
| `--schema '{...}'` | Inline JSON schema for structured output |
| `--schema-file <path>` | Path to JSON schema file |
| `--model <model>` | `spark-1-mini` (default) or `spark-1-pro` (more accurate) |
| `--max-credits <n>` | Limit credit spend |
| `--output <path>` | Save to file |
| `--pretty` | Pretty-print JSON |

## Examples

```bash
# Extract heading and description
/firecrawl:extract https://example.com --prompt "Extract the main heading and description"

# Extract with schema for type safety
/firecrawl:extract https://store.com/product \
  --prompt "Extract product details" \
  --schema '{"name": "string", "price": "number", "features": ["string"]}'

# Use schema file for complex extractions
/firecrawl:extract https://example.com/team \
  --prompt "Extract team member info" \
  --schema-file team-schema.json

# Higher accuracy model
/firecrawl:extract https://example.com --prompt "Extract pricing tiers" --model spark-1-pro
```

## Tips

- Always provide a clear, specific prompt
- Use `--schema` for predictable, typed output
- `spark-1-pro` is more accurate but costs more credits
- For simple single-field extraction, scrape + parse may be cheaper
- Credit cost varies by complexity (typically 5-50 credits)
