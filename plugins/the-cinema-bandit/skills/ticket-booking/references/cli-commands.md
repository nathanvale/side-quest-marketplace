# CLI Commands Reference

All commands use the Cinema Bandit CLI located in the plugin root.

## Available Commands

### Get Today's Movies

```bash
cd $CLAUDE_PLUGIN_ROOT && bun run src/cli.ts movies
```

**Returns:** JSON with movies array containing:
- `title` - Movie title
- `rating` - Age rating (PG, M, MA15+, etc.)
- `thumbnail` - Movie poster URL
- `movieUrl` - Link to movie details
- `slug` - URL-friendly movie identifier
- `sessionTimes[]` - Array of session times with `sessionId` and `time`

### Get Session Details

```bash
cd $CLAUDE_PLUGIN_ROOT && bun run src/cli.ts session --session-id [sessionId]
```

**Returns:** JSON with:
- `screenNumber` - Screen number (e.g., "Screen 7")
- `dateTime` - Session date and time (e.g., "30 Nov 2025, 8:45pm-11:03pm")

### Get Current Pricing

```bash
cd $CLAUDE_PLUGIN_ROOT && bun run src/cli.ts pricing --session-id [sessionId]
```

**Returns:** JSON with:
- `adultPrice` - Adult ticket price (e.g., "$26.50")
- `childPrice` - Child/concession price (e.g., "$17.00")
- `bookingFee` - Booking fee per ticket (e.g., "$0.00")

**Note:** Booking fee shown is per ticket, not total. Website shows $0.00 until tickets are added.

### Get Full Movie Metadata

```bash
cd $CLAUDE_PLUGIN_ROOT && bun run src/cli.ts movie --movie-url [slug]
```

**Returns:** JSON with:
- `title`, `description`, `trailerUrl`
- `rating`, `duration`, `country`
- `cast`, `director`
- `eventLinks[]`

### Send Ticket Email

```bash
cd $CLAUDE_PLUGIN_ROOT && bun run src/cli.ts send \
  --session-id [sessionId] \
  --seats [seats] \
  --adults [n] \
  [--children [n]]
```

**Required:**
- `--session-id` - Session ID from movies data
- `--seats` - Comma-separated seat numbers (e.g., "D5" or "H1,H2")
- `--adults` - Number of adult tickets (must be ≥ 0)

**Optional:**
- `--children` - Number of child/concession tickets (defaults to 0)

**Example:**
```bash
cd $CLAUDE_PLUGIN_ROOT && bun run src/cli.ts send \
  --session-id "116135" \
  --seats "D5" \
  --adults 1 \
  --children 0
```

**What it does:**
1. Scrapes movie, session, and pricing data
2. Validates and calculates total pricing with booking fees
3. Generates HTML ticket using Classic Cinemas template
4. Sends email to `hi@nathanvale.com`
5. Returns JSON with `messageId` and pricing details

**Returns:** JSON with:
```json
{
  "success": true,
  "messageId": "...",
  "movieTitle": "...",
  "sessionDateTime": "...",
  "screenNumber": "...",
  "seats": "...",
  "pricing": {
    "adults": 1,
    "children": 0,
    "ticketSubtotal": 26.5,
    "bookingFee": 0,
    "totalAmount": 26.5
  }
}
```

## Pricing Calculation

**Important:** Booking fees are charged **per ticket**, not per transaction.

**Example:**
- 1 Adult ($27.00) + 1 Child ($21.00) = $48.00 subtotal
- Booking fee: 2 tickets × $1.95 = $3.90
- **Total: $51.90**
