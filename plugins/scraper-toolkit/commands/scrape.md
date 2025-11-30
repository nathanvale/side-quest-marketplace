# Scrape Web Content

Build a Playwright web scraper using production-proven best practices.

## Usage

```bash
/scraper-toolkit:scrape [url]
```

## Arguments

- `url` - Target website URL to scrape (optional)

## Examples

```bash
# Start interactive scraper design
/scraper-toolkit:scrape

# Scrape a specific URL
/scraper-toolkit:scrape https://example.com
```

---

You are now executing the scraper-toolkit scrape command.

Your task is to help the user build a robust web scraper using Playwright best practices learned from production scraping.

## Approach

1. **Understand the target**:
   - What website/page needs to be scraped?
   - What data needs to be extracted?
   - What's the scraping frequency/volume?

2. **Use the playwright-scraper skill**:
   - Invoke the skill to get best practices guidance
   - Follow selector-first patterns
   - Implement robust error handling

3. **Build incrementally**:
   - Start with basic page navigation
   - Add selectors one field at a time
   - Test each selector before moving on

4. **Validate and refine**:
   - Test against actual page HTML
   - Add fallback selectors
   - Handle edge cases

## Important

- ALWAYS use the `playwright-scraper` skill for implementation guidance
- Follow the patterns from the skill's best practices
- Test selectors against real pages before finalizing code
