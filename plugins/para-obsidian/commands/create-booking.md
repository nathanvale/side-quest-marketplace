---
description: Create a booking record note for reservations and tickets
argument-hint: <title> <booking-type> <project> <date> <cost> <currency> [payment-status] [dest]
allowed-tools: Bash(para-obsidian:*)
---

## Variables

```bash
TITLE="$1"
BOOKING_TYPE="$2"
PROJECT="$3"
DATE="$4"
COST="$5"
CURRENCY="$6"
PAYMENT_STATUS="${7:-pending}"
DEST="${8:-00_Inbox}"
```

**booking_type options**: flight | hotel | restaurant | event | appointment | transport
**payment_status options**: pending | paid | refunded

## Command

```bash
para-obsidian create --template booking \
  --title "$TITLE" \
  --dest "$DEST" \
  --arg "Booking title=$TITLE" \
  --arg "Booking type=$BOOKING_TYPE" \
  --arg "Project=$PROJECT" \
  --arg "Date (YYYY-MM-DD)=$DATE" \
  --arg "Cost=$COST" \
  --arg "Currency=$CURRENCY" \
  --arg "Payment status=$PAYMENT_STATUS"
```

## Frontmatter Hints

- **Suggested tags**: booking, travel, event

## Examples

```
/para-obsidian:create-booking "MEL-NRT Qantas QF79" flight "[[Japan 2025]]" 2025-03-15 1850.00 AUD paid
/para-obsidian:create-booking "Vue de Monde Dinner" restaurant "[[Anniversary Weekend]]" 2025-02-14 450.00 AUD pending
/para-obsidian:create-booking "Dentist Checkup" appointment "[[Health]]" 2025-01-20 180.00 AUD
```
