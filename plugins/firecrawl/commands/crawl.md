---
description: Crawl an entire website and gather content from all pages
argument-hint: <url> [--wait] [--limit N] [--max-depth N]
allowed-tools: Bash
---

# Firecrawl Crawl

Crawl the website: `$ARGUMENTS`

## Instructions

1. Parse the arguments:
   - First argument is the URL to crawl
   - Always add `--wait` if not already present (blocks until complete)
   - Key flags: `--limit`, `--max-depth`, `--include-paths`, `--exclude-paths`, `--progress`

2. Run the command:
   ```bash
   npx firecrawl crawl $ARGUMENTS
   ```

3. Present the crawled content to the user

## Example Usage

```
/firecrawl:crawl https://docs.example.com --wait --progress --limit 50
/firecrawl:crawl https://example.com --wait --max-depth 2 --include-paths "/api/*"
```

## Key Flags

- `--wait` - Block until complete (always recommended)
- `--progress` - Show progress while waiting
- `--limit <n>` - Max pages to crawl
- `--max-depth <n>` - Max link depth
- `--include-paths <paths>` - Only crawl matching paths
- `--exclude-paths <paths>` - Skip matching paths
- `-o <path>` - Save to file

For full flag reference, see `skills/firecrawl/references/crawl-reference.md`

## Notes

- Crawls can take minutes for large sites - always use `--wait`
- Use `--limit` to prevent runaway crawls
- Costs 1 credit per page crawled
- Requires FIRECRAWL_API_KEY or `firecrawl login`
