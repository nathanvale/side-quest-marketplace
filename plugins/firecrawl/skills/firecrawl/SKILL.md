---
name: firecrawl
description: Web scraping, site crawling, search, structured data extraction, and AI-powered research with Firecrawl CLI. Use when you need full page content as markdown, JS-rendered pages, anti-bot bypass, crawling entire documentation sites, extracting structured data with schemas, or deep web research. Prefer WebFetch for quick questions about a known URL. Prefer WebSearch for finding links without full content.
---

# Firecrawl

## When to Use What

| Need | Tool | Why |
|------|------|-----|
| Quick answer from a known URL | **WebFetch** | Free, fast, no API key needed |
| Find links/pages on a topic | **WebSearch** | Free, fast, returns snippets |
| Full page content as clean markdown | **Firecrawl scrape** | Handles JS rendering, anti-bot, better extraction |
| Scrape JS-heavy SPAs or paywalled sites | **Firecrawl scrape** | `--wait-for`, proxy support |
| Discover all URLs on a site | **Firecrawl map** | Sitemap + link discovery |
| Crawl entire docs/blog site | **Firecrawl crawl** | Recursive, depth control, path filtering |
| Search + get full page content | **Firecrawl search** | `--scrape` flag fetches each result |
| Extract structured data with schema | **Firecrawl extract** | LLM-powered, typed JSON output |
| Open-ended web research | **Firecrawl agent** | AI browses autonomously, multi-step reasoning |

## Commands

| Command | Usage |
|---------|-------|
| `/firecrawl:scrape` | `<url> [--only-main-content] [--format markdown,links]` |
| `/firecrawl:search` | `<query> [--limit N] [--scrape] [--tbs qdr:d]` |
| `/firecrawl:map` | `<url> [--search "filter"] [--limit N]` |
| `/firecrawl:crawl` | `<url> --wait [--limit N] [--max-depth N] [--include-paths "/api/*"]` |
| `/firecrawl:extract` | `<url> --prompt "..." [--schema '{...}']` |
| `/firecrawl:agent` | `"<prompt>" [--urls <urls>] [--wait] [--model spark-1-pro]` |

## Prerequisites

1. **API key**: `export FIRECRAWL_API_KEY=fc-your-key` or `npx firecrawl login`
2. **CLI**: `npm install -g firecrawl-cli` (or use via `npx firecrawl`)
3. Get key from: https://firecrawl.dev

## Credit Costs

| Operation | Cost |
|-----------|------|
| Scrape | 1 credit/page |
| Map | 1 credit/call |
| Search | 1 credit/result |
| Crawl | 1 credit/page crawled |
| Extract/Agent | Varies (typically 5-50 credits) |

Check https://firecrawl.dev/pricing for current rates.

## Detailed References

For full flags and examples per command, see:
- `references/scrape-reference.md`
- `references/search-reference.md`
- `references/map-reference.md`
- `references/crawl-reference.md`
- `references/extract-reference.md`
- `references/agent-reference.md`
