---
description: Scrape content from a URL as markdown
argument-hint: <url> [--format markdown|summary]
---

# Firecrawl Scrape

Scrape content from the URL: `$ARGUMENTS`

## Instructions

1. Parse the arguments:
   - First argument is the URL to scrape
   - Optional `--format` flag: `markdown` (default) or `summary`

2. Run the CLI command:
   ```bash
   cd /Users/nathanvale/code/side-quest-marketplace/plugins/firecrawl && bun run src/cli.ts scrape $ARGUMENTS
   ```

3. Present the results to the user in a clean format

## Example Usage

```
/firecrawl:scrape https://docs.example.com/api
/firecrawl:scrape https://example.com --format summary
```

## Notes

- Returns markdown content by default
- Content is truncated at 8000 characters to save tokens
- Requires FIRECRAWL_API_KEY environment variable
