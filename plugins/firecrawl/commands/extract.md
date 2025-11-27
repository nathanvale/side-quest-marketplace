---
description: Extract structured data from a URL using LLM
argument-hint: <url> --prompt "..." [--schema '{...}']
---

# Firecrawl Extract

Extract data from: `$ARGUMENTS`

## Instructions

1. Parse the arguments:
   - First argument is the URL to extract from
   - Required `--prompt "text"` - What to extract
   - Optional `--schema '{...}'` - JSON Schema for structured output

2. Run the CLI command:
   ```bash
   cd /Users/nathanvale/code/side-quest-marketplace/plugins/firecrawl && bun run src/cli.ts extract $ARGUMENTS
   ```

3. Present the extracted data to the user

## Example Usage

```
/firecrawl:extract https://example.com --prompt "Extract the main heading and description"
/firecrawl:extract https://store.example.com/product --prompt "Extract price and name" --schema '{"price": {"type": "number"}, "name": {"type": "string"}}'
```

## Notes

- Extraction is async - the command polls for completion
- May take 10-30 seconds depending on page complexity
- Use --schema for type-safe structured output
- Requires FIRECRAWL_API_KEY environment variable
