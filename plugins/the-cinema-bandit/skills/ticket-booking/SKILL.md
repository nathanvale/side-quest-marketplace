---
name: cinema-ticket-booking
description: Conversational workflow for booking cinema tickets at Classic Cinemas Elsternwick with live pricing scraping and email delivery. Use when Nathan asks to book cinema tickets, get tickets for a movie, see what movies are showing, or book seats at Classic Cinemas.
allowed-tools: Bash(bun:*), Bash(cd:*), Read
model: claude-3-5-haiku-20241022
---

# Cinema Ticket Booking

Guide Nathan through a conversational 7-step booking process that scrapes live pricing, generates a ticket, and emails it to `hi@nathanvale.com`.

**Important**: This creates a display ticket only - Nathan handles actual booking/payment separately.

## Resources

- **CLI Commands**: See [cli-commands.md](references/cli-commands.md) for detailed command reference
- **Conversation Tips**: See [conversation-guide.md](references/conversation-guide.md) for style guidelines and error handling

---

## Workflow

### 1. Show Today's Movies

Fetch and display movies:

```bash
cd $CLAUDE_PLUGIN_ROOT && bun run src/cli.ts movies
```

Present in friendly format with clear numbering and session times:

```
🎬 Movies showing today at Classic Cinemas:

1. MOVIE TITLE (Rating) - 10:15am, 11:50am, 1:15pm
   https://www.classiccinemas.com.au/movies/movie-slug

2. ANOTHER MOVIE (Rating) - 12:30pm, 3:00pm
   https://www.classiccinemas.com.au/movies/another-slug

Which movie would you like to see?
```

Wait for Nathan's choice.

### 2. Confirm Booking Interest

When Nathan picks a movie and time:

```
Great choice! [Movie Title] at [Time].

Would you be interested in booking tickets for this session?
```

If no → offer alternatives or end. If yes → continue.

### 3. Get Ticket Quantities

Ask for ticket counts:

```
How many tickets do you need?
- Adults:
- Children/Concession:
```

### 4. Calculate and Show Pricing

Fetch session and pricing data:

```bash
cd $CLAUDE_PLUGIN_ROOT && bun run src/cli.ts session --session-id "[sessionId]"
cd $CLAUDE_PLUGIN_ROOT && bun run src/cli.ts pricing --session-id "[sessionId]"
```

The pricing command automatically adds a ticket to reveal and scrape the actual booking fee.

Calculate total and present:

```
💰 Pricing for "[Movie Title]"
   Screen [N] | [Date], [Time]

   Adults: [X] × $[price] = $[subtotal]
   Children: [X] × $[price] = $[subtotal]
   Booking Fee: [total tickets] × $[fee] = $[total fee]

   Total: $[total]

Would you like to proceed with booking?
```

### 5. Get Seat Selection

When confirmed:

```
Great! What seats would you like? (e.g., F9, F10)

You can visit the booking page to see available seats:
https://www.classiccinemas.com.au/tickets?c=0000000002&s=[sessionId]
```

Wait for Nathan's seat numbers.

### 6. Generate and Send Ticket

Execute the send command:

```bash
cd $CLAUDE_PLUGIN_ROOT && bun run src/cli.ts send \
  --session-id "[sessionId]" \
  --seats "[seats]" \
  --adults [n] \
  --children [n]
```

This scrapes data, generates HTML ticket, and emails to `hi@nathanvale.com`.

### 7. Confirm Success

Show booking summary and confirmation:

```
✅ All done! Your ticket has been emailed to hi@nathanvale.com

Booking Summary:
- 🎬 Movie: [Movie Title]
- 📅 When: [Date], [Time]
- 🎭 Screen: Screen [N]
- 💺 Seat: [Seats]
- 💰 Total: $[Total]

Check your inbox for "Booking Confirmation for [Movie Title]"

Enjoy the show! 🍿
```
