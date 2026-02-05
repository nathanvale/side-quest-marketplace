---
description: Scrape content from a URL as clean markdown
argument-hint: <url> [--only-main-content] [--format markdown,links]
allowed-tools: Bash
---

# Firecrawl Scrape

Scrape content from: `$ARGUMENTS`

## Instructions

1. Parse the arguments:
   - First argument is the URL to scrape
   - Key flags: `--only-main-content`, `--format`, `--wait-for`, `--screenshot`

2. Run the command:
   ```bash
   npx firecrawl scrape $ARGUMENTS
   ```

3. Present the results to the user in a clean format

## Example Usage

```
/firecrawl:scrape https://docs.example.com/api
/firecrawl:scrape https://example.com --only-main-content
/firecrawl:scrape https://spa-app.com --wait-for 5000
/firecrawl:scrape https://example.com --format markdown,links --pretty
```

## Key Flags

- `--only-main-content` - Strip navs, footers, sidebars
- `--format <formats>` - markdown (default), html, links, screenshot, json, images, summary
- `--wait-for <ms>` - Wait for JS rendering before scrape
- `--screenshot` - Capture page screenshot
- `-o <path>` - Save to file

For full flag reference, see `skills/firecrawl/references/scrape-reference.md`

## Notes

- Returns clean markdown by default
- Costs 1 credit per page
- Requires FIRECRAWL_API_KEY or `firecrawl login`
