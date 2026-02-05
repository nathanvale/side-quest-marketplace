# Firecrawl Plugin

**Web scraping, crawling, search, and AI-powered extraction via official Firecrawl CLI.**

---

## Prerequisites

1. **API key**: `export FIRECRAWL_API_KEY=fc-your-key` or `npx firecrawl login`
2. **CLI**: `npm install -g firecrawl-cli` (or use via `npx firecrawl`)
3. Get key from: https://firecrawl.dev

---

## Commands

| Command | Usage |
|---------|-------|
| `/firecrawl:scrape` | `<url> [--only-main-content] [--format markdown,links]` |
| `/firecrawl:search` | `<query> [--limit N] [--scrape] [--tbs qdr:d]` |
| `/firecrawl:map` | `<url> [--search "filter"] [--limit N]` |
| `/firecrawl:crawl` | `<url> --wait [--limit N] [--max-depth N]` |
| `/firecrawl:extract` | `<url> --prompt "..." [--schema '{...}']` |
| `/firecrawl:agent` | `"<prompt>" [--urls <urls>] [--wait]` |

---

## When to Use Firecrawl vs WebFetch vs WebSearch

| Need | Use |
|------|-----|
| Quick answer from a known URL | WebFetch (free, fast) |
| Find links on a topic | WebSearch (free, fast) |
| Full page as clean markdown | `/firecrawl:scrape` |
| JS-rendered or anti-bot pages | `/firecrawl:scrape --wait-for` |
| Crawl entire docs site | `/firecrawl:crawl` |
| Search + full page content | `/firecrawl:search --scrape` |
| Structured data extraction | `/firecrawl:extract` |
| Open-ended web research | `/firecrawl:agent` |

---

## Credit Costs

| Operation | Cost |
|-----------|------|
| Scrape | 1 credit/page |
| Map | 1 credit/call |
| Search | 1 credit/result |
| Crawl | 1 credit/page |
| Extract/Agent | 5-50 credits |

---

## Architecture Note

`src/client.ts`, `src/types.ts`, and `src/index.ts` are retained as a library
for `para-obsidian` which imports `createFirecrawlClient` and `FirecrawlResult`.
These will be removed in a follow-up migration (Phase B).
