---
description: Extract structured data from a URL using LLM
argument-hint: <url> --prompt "..." [--schema '{...}']
allowed-tools: Bash
---

# Firecrawl Extract

Extract data from: `$ARGUMENTS`

## Instructions

1. Parse the arguments:
   - First argument is the URL to extract from
   - Required: `--prompt "text"` describing what to extract
   - Optional: `--schema '{...}'` or `--schema-file <path>` for typed output

2. Build the agent command (extract wraps firecrawl agent):
   - Take the URL from the first argument and pass it as `--urls`
   - Take the prompt and pass it as the agent's prompt argument
   - Pass through `--schema`, `--schema-file`, `--model`, `--max-credits`
   - Always add `--wait`

3. Run the command:
   ```bash
   npx firecrawl agent "<prompt>" --urls <url> --wait $REMAINING_FLAGS
   ```

4. Present the extracted data to the user

## Example Usage

```
/firecrawl:extract https://example.com --prompt "Extract the main heading and description"
/firecrawl:extract https://store.com/product --prompt "Extract price and features" --schema '{"price": "number", "features": ["string"]}'
/firecrawl:extract https://example.com/team --prompt "Extract team members" --schema-file team.json
```

## Key Flags

- `--prompt "text"` - What to extract (required)
- `--schema '{...}'` - Inline JSON schema for structured output
- `--schema-file <path>` - Path to JSON schema file
- `--model <model>` - `spark-1-mini` (default) or `spark-1-pro`
- `--max-credits <n>` - Limit credit spend
- `-o <path>` - Save to file

For full flag reference, see `skills/firecrawl/references/extract-reference.md`

## Notes

- Extract uses the Firecrawl agent under the hood
- May take 1-5 minutes depending on complexity
- Use `--schema` for predictable, typed output
- Credit cost varies (typically 5-50 credits)
- Requires FIRECRAWL_API_KEY or `firecrawl login`
