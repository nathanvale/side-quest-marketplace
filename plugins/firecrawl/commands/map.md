---
description: Discover all URLs on a website
argument-hint: <url> [--limit N]
---

# Firecrawl Map

Map URLs on the website: `$ARGUMENTS`

## Instructions

1. Parse the arguments:
   - First argument is the base URL to map
   - Optional `--limit N` flag (default: 100)

2. Run the CLI command:
   ```bash
   cd /Users/nathanvale/code/side-quest-marketplace/plugins/firecrawl && bun run src/cli.ts map $ARGUMENTS
   ```

3. Present the discovered URLs to the user

## Example Usage

```
/firecrawl:map https://docs.example.com
/firecrawl:map https://example.com --limit 50
```

## Notes

- Returns up to 50 URLs in output (configurable via --limit)
- Includes page titles when available
- Useful for understanding site structure before scraping specific pages
- Requires FIRECRAWL_API_KEY environment variable
