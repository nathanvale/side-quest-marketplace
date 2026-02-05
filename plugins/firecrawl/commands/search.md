---
description: Search the web and get results with content
argument-hint: <query> [--limit N] [--scrape]
allowed-tools: Bash
---

# Firecrawl Search

Search the web for: `$ARGUMENTS`

## Instructions

1. Parse the arguments:
   - All non-flag arguments form the search query
   - Key flags: `--limit`, `--scrape`, `--sources`, `--categories`, `--tbs`

2. Run the command:
   ```bash
   npx firecrawl search $ARGUMENTS
   ```

3. Present the search results to the user

## Example Usage

```
/firecrawl:search typescript error handling best practices
/firecrawl:search "react hooks" --limit 10
/firecrawl:search "AI news" --scrape --tbs qdr:w
/firecrawl:search "MCP server" --categories github --limit 5
```

## Key Flags

- `--limit <n>` - Max results (default: 5, max: 100)
- `--scrape` - Also scrape each result for full content
- `--sources <types>` - web, images, news
- `--categories <types>` - github, research, pdf
- `--tbs <value>` - Time: `qdr:h` (hour), `qdr:d` (day), `qdr:w` (week), `qdr:m` (month), `qdr:y` (year)
- `--country <code>` - ISO country code (default: US)
- `-o <path>` - Save to file

## Search Operators (in query string)

- `"exact phrase"` - exact match
- `-term` - exclude term
- `site:example.com` - limit to domain
- `intitle:word` - word in title

For full flag reference, see `skills/firecrawl/references/search-reference.md`

## Notes

- Costs 1 credit per result
- Use `--scrape` when you need full page content, not just snippets
- Requires FIRECRAWL_API_KEY or `firecrawl login`
