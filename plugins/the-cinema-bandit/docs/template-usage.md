# Ticket Template Generator

The Cinema Bandit includes a template generator for creating HTML email tickets using the Classic Cinemas visual style.

## Quick Start

```typescript
import { generateTicketHtml, type TicketData } from "the-cinema-bandit";

const ticketData: TicketData = {
  customerName: "Nathan Vale",
  movieTitle: "WICKED: FOR GOOD",
  moviePoster: "https://example.com/poster.jpg",
  sessionDateTime: "29 Nov 2025, 4:15pm-6:52pm",
  screenNumber: "Screen 1",
  seats: "F9, F10",
  barcodeUrl: "https://example.com/barcode.png" // optional
};

const html = generateTicketHtml(ticketData);
```

## Template Placeholders

The HTML template uses the following placeholders:

| Placeholder | Description | Example |
|-------------|-------------|---------|
| `{{CUSTOMER_NAME}}` | Customer's full name | "Nathan Vale" |
| `{{MOVIE_TITLE}}` | Movie title | "WICKED: FOR GOOD" |
| `{{MOVIE_POSTER}}` | URL to movie poster image | "https://..." |
| `{{SESSION_DATETIME}}` | Session date and time range | "29 Nov 2025, 4:15pm-6:52pm" |
| `{{SCREEN_NUMBER}}` | Screen/cinema number | "Screen 1" |
| `{{SEATS}}` | Comma-separated seat numbers | "F9, F10" |
| `{{BARCODE}}` | Barcode image URL (decorative) | "https://..." or SVG data URI |

## Security

All text fields (customer name, movie title, etc.) are HTML-escaped to prevent XSS injection:

```typescript
// Input with HTML
const data = {
  customerName: "Nathan <script>alert('xss')</script>",
  // ... other fields
};

// Output is safe
// "Nathan &lt;script&gt;alert(&#39;xss&#39;)&lt;/script&gt;"
```

URL fields (`moviePoster`, `barcodeUrl`) are NOT escaped - ensure these come from trusted sources only.

## Default Barcode

If `barcodeUrl` is omitted, a decorative SVG barcode will be used automatically:

```typescript
const ticketData: TicketData = {
  customerName: "Nathan Vale",
  // ... other required fields
  // barcodeUrl not provided - default will be used
};
```

## Custom Templates

The template file is located at:
```
plugins/the-cinema-bandit/classic-cinemas-email-template.html
```

To customize:
1. Edit the HTML/CSS in the template file
2. Use `{{PLACEHOLDER}}` syntax for dynamic content
3. Test with the example script: `bun run examples/generate-ticket-example.ts`

## Example Usage

See `examples/generate-ticket-example.ts` for a complete working example.

Run it with:
```bash
bun run examples/generate-ticket-example.ts
```

This will generate `examples/sample-ticket.html` which you can open in a browser to preview.
