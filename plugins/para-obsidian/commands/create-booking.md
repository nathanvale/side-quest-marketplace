Create a booking record note.

Bookings track reservations, tickets, and scheduled services.

## Required Arguments
- `$TITLE` - Booking description
- `$BOOKING_TYPE` - Type: flight | hotel | restaurant | event | appointment | transport
- `$PROJECT` - Related project as wikilink
- `$DATE` - Booking date (YYYY-MM-DD)
- `$COST` - Cost amount (e.g. "150.00")
- `$CURRENCY` - Currency code (e.g. "AUD", "USD")

## Optional Arguments
- `$PAYMENT_STATUS` - Status: pending | paid | refunded (default: pending)
- `$DEST` - Destination folder (default: 00_Inbox)

## Auto-filled Fields
- `created` - Today's date
- `status` - confirmed
- `template_version` - 2
- `tags` - Always includes "booking"

## Frontmatter Hints
- **booking_type**: flight, hotel, restaurant, event, appointment, transport
- **payment_status**: pending | paid | refunded
- **Suggested tags**: booking, travel, event

## Command
```bash
para-obsidian create --template booking \
  --title "$TITLE" \
  --dest "${DEST:-00_Inbox}" \
  --arg "Booking title=$TITLE" \
  --arg "Booking type=$BOOKING_TYPE" \
  --arg "Project=$PROJECT" \
  --arg "Date (YYYY-MM-DD)=$DATE" \
  --arg "Cost=$COST" \
  --arg "Currency=$CURRENCY" \
  --arg "Payment status=${PAYMENT_STATUS:-pending}"
```

## Example Usage

For flight booking: "Melbourne to Tokyo flight"

```
TITLE: "MEL-NRT Qantas QF79"
BOOKING_TYPE: "flight"
PROJECT: "[[Japan 2025]]"
DATE: "2025-03-15"
COST: "1850.00"
CURRENCY: "AUD"
PAYMENT_STATUS: "paid"
```

For restaurant reservation: "Dinner at Vue de Monde"

```
TITLE: "Vue de Monde Dinner"
BOOKING_TYPE: "restaurant"
PROJECT: "[[Anniversary Weekend]]"
DATE: "2025-02-14"
COST: "450.00"
CURRENCY: "AUD"
PAYMENT_STATUS: "pending"
```
