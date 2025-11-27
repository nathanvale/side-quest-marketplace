---
description: Search the web and get results with content
argument-hint: <query> [--limit N]
---

# Firecrawl Search

Search the web for: `$ARGUMENTS`

## Instructions

1. Parse the arguments:
   - All non-flag arguments form the search query
   - Optional `--limit N` flag (default: 5)

2. Run the CLI command:
   ```bash
   cd /Users/nathanvale/code/side-quest-marketplace/plugins/firecrawl && bun run src/cli.ts search $ARGUMENTS
   ```

3. Present the search results to the user

## Example Usage

```
/firecrawl:search typescript error handling best practices
/firecrawl:search "react hooks" --limit 10
/firecrawl:search site:github.com firecrawl examples
```

## Search Operators

- `"exact phrase"` - Match exact phrase
- `-term` - Exclude term
- `site:example.com` - Limit to domain
- `intitle:word` - Word in page title
- `inurl:word` - Word in URL

## Notes

- Returns up to 10 results with titles, URLs, and descriptions
- Includes scraped markdown content when available
- Requires FIRECRAWL_API_KEY environment variable
