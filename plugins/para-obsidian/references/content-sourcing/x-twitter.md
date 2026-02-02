# X/Twitter Content Sourcing

Fetch X/Twitter content using X-API MCP tools with user-assisted fallback.

## CRITICAL: Firecrawl Does NOT Work

**NEVER use Firecrawl for x.com or twitter.com URLs.** It returns "website not supported" error. You MUST use X-API MCP tools or user-assisted fallback.

## Tools

| Tool | Purpose |
|------|---------|
| `mcp__plugin_x-api_x-api__x_get_tweet` | Fetch tweet by ID (no time limit) |
| `mcp__plugin_x-api_x-api__x_get_thread` | Reconstruct conversation thread (7-day limit on replies) |
| `mcp__plugin_x-api_x-api__x_get_user` | Fetch author profile context |
| `mcp__plugin_x-api_x-api__x_get_replies` | Get replies to a tweet |

## Tool Availability Check

**CRITICAL:** X-API tools are deferred. Load them before use:

```
ToolSearch({ query: "x-api tweet" })
```

This loads `x_get_tweet`, `x_get_thread`, `x_get_user`, and `x_get_replies` in a single call.

If tools return "tool not found" after ToolSearch, proceed directly to user-assisted fallback.

## URL Parsing

Extract `tweet_id` and `username` from the source URL:

```
URL: https://x.com/mattpocockuk/status/1876540660609491024

Parsed:
- username: mattpocockuk
- tweet_id: 1876540660609491024
```

Pattern: `https://(x.com|twitter.com)/<username>/status/<tweet_id>`

## Primary Pattern: X-API MCP Tools

### Step 1: Fetch Tweet

```
mcp__plugin_x-api_x-api__x_get_tweet({ tweet_id: "1876540660609491024" })
```

Returns structured data:
- `tweet.text` — Full tweet content
- `tweet.author.name` — Display name
- `tweet.author.username` — @handle
- `tweet.created_at` — ISO 8601 date
- `tweet.public_metrics` — Likes, retweets, impressions
- `tweet.author.description` — Author bio
- `tweet.author.public_metrics.followers_count` — Follower count

**No time limit** — `x_get_tweet` fetches any tweet by ID regardless of age.

### Step 2: Fetch Thread (if applicable)

If the tweet is part of a thread (check `referenced_tweets` or if the clipping suggests a thread):

```
mcp__plugin_x-api_x-api__x_get_thread({ tweet_id: "1876540660609491024" })
```

Returns an array of tweets in the conversation.

**7-day limitation:** Thread reply search uses the Twitter search API, which only indexes the last 7 days. The root tweet itself has no time limit. For threads older than 7 days, you'll get the root tweet but may miss replies.

### Step 3: Author Context (optional)

For richer enrichment, fetch the author profile:

```
mcp__plugin_x-api_x-api__x_get_user({ username: "mattpocockuk" })
```

Returns bio, follower count, location — context Chrome DevTools never provided.

## Data Mapping

| Field | X-API Source | Notes |
|-------|-------------|-------|
| Tweet text | `tweet.text` | Direct, structured |
| Author name | `tweet.author.name` | Direct |
| @handle | `tweet.author.username` | Direct |
| Post date | `tweet.created_at` | ISO 8601 |
| Thread | `x_get_thread` response | Structured array |
| Likes/RTs | `tweet.public_metrics` | **Bonus** — not available via DOM |
| Author bio | `tweet.author.description` | **Bonus** — author context |

## Error Handling

X-API tools have built-in retry logic (3 attempts with exponential backoff).

| Error | Type | Action |
|-------|------|--------|
| 429 (Rate Limit) | Transient | Retry automatically (built-in) |
| 500 (Server Error) | Transient | Retry automatically (built-in) |
| 401 (Unauthorized) | Permanent | Check `X_BEARER_TOKEN` config |
| 403 (Forbidden) | Permanent | Protected account — fallback to user-assisted |
| 404 (Not Found) | Permanent | Tweet deleted — mark `enrichment_failed` |

## Fallback: User-Assisted Content

When X-API tools are unavailable or fail permanently.

### When to Use

1. X-API MCP tools are not available (ToolSearch returns nothing)
2. Tweet is from a protected account (403)
3. Rate limits exhausted after retries
4. `X_BEARER_TOKEN` not configured

### Step 1: Parse URL for Context

```
URL: https://x.com/mattpocockuk/status/1876540660609491024

Parsed:
- username: mattpocockuk
- tweet_id: 1876540660609491024
```

### Step 2: Check Existing Clipping Content

The clipping may already have partial content captured by Web Clipper. Check if the note body contains any tweet text beyond just the URL.

### Step 3: Ask User for Content

Present a helpful prompt:

```
I can't fetch X/Twitter content directly (X-API tools aren't available).

**Tweet by @[username]:** [source URL]

Could you help me out? Either:
1. **Paste the tweet text** here
2. **Summarize what it's about** from memory
3. **Skip this clipping** and move to the next one

What would you prefer?
```

### Step 4: Continue with User Content

Once user provides content, continue the workflow as normal. Learning and distillation work equally well with user-provided context.

## Known Limitations

- **No media:** X-API returns text only — no images, video, or polls. Fine for Layer 1 text content.
- **Thread replies limited to 7 days:** `x_get_thread` uses search API for replies. Root tweet fetches with no time limit. Old threads will have the root tweet but may miss replies.
- **Protected accounts:** Bearer token auth can't access private tweets. Fallback: user-assisted.
