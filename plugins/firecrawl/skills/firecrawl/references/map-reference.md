# Map Reference

Discover all URLs on a website without scraping content.

## Usage

```bash
firecrawl map <url> [flags]
```

## Flags

| Flag | Description |
|------|-------------|
| `--limit <n>` | Maximum URLs to discover |
| `--search <query>` | Filter/rank URLs by relevance to query |
| `--sitemap <mode>` | `include` (default), `skip`, or `only` |
| `--include-subdomains` | Include subdomain URLs |
| `--ignore-query-parameters` | Deduplicate URLs differing only by query params |
| `--timeout <seconds>` | Request timeout |
| `--json` | JSON output |
| `--output <path>` | Save to file |
| `--pretty` | Pretty-print JSON |

## Examples

```bash
# Discover all URLs on a site
firecrawl map https://docs.example.com

# Find documentation pages
firecrawl map https://docs.example.com --search "API reference" --limit 50

# Sitemap-only discovery (fast)
firecrawl map https://example.com --sitemap only

# Include subdomains
firecrawl map https://example.com --include-subdomains --limit 500

# Save URL list as JSON
firecrawl map https://example.com --json -o urls.json --pretty
```

## Tips

- Use `--search` to filter large sites down to relevant pages
- `--sitemap only` is fastest but misses unlisted pages
- Great for planning a crawl - map first, then crawl specific paths
- Costs 1 credit per call regardless of URLs found
