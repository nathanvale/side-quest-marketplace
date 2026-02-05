# Crawl Reference

Follow links recursively to gather content from an entire site.

## Usage

```bash
firecrawl crawl <url> [flags]
firecrawl crawl <job-id>         # check status of existing job
```

## Flags

| Flag | Description |
|------|-------------|
| `--wait` | Block until crawl completes (recommended) |
| `--progress` | Show progress indicator while waiting |
| `--poll-interval <sec>` | Status check frequency (default: 5) |
| `--timeout <sec>` | Maximum wait time |
| `--limit <n>` | Maximum pages to crawl |
| `--max-depth <n>` | Maximum link depth from start URL |
| `--include-paths <paths>` | Comma-separated path patterns to include |
| `--exclude-paths <paths>` | Comma-separated path patterns to exclude |
| `--sitemap <mode>` | `include`, `skip`, or `only` |
| `--allow-subdomains` | Crawl subdomain pages too |
| `--allow-external-links` | Follow links to other domains |
| `--crawl-entire-domain` | Crawl full domain (not just path subtree) |
| `--ignore-query-parameters` | Treat URLs with different params as same |
| `--delay <ms>` | Delay between requests (be polite) |
| `--max-concurrency <n>` | Max parallel requests |
| `--output <path>` | Save to file |
| `--pretty` | Pretty-print JSON |

## Examples

```bash
# Crawl docs site, wait for results
firecrawl crawl https://docs.example.com --wait --progress --limit 100

# Crawl only API docs section
firecrawl crawl https://docs.example.com --wait --include-paths "/api/*" --limit 50

# Shallow crawl (2 levels deep)
firecrawl crawl https://example.com --wait --max-depth 2 --limit 200

# Polite crawl with delays
firecrawl crawl https://example.com --wait --delay 2000 --max-concurrency 2

# Save results to file
firecrawl crawl https://docs.example.com --wait -o docs-crawl.json --pretty

# Check status of running crawl
firecrawl crawl abc123-job-id
```

## Tips

- Always use `--wait` unless you want to poll manually
- Use `--include-paths` + `--exclude-paths` to focus on relevant sections
- `--limit` prevents runaway crawls on large sites
- Crawl is async - can take minutes for large sites
- Costs 1 credit per page crawled
