# Quarantine Skill

Query the macOS quarantine database to understand where files came from.

Use this skill when users ask about:
- Download sources and origins
- Which apps downloaded files
- Security audit of downloads
- Clearing download history

## MCP Tools

| Tool | Description | Destructive |
|------|-------------|-------------|
| `quarantine_recent` | Recent downloads | No |
| `quarantine_search_app` | Search by app name | No |
| `quarantine_search_url` | Search by URL pattern | No |
| `quarantine_by_date` | Filter by date range | No |
| `quarantine_apps` | Apps ranked by download count | No |
| `quarantine_audit_week` | Weekly audit summary | No |
| `quarantine_oldest` | Oldest download record | No |
| `quarantine_clear` | Clear history (requires confirm) | **YES** |

## Usage Examples

**Recent downloads:**
```
quarantine_recent({ limit: 20 })
```

**Find Safari downloads:**
```
quarantine_search_app({ name: "Safari" })
```

**Downloads from GitHub:**
```
quarantine_search_url({ pattern: "github.com" })
```

**Weekly audit:**
```
quarantine_audit_week()
```

**Clear history (DANGEROUS):**
```
quarantine_clear({ confirm: true })
```

## Database Info

- **Location:** `~/Library/Preferences/com.apple.LaunchServices.QuarantineEventsV2`
- **Format:** SQLite database
- **Purpose:** Tracks download sources for Gatekeeper security

## Common Use Cases

1. **Security audit:** "What did I download this week?"
2. **Source lookup:** "Where did this file come from?"
3. **App analysis:** "Which apps download the most files?"
4. **Privacy cleanup:** "Clear my download history"
