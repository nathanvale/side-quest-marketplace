# Scraper Toolkit

Production-proven Playwright web scraping patterns and best practices.

## Overview

This plugin provides comprehensive guidance for building robust web scrapers using Playwright. All patterns are battle-tested from production scraping projects.

## Features

- **Playwright best practices** - Selector-first approach, semantic locators
- **Robust extraction** - 4-tier fallback hierarchy for resilience
- **Text handling** - Proper use of `innerText` vs `textContent`
- **Error patterns** - Clear error messages and timeout handling
- **Clean separation** - Single-responsibility scraper methods

## Components

### Skills

**`playwright-scraper`** - Comprehensive skill with:
- Core principles (selector-first, text extraction, regex patterns)
- Fallback hierarchy implementation
- Error handling patterns
- Image selection best practices
- Clean separation of concerns
- Production checklist
- Anti-patterns to avoid

### Commands

**`/scraper-toolkit:scrape [url]`** - Interactive scraper builder:
- Guides you through scraper design
- Applies best practices automatically
- Tests selectors against real pages
- Builds incrementally with validation

## Usage

### Build a scraper interactively

```bash
/scraper-toolkit:scrape
```

Claude will:
1. Ask about your target website and data needs
2. Invoke the `playwright-scraper` skill
3. Guide you through implementation following best practices
4. Test each selector before moving on

### Scrape a specific URL

```bash
/scraper-toolkit:scrape https://example.com
```

Provide the URL upfront and Claude will build a scraper for that site.

## Key Principles

### 1. Selector-First Approach

Always prefer semantic locators:
```typescript
✅ page.getByRole('button', { name: 'Submit' })
❌ page.locator('.btn-primary')
```

### 2. Text Extraction

Use `innerText` for visible text, not `textContent`:
```typescript
✅ const text = await page.innerText("body");  // Visible only
❌ const text = await page.textContent("body"); // Includes hidden
```

### 3. Regex Patterns

Handle newlines in HTML:
```typescript
✅ /ADULT[\s\S]{0,10}(\$\d+\.\d{2})/  // Matches across newlines
❌ /ADULT[^$]*(\$\d+\.\d{2})/         // Fails on newlines
```

### 4. Clean Separation

Each scraper method has one responsibility:
```typescript
✅ scrapeMovies(), scrapeSession(), scrapePricing()
❌ scrapeSession() returning movie data
```

## Examples

See the skill documentation for complete implementation examples:
- Browser setup patterns
- Scraper client architecture
- CLI integration
- Debugging techniques

## Learn More

- Full skill documentation: `skills/playwright-scraper/SKILL.md`
- Production example: `plugins/the-cinema-bandit`
- Playwright docs: https://playwright.dev

## License

MIT
