# Scrape Reference

Extract content from any webpage as clean markdown.

## Usage

```bash
firecrawl scrape <url> [flags]
firecrawl <url>              # shorthand
```

## Flags

| Flag | Short | Description |
|------|-------|-------------|
| `--format <formats>` | `-f` | Comma-separated: markdown (default), html, rawHtml, links, screenshot, json, images, summary |
| `--html` | `-H` | Shortcut for `--format html` |
| `--only-main-content` | - | Strip navs, footers, sidebars - get article body only |
| `--wait-for <ms>` | - | Wait for JS rendering before scrape (e.g., 3000 for SPAs) |
| `--screenshot` | - | Capture page screenshot |
| `--include-tags <tags>` | - | Only include specific HTML tags |
| `--exclude-tags <tags>` | - | Exclude specific HTML tags |
| `--output <path>` | `-o` | Save to file instead of stdout |
| `--json` | - | Force JSON output |
| `--pretty` | - | Pretty-print JSON |
| `--timing` | - | Show request timing info |

## Format Behaviour

- **Single format** (default): Returns raw content as text
- **Multiple formats** (`--format markdown,links`): Returns JSON with all requested data

## Examples

```bash
# Basic page scrape
firecrawl scrape https://docs.example.com/api

# Clean article content only
firecrawl scrape https://blog.example.com/post --only-main-content

# Wait for JS-rendered content
firecrawl scrape https://spa-app.com/dashboard --wait-for 5000

# Get markdown + links as JSON
firecrawl scrape https://example.com --format markdown,links --pretty

# Save screenshot
firecrawl scrape https://example.com --screenshot -o screenshot.json
```

## Tips

- Use `--only-main-content` for articles/docs to reduce noise
- Use `--wait-for` for SPAs and JS-heavy pages
- Costs 1 credit per page
