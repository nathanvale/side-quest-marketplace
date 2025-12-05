# Firecrawl Plugin

**Web scraping and data extraction via Firecrawl API** - Scrape web content, discover URLs, search the web, and extract structured data using LLM.

---

## CRITICAL RULES

**API Key Required:**
- **YOU MUST** set `FIRECRAWL_API_KEY` environment variable
- Get API key from: https://firecrawl.dev
- All commands fail without valid API key

**Token Efficiency:**
- Plugin uses CLI architecture (not MCP server) for minimal token overhead
- Content automatically truncated to save tokens (8K chars for scrape, 2K per search result)
- Map operations limited to 50 URLs by default
- Search results capped at 10 entries

**Rate Limiting:**
- Client automatically retries on 429 errors with exponential backoff
- Server errors (5xx) retried up to 2 times
- Network errors retried with increasing delays

---

## Overview

Firecrawl is a web scraping and search API that provides clean, structured content from any URL. This plugin wraps the Firecrawl v2 REST API with four slash commands designed for token-efficient usage in Claude Code.

**Architecture:** CLI-based tool (not MCP server) executed via `bun run` commands.

**Use cases:**
- Reading documentation from web pages
- Discovering site structure and URLs
- Searching the web with scraped content
- Extracting structured data using LLM prompts

---

## Directory Structure

```
firecrawl/
├── .claude-plugin/
│   └── plugin.json              # Plugin metadata
├── commands/                    # Slash commands (CLI wrappers)
│   ├── scrape.md               # /firecrawl:scrape
│   ├── map.md                  # /firecrawl:map
│   ├── search.md               # /firecrawl:search
│   └── extract.md              # /firecrawl:extract
├── hooks/
│   ├── hooks.json              # SessionStart hook
│   └── session-start.ts        # Load Firecrawl context
├── skills/
│   └── firecrawl/
│       └── SKILL.md            # Usage skill
├── src/                         # CLI implementation
│   ├── cli.ts                  # 254 lines - Main CLI tool
│   ├── client.ts               # 182 lines - REST API client
│   ├── formatters.ts           # 239 lines - Token-efficient output
│   ├── types.ts                # 414 lines - TypeScript types
│   ├── cli.test.ts             # CLI arg parsing tests
│   ├── client.test.ts          # API client tests
│   ├── formatters.test.ts      # Output formatting tests
│   └── index.test.ts           # Integration tests
├── package.json                # Dependencies (none, uses Bun native fetch)
└── tsconfig.json               # TypeScript configuration
```

---

## Commands

```bash
# Development
bun test --recursive       # Run all tests
bun run typecheck          # Type checking
bun run check              # Biome lint + format

# CLI Usage (requires FIRECRAWL_API_KEY)
cd plugins/firecrawl
bun run src/cli.ts scrape <url> [--format markdown|summary]
bun run src/cli.ts map <url> [--limit N]
bun run src/cli.ts search <query> [--limit N]
bun run src/cli.ts extract <url> --prompt "..." [--schema '{...}']

# Slash commands (recommended, used by Claude Code)
/firecrawl:scrape <url> [--format markdown|summary]
/firecrawl:map <url> [--limit N]
/firecrawl:search <query> [--limit N]
/firecrawl:extract <url> --prompt "..." [--schema '{...}']
```

---

## Key Files

| File | Purpose | Lines |
|------|---------|-------|
| `src/cli.ts` | Main CLI entry point with arg parsing | 254 |
| `src/client.ts` | REST API client with retry logic | 182 |
| `src/formatters.ts` | Token-efficient output formatting | 239 |
| `src/types.ts` | TypeScript interfaces for Firecrawl v2 API | 414 |
| `commands/scrape.md` | Scrape slash command | 35 |
| `commands/map.md` | Map slash command | 31 |
| `commands/search.md` | Search slash command | 39 |
| `commands/extract.md` | Extract slash command | 43 |

---

## Prerequisites

**Environment Variables:**
- `FIRECRAWL_API_KEY` (required) - Your Firecrawl API key

**Get API key:**
1. Visit https://firecrawl.dev
2. Sign up for an account
3. Generate an API key from dashboard
4. Set environment variable: `export FIRECRAWL_API_KEY=your_key_here`

**No external dependencies:** Plugin uses Bun's native `fetch` API.

---

## Tech Stack

- **Runtime:** Bun 1.3.3 (native fetch, TypeScript execution)
- **Language:** TypeScript 5.7.2 (strict mode: true)
- **HTTP Client:** Bun native fetch API (no axios, no node-fetch)
- **API Version:** Firecrawl v2 REST API
- **Linting:** Biome 2.3.7 (recommended rules)
- **Testing:** Bun test framework (4 test files)

---

## Usage Examples

### Scrape - Get Page Content

Fetch and convert a web page to clean markdown:

```bash
/firecrawl:scrape https://docs.example.com/api
/firecrawl:scrape https://example.com --format summary
```

**Options:**
- `--format markdown|summary` - Output format (default: markdown)

**Output:**
```markdown
# Example Page Title
Source: https://example.com

[Clean markdown content... truncated at 8000 chars]

Found 42 links
```

**Best for:**
- Reading documentation
- Fetching article content
- Getting page text for analysis

---

### Map - Discover URLs

Find all URLs on a website (useful for understanding site structure):

```bash
/firecrawl:map https://docs.example.com
/firecrawl:map https://example.com --limit 50
```

**Options:**
- `--limit N` - Maximum URLs to return (default: 100, max: 100,000)

**Output:**
```markdown
Found 127 URLs

- https://example.com/ - Home
- https://example.com/about - About Us
- https://example.com/docs - Documentation
... and 77 more
```

**Best for:**
- Understanding site structure
- Finding specific pages before scraping
- Discovering documentation sections

---

### Search - Web Search

Search the web and return results with optional content scraping:

```bash
/firecrawl:search typescript tutorials
/firecrawl:search "react hooks guide" --limit 10
```

**Options:**
- `--limit N` - Maximum results (default: 5, max: 100)

**Search operators:**
- `"exact phrase"` - Exact match
- `-term` - Exclude term
- `site:example.com` - Limit to domain
- `intitle:word` - Word in title

**Output:**
```markdown
## Web Results (10)

### Complete Guide to TypeScript
https://example.com/typescript-guide
A comprehensive guide covering TypeScript fundamentals...

[Clean markdown of page content... truncated at 2000 chars]

... and 7 more

## Images: 15 found
```

**Best for:**
- Finding information across the web
- Researching topics
- Finding documentation

---

### Extract - Structured Data

Extract specific data from pages using LLM prompts:

```bash
/firecrawl:extract https://example.com --prompt "Extract the main heading and description"
/firecrawl:extract https://store.com/product --prompt "Extract price and features" --schema '{"price": {"type": "number"}, "features": {"type": "array"}}'
```

**Options:**
- `--prompt "text"` (required) - What to extract
- `--schema '{...}'` (optional) - JSON Schema for structured output

**Output:**
```markdown
Status: completed

## Extracted Data
```json
{
  "heading": "Product Name",
  "description": "Product description text...",
  "price": 49.99,
  "features": ["Feature 1", "Feature 2"]
}
```

Sources: 1 pages
```

**Best for:**
- Extracting specific data points
- Getting structured information
- Pulling prices, names, dates, etc.

**Note:** Extract is async - CLI polls for completion (max 30 attempts, 2s interval).

---

## Token Efficiency

This plugin is optimized for minimal token consumption:

### Truncation Limits

| Operation | Max Size | Strategy |
|-----------|----------|----------|
| Scrape markdown | 8,000 chars | Truncate + "[truncated]" suffix |
| Search result content | 2,000 chars | Truncate per result |
| Map URLs | 50 URLs | Show first 50, count remaining |
| Search results | 10 results | Show first 10, count remaining |

### CLI Architecture Benefits

**Why CLI vs MCP Server?**
- MCP server tool definitions: ~14K tokens loaded every session
- CLI approach: ~1K tokens per command execution
- 93% token reduction for tool overhead

**Trade-off:** No structured tool parameters (uses raw CLI args)

---

## Code Conventions

**TypeScript:** Strict mode, tab indentation, functional style
**Error Handling:** Client returns `FirecrawlResult<T>` union type (success | error)
**Testing:** Bun test framework, mocked fetch API, 4 test files
**Formatting:** Token-efficient markdown output with truncation

---

## Architecture

### REST Client (`client.ts`)

```typescript
createFirecrawlClient(config?: FirecrawlConfig)
  → { scrape, map, search, extract, getExtractStatus }
```

**Features:**
- Retry logic with exponential backoff (default: 2 retries)
- Rate limiting with `Retry-After` header support
- Request timeout (default: 60s)
- Bearer token authentication
- Error responses with status codes

### CLI Tool (`cli.ts`)

```typescript
parseArgs(args: string[])
  → { command, positional, flags }
```

**Commands:**
- `scrape <url> [--format]` - Single page scrape
- `map <url> [--limit]` - URL discovery
- `search <query> [--limit]` - Web search
- `extract <url> --prompt [...] [--schema]` - Structured extraction

**Error handling:** Prints to stderr, exits with code 1 on failure

### Formatters (`formatters.ts`)

Token-efficient markdown formatters:

```typescript
formatScrapeResponse(response: ScrapeResponse): string
formatMapResponse(response: MapResponse): string
formatSearchResponse(response: SearchResponse): string
formatExtractResponse(response: ExtractStatusResponse): string
```

**Strategy:**
- Remove redundant metadata
- Truncate long content with clear indicators
- Summarize counts instead of full lists
- Prioritize actionable information

### Types (`types.ts`)

Complete TypeScript definitions for Firecrawl v2 API:
- `ScrapeRequest`, `ScrapeResponse`, `ScrapeData`
- `MapRequest`, `MapResponse`, `MapLink`
- `SearchRequest`, `SearchResponse`, `SearchData`
- `ExtractRequest`, `ExtractResponse`, `ExtractStatusResponse`
- `FirecrawlError`, `FirecrawlResult<T>` union type

---

## Testing

```bash
# Run all tests
bun test --recursive

# Run specific test file
bun test src/client.test.ts
bun test src/formatters.test.ts
```

**Test Coverage:**
- CLI arg parsing and command routing
- REST client with mocked fetch API
- Output formatting and truncation logic
- Error handling and retry logic

**Test Files:**
- `cli.test.ts` - Command parsing
- `client.test.ts` - API client behavior
- `formatters.test.ts` - Output formatting
- `index.test.ts` - Integration tests

---

## Troubleshooting

### API Key Not Set

```
Error: FIRECRAWL_API_KEY environment variable is required
```

**Solution:** Set the environment variable:
```bash
export FIRECRAWL_API_KEY=your_key_here
```

### Rate Limiting

```
Error: HTTP 429: Too Many Requests
```

**Solution:** Client automatically retries with exponential backoff. If persistent, wait longer or upgrade plan.

### Invalid URL

```
Error: URL required for scrape command
```

**Solution:** Ensure URL is well-formed and starts with `http://` or `https://`

### Extraction Timeout

```
Extraction timed out
```

**Solution:** Extraction job exceeded 60s (30 attempts × 2s). Try simpler prompt or fewer URLs.

### Site Blocking

```
Error: Site blocked scraping
```

**Solution:** Some sites block automated scraping. Try different URL or contact site owner.

### Empty Results

```
No data returned
```

**Solution:** Page may have loaded incorrectly. Check URL accessibility in browser.

---

## API Rate Limits & Pricing

**Firecrawl charges per operation:**
- **Scrape:** 1 credit per page
- **Map:** 1 credit per call
- **Search:** 1 credit per result
- **Extract:** Varies by complexity (typically 5-10 credits)

**Rate limits:**
- Free tier: 500 credits/month
- Hobby: 10,000 credits/month
- Growth: 100,000+ credits/month

**Check current pricing:** https://firecrawl.dev/pricing

---

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `FIRECRAWL_API_KEY` | Yes | — | Firecrawl API key from dashboard |

---

## Notes

- **CLI-based architecture** - Not an MCP server (token efficiency)
- **Bun native fetch** - No external HTTP client dependencies
- **Firecrawl v2 API** - Uses latest REST API version
- **Automatic retries** - Handles rate limiting and transient errors
- **Token truncation** - All responses optimized for minimal token usage
- **Extract is async** - Polls for job completion (max 60s)
- **Test suite** - 4 test files covering CLI, client, formatters
- **TypeScript strict mode** - Full type safety for all operations
- **Graceful error handling** - Clear error messages with actionable fixes

---

## Resources

- **Firecrawl API Docs:** https://docs.firecrawl.dev
- **Pricing:** https://firecrawl.dev/pricing
- **API Key:** https://firecrawl.dev/dashboard
- **Plugin Guide:** @../../PLUGIN_DEV_GUIDE.md
- **Troubleshooting:** @../../TROUBLESHOOTING.md
