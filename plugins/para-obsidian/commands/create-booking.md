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

**booking_type options**: accommodation | flight | activity | transport | dining
**payment_status options**: pending | paid | refunded | cancelled

## Command

```bash
bun src/cli.ts create --template booking \
  --title "$TITLE" \
  --dest "$DEST" \
  --arg "Booking title=$TITLE" \
  --arg "Booking type (accommodation/flight/activity/transport/dining)=$BOOKING_TYPE" \
  --arg "Project=$PROJECT" \
  --arg "Booking date (YYYY-MM-DD)=$DATE" \
  --arg "Cost (numeric only, e.g., 1850.00)=$COST" \
  --arg "Currency (e.g., AUD, USD, EUR)=$CURRENCY" \
  --arg "Payment status (pending/paid/refunded/cancelled)=$PAYMENT_STATUS" \
  --content '{
    "Booking Details": "| Field | Value |\n|-------|-------|\n| **Booking Ref** | ... |\n| **Provider** | ... |",
    "Cost & Payment": "| Field | Value |\n|-------|-------|\n| **Total Cost** | '$COST' '$CURRENCY' |\n| **Payment Status** | '$PAYMENT_STATUS' |",
    "Contact Information": "- **Phone**: ...\n- **Email**: ...\n- **Website**: ...",
    "Confirmation Details": "...",
    "Important Notes": "..."
  }'
```

## Content Sections

| Section | Purpose |
|---------|---------|
| `Booking Details` | Reference, provider, date |
| `Cost & Payment` | Cost, payment status, cancellation |
| `Contact Information` | Phone, email, website |
| `Confirmation Details` | Paste confirmation here |
| `Important Notes` | Check-in times, requirements |

## Frontmatter Hints

- **Suggested tags**: booking, travel, event
- **Wikilinks**: Project wikilinks are automatically quoted in YAML frontmatter for Dataview compatibility (e.g., `project: "[[Japan 2025]]"`)

## Examples

```
/para-obsidian:create-booking "MEL-NRT Qantas QF79" flight "[[Japan 2025]]" 2025-03-15 1850.00 AUD paid
/para-obsidian:create-booking "Vue de Monde Dinner" restaurant "[[Anniversary]]" 2025-02-14 450.00 AUD
/para-obsidian:create-booking "Dentist Checkup" appointment "[[Health]]" 2025-01-20 180.00 AUD
```
