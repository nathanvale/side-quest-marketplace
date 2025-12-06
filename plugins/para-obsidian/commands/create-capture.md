Capture content to the inbox for later processing.

## Required Arguments
- `$TITLE` - Brief title for the capture
- `$CONTENT` - The actual content being captured
- `$CAPTURED_FROM` - Source: thought | conversation | article | book | video | podcast | email | meeting | voice

## Optional Arguments
- `$RESONANCE` - Why it resonated: inspiring | useful | personal | surprising (default: useful)
- `$URGENCY` - Processing priority: high | medium | low (default: medium)
- `$DEST` - Destination folder (default: 00_Inbox)

## Auto-filled Fields
- `created` - Current date (YYYY-MM-DD)
- `status` - inbox
- `template_version` - 2
- `tags` - Always includes "inbox"

## Frontmatter Hints
- **captured_from**: thought, conversation, article, book, video, podcast, email, meeting, voice
- **resonance**: inspiring | useful | personal | surprising
- **urgency**: high | medium | low
- **Suggested tags**: inbox, capture, work, family, health, learning, finance

## Command
```bash
para-obsidian create --template capture \
  --title "$TITLE" \
  --dest "${DEST:-00_Inbox}" \
  --arg "Title=$TITLE" \
  --arg "Captured from (thought/article/conversation/etc.)=$CAPTURED_FROM" \
  --arg "Resonance (inspiring/useful/personal/surprising)=${RESONANCE:-useful}" \
  --arg "Urgency (high/medium/low)=${URGENCY:-medium}" \
  --arg "Content=$CONTENT"
```

## Example Usage

For voice memo: "I should look into using Playwright for web scraping instead of Puppeteer"

```
TITLE: "Playwright vs Puppeteer for Scraping"
CONTENT: "Consider switching to Playwright for web scraping. It has better browser automation APIs and handles dynamic content more reliably than Puppeteer."
CAPTURED_FROM: "voice"
RESONANCE: "useful"
URGENCY: "low"
```

For article highlight: Key insight from blog post about ADHD productivity

```
TITLE: "ADHD Time Boxing Strategy"
CONTENT: "Use 25-minute focused blocks with 5-minute breaks. The constraint helps ADHD brains engage hyperfocus without burnout."
CAPTURED_FROM: "article"
RESONANCE: "useful"
URGENCY: "medium"
```
