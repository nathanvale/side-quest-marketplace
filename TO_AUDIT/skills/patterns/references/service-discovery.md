# Service Discovery: File-Based Zero-Config Discovery

The server writes port, PID, and nonce files to a well-known cache directory. Clients read these files to find the running server without configuration.

## Discovery Files

| File | Content | Purpose |
|------|---------|---------|
| `~/.cache/side-quest-observability/events.port` | Port number (e.g., `7483`) | Find the server's HTTP port |
| `~/.cache/side-quest-observability/events.pid` | Process ID (e.g., `12345`) | Identify and stop the server process |
| `~/.cache/side-quest-observability/events.nonce` | Random string | Authenticate requests to the server |

Reference implementation (`command.ts:19-26`):

```typescript
const GLOBAL_CACHE_DIR = join(
  os.homedir(),
  '.cache',
  'side-quest-observability',
)
const PID_FILE = join(GLOBAL_CACHE_DIR, 'events.pid')
const PORT_FILE = join(GLOBAL_CACHE_DIR, 'events.port')
const NONCE_FILE = join(GLOBAL_CACHE_DIR, 'events.nonce')
```

## Read Pattern

Reading discovery state (`command.ts:1345-1351`):

```typescript
function readDiscoveryState(): DiscoveryState {
  return {
    pid: readIntFile(PID_FILE),
    port: readIntFile(PORT_FILE),
    nonce: readTextFile(NONCE_FILE),
  }
}
```

Each file reader (`command.ts:1353-1371`):
1. Reads the file as UTF-8 text
2. Trims whitespace
3. Validates the format (integer for port/pid, non-empty for nonce)
4. Returns `null` on any failure (missing file, bad format, permission error)

```typescript
function readIntFile(filePath: string): number | null {
  try {
    const value = readFileSync(filePath, 'utf8').trim()
    if (!/^\d+$/.test(value)) return null
    const parsed = Number.parseInt(value, 10)
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null
  } catch {
    return null
  }
}
```

## Write Pattern

The server writes discovery files on successful start and cleans them up on stop. The write happens in the server module (not in `command.ts`) -- the CLI only reads.

## Stale File Handling

Discovery files can become stale if the server crashes without cleanup. The CLI handles this:

```typescript
// command.ts:1383-1391
function isProcessRunning(pid: number): boolean {
  if (!Number.isInteger(pid) || pid <= 0) return false
  try {
    process.kill(pid, 0)  // Signal 0: check if process exists
    return true
  } catch {
    return false
  }
}
```

The `stop` command (`command.ts:878`) checks if the PID is actually running before attempting to stop it. If the process is gone, it cleans up stale files and reports not-found.

## Health Check Fallback

The `status` command goes beyond PID checks -- it hits the health endpoint (`command.ts:848`):

```typescript
const health = await fetchJsonWithTimeout(`${baseUrl}/health`, 1_500)
```

This catches zombie scenarios where the PID exists but the server is non-responsive. The health check has a 1.5-second timeout to fail fast.

## Cleanup

Discovery files are cleaned up in three scenarios:

1. **Normal stop**: `cleanupDiscoveryFiles()` after confirmed process exit
2. **Stale PID**: Stop command finds PID not running, cleans up
3. **ESRCH error**: `process.kill` fails with "no such process", cleans up

```typescript
function cleanupDiscoveryFiles(): void {
  for (const file of [PID_FILE, PORT_FILE, NONCE_FILE]) {
    try { unlinkSync(file) } catch { /* Best-effort cleanup */ }
  }
}
```

## Implementation Checklist

- [ ] Use `~/.cache/<app-name>/` as the discovery directory (XDG Base Directory spec)
- [ ] Write port, PID, and nonce as separate plain-text files
- [ ] Readers return `null` on any failure (never throw)
- [ ] Validate PID is actually running before trusting the PID file
- [ ] Health check the server even when discovery files exist
