---
description: Discover all URLs on a website
argument-hint: <url> [--limit N] [--search "filter"]
allowed-tools: Bash
---

# Firecrawl Map

Map URLs on the website: `$ARGUMENTS`

## Instructions

1. Parse the arguments:
   - First argument is the base URL to map
   - Key flags: `--limit`, `--search`, `--sitemap`, `--include-subdomains`

2. Run the command:
   ```bash
   npx firecrawl map $ARGUMENTS
   ```

3. Present the discovered URLs to the user

## Example Usage

```
/firecrawl:map https://docs.example.com
/firecrawl:map https://example.com --limit 50
/firecrawl:map https://docs.example.com --search "API reference"
/firecrawl:map https://example.com --sitemap only --json
```

## Key Flags

- `--limit <n>` - Maximum URLs to discover
- `--search <query>` - Filter/rank URLs by relevance
- `--sitemap <mode>` - `include`, `skip`, or `only`
- `--include-subdomains` - Include subdomain URLs
- `--json` - JSON output
- `-o <path>` - Save to file

For full flag reference, see `skills/firecrawl/references/map-reference.md`

## Notes

- Great for understanding site structure before crawling
- Costs 1 credit per call regardless of URLs found
- Requires FIRECRAWL_API_KEY or `firecrawl login`
