# Downloads Skill

Manage the ~/Downloads folder with search, stats, and cleanup.

Use this skill when users want to:
- List recent downloads
- Search for files
- Get download statistics
- Clear old downloads

## MCP Tools

| Tool | Description | Destructive |
|------|-------------|-------------|
| `downloads_recent` | Recent files by modification time | No |
| `downloads_search` | Search files by name pattern | No |
| `downloads_apps` | List .app files | No |
| `downloads_today` | Files modified today | No |
| `downloads_week` | Files modified this week | No |
| `downloads_stats` | Folder size and file counts | No |
| `downloads_clear` | Remove old files | **YES** |

## Usage Examples

**Recent downloads:**
```
downloads_recent({ limit: 10 })
```

**Search for PDFs:**
```
downloads_search({ query: ".pdf" })
```

**Today's downloads:**
```
downloads_today()
```

**Folder stats:**
```
downloads_stats()
```

**Clear old files:**
```
downloads_clear()
```

## Difference from Quarantine

| Downloads | Quarantine |
|-----------|------------|
| Manages **files** in ~/Downloads | Queries **download sources** |
| File operations (list, search, delete) | Database queries (where from?) |
| Current state of folder | Historical download records |

## Common Use Cases

1. **Find file:** "Where's that PDF I downloaded?"
2. **Cleanup:** "Delete old downloads to free space"
3. **Overview:** "How big is my Downloads folder?"
4. **Recent:** "What did I download today?"
