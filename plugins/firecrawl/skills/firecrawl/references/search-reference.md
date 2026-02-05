# Search Reference

Search the web and optionally scrape result content.

## Usage

```bash
firecrawl search "<query>" [flags]
```

## Flags

| Flag | Description |
|------|-------------|
| `--limit <n>` | Max results (default: 5, max: 100) |
| `--sources <types>` | Comma-separated: web, images, news |
| `--categories <types>` | Filter: github, research, pdf |
| `--tbs <value>` | Time filter: `qdr:h` (hour), `qdr:d` (day), `qdr:w` (week), `qdr:m` (month), `qdr:y` (year) |
| `--location <loc>` | Geo-target (e.g., "Melbourne,Australia") |
| `--country <code>` | ISO country code (default: US) |
| `--timeout <ms>` | Request timeout (default: 60000) |
| `--scrape` | Also scrape each result page for full content |
| `--scrape-formats <fmts>` | Formats when scraping (default: markdown) |
| `--only-main-content` | Main content only when scraping (default: true) |
| `--output <path>` | Save to file |
| `--json` | JSON output |
| `--pretty` | Pretty-print JSON |

## Examples

```bash
# Basic search
firecrawl search "typescript error handling best practices"

# Research papers from past month
firecrawl search "transformer architecture" --categories research --tbs qdr:m

# Search + scrape results for full content
firecrawl search "react server components guide" --scrape --limit 3

# GitHub repos only
firecrawl search "MCP server template" --categories github --limit 10

# News from past week
firecrawl search "AI regulation" --sources news --tbs qdr:w

# Geo-targeted Australian results
firecrawl search "melbourne events" --country AU --location "Melbourne,Australia"
```

## Search Operators (in query string)

- `"exact phrase"` - exact match
- `-term` - exclude term
- `site:example.com` - limit to domain
- `intitle:word` - word in title
- `inurl:word` - word in URL

## Tips

- Use `--scrape` when you need full page content, not just snippets
- `--tbs qdr:d` is great for finding recent information
- Costs 1 credit per result
