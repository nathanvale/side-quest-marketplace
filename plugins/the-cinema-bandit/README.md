# The Cinema Bandit 🎬

Generate and send Classic Cinemas booking confirmation emails with automated pricing calculations.

## Features

- **CLI Scraper Tool** - Fast, selector-first web scraping with Playwright
- **Automated Pricing Calculator** - Uses Classic Cinemas guest pricing formula
- **Email Template Generation** - Matches Classic Cinemas email design exactly
- **Gmail Integration** - Send emails via Gmail OAuth 2.0 (loopback flow)
- **Interactive Scripts** - Prompt-based ticket creation workflow
- **TypeScript** - Fully typed with JSDoc documentation

## Pricing Structure

Cinema Bandit supports **two pricing modes**:

### 1. Live Scraping (Recommended) ✨

Scrapes current prices directly from Classic Cinemas website:
- **Always accurate** - Updates automatically when cinema changes prices
- **Resilient** - Multiple fallback selectors if website changes
- **Transparent** - Shows which prices were found and when

Used by: `/the-cinema-bandit:ticket` slash command

### 2. Formula-Based (Fast)

Uses hardcoded guest pricing for quick calculations:
- **Fast** - No network requests needed
- **Offline** - Works without internet
- **Manual updates required** - Edit `GUEST_PRICES` in `src/calculator.ts`

**Current formula values (November 2024):**
- Adult tickets: $27.00 each
- Concession (Child) tickets: $21.00 each
- Booking fee: $1.95 per ticket

Used by: Scripts (`test-pricing.ts`, `generate-ticket.ts`, etc.)

## Quick Start

### CLI Tool (Recommended)

```bash
# Get today's movies
bun run src/cli.ts movies

# Get session details (requires full ticket URL from movies output)
bun run src/cli.ts session --session-id "/tickets?c=0000000002&s=116141"

# Get current pricing
bun run src/cli.ts pricing --session-id "/tickets?c=0000000002&s=116141"

# Get full movie details (lazy load - requires movie detail page URL)
bun run src/cli.ts movie --movie-url "/movies/wicked-for-good"

# Show help
bun run src/cli.ts --help
```

### Scripts

#### 1. Test Pricing Calculator

```bash
bun run scripts/test-pricing.ts
```

Shows pricing for various ticket combinations.

#### 2. Generate Email HTML

```bash
bun run scripts/generate-ticket.ts
```

Generates email HTML with hardcoded test data (2 adults).

#### 3. Send Test Email

```bash
bun run scripts/send-ticket.ts
```

Sends a test email to `hi@nathanvale.com` with 2 adult tickets.

#### 4. Interactive Email Generator

```bash
bun run scripts/create-ticket.ts
```

Prompts for ticket counts and booking details, generates HTML output.

#### 5. Interactive Email Sender

```bash
bun run scripts/send-ticket-interactive.ts
```

Full workflow: prompts for all details, calculates pricing, sends email via Gmail.

## Project Structure

```
the-cinema-bandit/
├── src/                        # Library source code (importable)
│   ├── cli.ts                  # CLI entry point (Playwright-based scraper)
│   ├── scraper-client.ts       # Playwright scraper with selector-first hierarchy
│   ├── formatters.ts           # JSON response formatters for CLI
│   ├── utils/
│   │   └── args.ts            # CLI argument parsing
│   ├── calculator.ts           # Formula-based pricing (fast, offline)
│   ├── calculator.test.ts      # Pricing tests
│   ├── price-scraper.ts        # Live pricing scraper with fallback logic
│   ├── price-scraper.test.ts   # Fallback logic tests
│   ├── selectors.ts            # Selector configs (pricing, sessions)
│   ├── template.ts             # Email HTML generation
│   ├── gmail/
│   │   ├── auth.ts            # OAuth 2.0 loopback flow
│   │   ├── send.ts            # Gmail API email sending
│   │   ├── credentials.ts      # Gmail credential loading
│   │   ├── index.ts           # Gmail exports
│   │   └── types.ts           # Gmail types
│   ├── logger.ts              # Structured logging (LogTape + subsystem loggers)
│   ├── scraper.ts             # Scraper types (movies, sessions)
│   ├── scraper-client.ts      # Playwright scraper client
│   └── index.ts               # Public API exports
├── scripts/                    # Executable scripts (runnable)
│   ├── test-pricing.ts        # Test pricing calculations
│   ├── generate-ticket.ts     # Generate email HTML (test)
│   ├── send-ticket.ts         # Send test email
│   ├── create-ticket.ts       # Interactive HTML generator
│   └── send-ticket-interactive.ts  # Interactive email sender
├── commands/                   # Claude Code slash commands
│   └── ticket.md              # /the-cinema-bandit:ticket (uses CLI scraper)
├── classic-cinemas-email-template.html  # Email template (production HTML)
├── docs/                       # Documentation
└── examples/                   # Example usage
```

## Unified Scraping Architecture

### Fallback Hierarchy

All scraping operations use a **unified 4-tier fallback strategy** to ensure resilience:

1. **Primary CSS Selector** - Most reliable, semantic selector
2. **Fallback Selectors** - Alternative selectors if website structure changes
3. **Regex Text Pattern** - Extract from snapshot text when selectors fail
4. **Manual Input** - Ask user as ultimate fallback

### Selector Configurations

All selectors are centralized in `src/selectors.ts`. Each selector implements a 4-tier fallback hierarchy:

1. **Primary CSS selector** - Preferred, fastest method
2. **Fallback CSS selectors** - Alternative selectors if primary fails
3. **Text pattern matching** - Regex fallback for snapshot text
4. **Manual input** - Ultimate fallback if automation fails

**Active Selector Groups:**
- **PRICING_SELECTORS** - Adult price, child price, booking fee, total
- **SESSION_SELECTORS** - Screen number, date/time, session ID, duration, seats

**Removed Selectors** (no longer needed by Playwright-based CLI):
- `MOVIE_SELECTORS` - Movie listing (handled directly by Playwright's CSS selectors)
- `PAGE_SELECTORS` - Navigation/loading/errors (not needed for automation)

Each selector follows the `SelectorConfig` interface:
```typescript
interface SelectorConfig {
  primary: string;           // Main selector to try first
  fallbacks?: string[];      // Alternative selectors (2-4 options)
  textPattern?: RegExp;      // Regex for text extraction fallback
  description: string;       // What this selector finds
}
```

### Core Helper Function

**`findWithFallback(snapshot: string, config: SelectorConfig): string | null`**

Implements tier 3 fallback (text pattern matching) when CSS selectors fail:

```typescript
import { findWithFallback } from "./src/price-scraper";
import { PRICING_SELECTORS, SESSION_SELECTORS } from "./src/selectors";

// Take a snapshot of the page
const snapshot = await page.textContent("body");

// Use regex fallback - tries textPattern automatically
const adultPrice = findWithFallback(snapshot, PRICING_SELECTORS.adultPrice);
const screenNum = findWithFallback(snapshot, SESSION_SELECTORS.screenNumber);

// Returns matched text or null (if pattern doesn't match)
```

**Benefits:**
- Centralized configuration - all selectors in one place
- Resilient to website changes - multiple fallbacks per field
- Self-documenting - clear descriptions
- Debuggable - tracks which tier worked (`selectorsUsed` in CLI output)
- Reusable - same selectors used by CLI, price scraper, and session details

## CLI Scraper Tool

The Cinema Bandit CLI provides a fast, standalone scraper using Playwright with a selector-first architecture.

### Why CLI Instead of Chrome DevTools MCP?

1. **Performance** - Tries fast CSS selectors (~50ms) before slow snapshots (~500ms)
2. **Standalone** - No dependency on Chrome DevTools being open
3. **Reusable** - Same tool works for testing, scripts, and slash commands
4. **Debuggable** - JSON responses include which selectors worked (`selectorsUsed` field)
5. **Simple Integration** - Slash commands just parse JSON instead of orchestrating browser automation

### Architecture: Selector-First Fallback Hierarchy

```
┌─────────────────────────────────────────┐
│ TIER 1: Primary CSS Selector (~50ms)   │ ← Try first (fastest)
├─────────────────────────────────────────┤
│ TIER 2: Fallback CSS Selectors (~50ms) │ ← If primary fails
├─────────────────────────────────────────┤
│ TIER 3: Text Pattern Matching (~500ms) │ ← If all CSS fails (slow but reliable)
├─────────────────────────────────────────┤
│ TIER 4: Return null                     │ ← Manual input required
└─────────────────────────────────────────┘
```

**Core Implementation:**

```typescript
async function scrapeWithFallback(page: Page, config: SelectorConfig): Promise<ScrapeResult> {
  // TIER 1: Try primary CSS selector
  try {
    const element = await page.locator(config.primary).first();
    const value = await element.textContent({ timeout: 1000 });
    if (value?.trim()) {
      return { value: value.trim(), selectorUsed: "primary" };
    }
  } catch {}

  // TIER 2: Try fallback CSS selectors
  if (config.fallbacks) {
    for (let i = 0; i < config.fallbacks.length; i++) {
      const fallbackSelector = config.fallbacks[i];
      try {
        const element = await page.locator(fallbackSelector).first();
        const value = await element.textContent({ timeout: 1000 });
        if (value?.trim()) {
          return { value: value.trim(), selectorUsed: `fallback[${i}]` };
        }
      } catch {}
    }
  }

  // TIER 3: Text pattern fallback (requires full page text)
  if (config.textPattern) {
    const pageText = await page.textContent("body");
    const value = findWithFallback(pageText, config);
    if (value) {
      return { value, selectorUsed: "textPattern" };
    }
  }

  // TIER 4: All automation failed
  return { value: null, selectorUsed: "none" };
}
```

### Commands

#### `movies` - Scrape Today's Movies

```bash
bun run src/cli.ts movies
```

**JSON Response:**

```json
{
  "movies": [
    {
      "title": "Wicked: For Good",
      "rating": "PG",
      "thumbnail": "https://movingstory-prod.imgix.net/movies/thumbnails/wicked-for-good.jpg?w=450&h=193&auto=compress,format&fit=crop",
      "movieUrl": "/movies/wicked-for-good",
      "sessionTimes": [
        {
          "time": "10:15 am",
          "sessionId": "116141",
          "ticketUrl": "/tickets?c=0000000002&s=116141"
        },
        {
          "time": "11:50 am",
          "sessionId": "116120",
          "ticketUrl": "/tickets?c=0000000002&s=116120"
        }
      ]
    }
  ],
  "selectorsUsed": {
    "movieContainers": "div.Markup.Movie"
  }
}
```

**Implementation Notes:**
- Finds movies by `.Markup.Movie` container elements
- Extracts movie URL from `.Title a` or `a.Image` links
- Gets thumbnail from `img` element within container
- Extracts rating from `.Byline` span (e.g., "PG", "M", "MA15+")
- Groups session times by container (all sessions for one movie)
- Stores full `ticketUrl` (needed for session/pricing commands)
- Cleans time text (removes "NFT", "JIFF", "Rooftop" labels)

#### `session` - Get Session Details

```bash
# Requires full ticket URL from movies output
bun run src/cli.ts session --session-id "/tickets?c=0000000002&s=116141"

# Also accepts just session ID (builds URL automatically)
bun run src/cli.ts session --session-id 116141
```

**JSON Response:**

```json
{
  "screenNumber": "8",
  "dateTime": "30 Nov 2025, 11:00am",
  "selectorsUsed": {
    "screenNumber": "textPattern",
    "dateTime": "textPattern"
  }
}
```

**Note:** `screenNumber` returns just the number (e.g., "8") - add "Screen " prefix when displaying.

#### `pricing` - Get Current Pricing

```bash
# Requires full ticket URL from movies output
bun run src/cli.ts pricing --session-id "/tickets?c=0000000002&s=116141"
```

**JSON Response:**

```json
{
  "adultPrice": "17.00",
  "childPrice": "17.00",
  "bookingFee": "1.95",
  "selectorsUsed": {
    "adultPrice": "textPattern",
    "childPrice": "textPattern",
    "bookingFee": "textPattern"
  }
}
```

**Notes:**
- All prices in dollars (no $ symbol)
- Booking fee is $1.95 flat per transaction (CLI clicks "Add Ticket" to reveal it)
- Prices are current as of the scrape time

#### `movie` - Get Full Movie Details (Lazy Load)

```bash
# Accepts movie URL, relative URL, or slug
bun run src/cli.ts movie --movie-url "/movies/wicked-for-good"
bun run src/cli.ts movie --movie-url "https://classiccinemas.com.au/movies/wicked-for-good"
bun run src/cli.ts movie --movie-url "wicked-for-good"
```

**JSON Response:**

```json
{
  "title": "You will be changed",
  "description": "And now whatever way our stories end, I know you have rewritten mine by being my friend …\n\nElphaba (Cynthia Erivo), now demonised as The Wicked Witch of the West...",
  "trailerUrl": "https://www.youtube.com.au/watch?v=3bcvR2l9BNU",
  "rating": "PG",
  "duration": "137 min",
  "country": "USA",
  "cast": "Cynthia Erivo, Ariana Grande, Jonathan Bailey, Ethan Slater, Bowen Yang, Marissa Bode, Michelle Yeoh, Jeff Goldblum",
  "director": "Jon M. Chu",
  "eventLinks": [
    {
      "name": "BYO Baby at Classic",
      "url": "/events/byo-baby-at-classic"
    },
    {
      "name": "Open Caption Sessions",
      "url": "/events/open-caption-sessions"
    },
    {
      "name": "Classic Rooftop",
      "url": "/events/classic-rooftop"
    }
  ],
  "selectorsUsed": {
    "title": "h2-in-description",
    "description": "wysiwyg-description",
    "trailerUrl": "youtube-link",
    "rating": "metadata-wysiwyg",
    "duration": "metadata-wysiwyg",
    "country": "metadata-wysiwyg",
    "cast": "metadata-wysiwyg",
    "director": "metadata-wysiwyg",
    "eventLinks": "movie-event-links"
  }
}
```

**Error Response (page not found):**

```json
{
  "title": "",
  "description": "",
  "trailerUrl": null,
  "rating": null,
  "duration": null,
  "country": null,
  "cast": null,
  "director": null,
  "eventLinks": [],
  "selectorsUsed": {
    "error": "forLoadState: Timeout 30000ms exceeded."
  }
}
```

**Notes:**
- Lazy-loading pattern - only visits movie detail page when needed
- Requires valid movie detail page URL
- Classic Cinemas may not have movie detail pages accessible via `/movies/slug` URLs
- Returns error info in `selectorsUsed.error` if page fails to load
- Extracts comprehensive metadata: title, description, trailer, rating, duration, country, cast, director, and associated events

### Performance Characteristics

| Command | Avg Time | Selectors Used | Notes |
|---------|----------|----------------|-------|
| `movies` | ~3s | CSS (data-attributes) | Fast - uses CSS selectors only |
| `session` | ~2.5s | Text pattern | Slower - requires full page text |
| `pricing` | ~3.5s | Text pattern + interaction | Clicks "Add Ticket" to reveal fee |
| `movie` | ~3s | Regex + CSS (if page loads) | Lazy-load - full metadata extraction |

**Optimization Opportunities:**
- Session date/time could be faster with correct CSS selector
- Pricing could use CSS selectors if we find the right ones

### Error Handling

The CLI exits with proper error codes:

```typescript
try {
  // scraping logic
} catch (error) {
  console.error(`Scraping error: ${error.message}`);
  process.exit(1);
}
```

**Common Errors:**
- Missing `--session-id` flag → Exits with error message
- Invalid session ID → Returns null values in JSON
- Network errors → Exits with error message

### Integration with Slash Command

The `/the-cinema-bandit:ticket` slash command uses all three CLI commands:

1. **Step 1:** Run `movies` → Parse JSON → Present to user
2. **Step 3:** Run `session --session-id [ticketUrl]` → Extract screen number
3. **Step 5:** Run `pricing --session-id [ticketUrl]` → Calculate total

**Benefits:**
- Slash command just parses JSON (no browser automation)
- CLI can be tested independently
- Same tool works for scripts and slash commands

## API Reference

### `calculatePricing(counts: TicketCounts): PricingBreakdown`

Calculates complete pricing breakdown for a booking.

**Input:**
```typescript
interface TicketCounts {
  adults: number;
  children: number;
}
```

**Output:**
```typescript
interface PricingBreakdown {
  ticketLines: TicketLine[];        // For email display
  invoiceLines: InvoiceLine[];      // Invoice with prices
  bookingFee: string;               // e.g., "$3.90"
  totalAmount: string;              // e.g., "$57.90"
  ticketSubtotal: number;           // Raw number for calculations
  bookingFeeAmount: number;
  totalAmountNumber: number;
}
```

**Example:**
```typescript
import { calculatePricing } from "./src/calculator.ts";

const pricing = calculatePricing({ adults: 2, children: 1 });
// {
//   ticketLines: [
//     { type: "Adult", quantity: 2 },
//     { type: "Concession", quantity: 1 }
//   ],
//   invoiceLines: [
//     { description: "Adult x 2", price: "$54.00" },
//     { description: "Concession x 1", price: "$21.00" }
//   ],
//   bookingFee: "$5.85",
//   totalAmount: "$80.85",
//   ticketSubtotal: 75.00,
//   bookingFeeAmount: 5.85,
//   totalAmountNumber: 80.85
// }
```

### `generateTicketHtml(data: TicketData): string`

Generates complete HTML email from ticket data.

**Input:**
```typescript
interface TicketData {
  customerName: string;           // First name only
  movieTitle: string;
  moviePoster: string;            // URL
  sessionDateTime: string;        // e.g., "Fri 29 Nov, 08:15PM"
  screenNumber: string;           // e.g., "Screen 3"
  seats: string;                  // e.g., "H12, H13"
  tickets: TicketLine[];          // From calculator
  bookingNumber?: string;         // e.g., "CC789012"
  invoiceLines?: InvoiceLine[];   // From calculator
  bookingFee?: string;            // From calculator
  totalAmount?: string;           // From calculator
  webViewUrl?: string;
  barcodeUrl?: string;            // Uses default if omitted
}
```

**Example:**
```typescript
import { generateTicketHtml } from "./src/template.ts";
import { calculatePricing } from "./src/calculator.ts";

const pricing = calculatePricing({ adults: 2, children: 0 });

const html = generateTicketHtml({
  customerName: "Nathan",
  movieTitle: "JIFF: Bad Shabbos",
  moviePoster: "https://example.com/poster.jpg",
  sessionDateTime: "Fri 29 Nov, 08:15PM",
  screenNumber: "Screen 3",
  seats: "H12, H13",
  tickets: pricing.ticketLines,
  invoiceLines: pricing.invoiceLines,
  bookingFee: pricing.bookingFee,
  totalAmount: pricing.totalAmount,
  bookingNumber: "CC789012",
});
```

### `sendTicketEmail(to: string, movieTitle: string, html: string): Promise<string>`

Sends email via Gmail using OAuth 2.0.

**Example:**
```typescript
import { sendTicketEmail } from "./src/gmail/send.ts";

const messageId = await sendTicketEmail(
  "user@example.com",
  "JIFF: Bad Shabbos",
  html
);
```

## Gmail OAuth Setup

1. **Credentials:** Place `credentials.json` in project root
2. **First run:** Opens browser for OAuth consent
3. **Token storage:** Saves to `token.json` for future use
4. **Loopback flow:** Uses localhost callback (no external server needed)

## Testing

```bash
# Run all tests
bun test

# Run specific test
bun test src/calculator.test.ts
```

## Pricing Examples

| Tickets | Ticket Total | Booking Fee | Total |
|---------|--------------|-------------|-------|
| 1 Adult | $27.00 | $1.95 | $28.95 |
| 2 Adults | $54.00 | $3.90 | $57.90 |
| 1 Adult + 1 Child | $48.00 | $3.90 | $51.90 |
| 2 Adults + 1 Child | $75.00 | $5.85 | $80.85 |
| 2 Adults + 2 Children | $96.00 | $7.80 | $103.80 |

## Notes

- **Guest pricing only** - Does not calculate member discounts
- **Pricing accurate as of November 2024** - Update `GUEST_PRICES` in `calculator.ts` if Classic Cinemas changes rates
- **Email template** - Exact match to Classic Cinemas production emails
- **Barcode** - Uses Google proxy URL by default (can be overridden)

## Development

```bash
# Install dependencies
bun install

# Run tests
bun test

# Type check
bun typecheck

# Lint and format
bun run check
```

## License

MIT
