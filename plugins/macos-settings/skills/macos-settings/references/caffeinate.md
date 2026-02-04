# caffeinate — Temporary Sleep Prevention

`caffeinate` prevents sleep temporarily. Unlike `pmset`, changes don't persist — sleep resumes when caffeinate exits.

## Quick Reference

```bash
caffeinate              # Prevent idle sleep until Ctrl+C
caffeinate -d           # Also prevent display sleep
caffeinate -i command   # Prevent sleep while command runs
caffeinate -t 3600      # Prevent sleep for 1 hour (seconds)
caffeinate -w PID       # Prevent sleep while process runs
```

## Flags

| Flag | Prevents | Use Case |
|------|----------|----------|
| `-d` | Display sleep | Presentation, watching video |
| `-i` | Idle sleep | Long-running task |
| `-m` | Disk idle sleep | Disk-intensive operation |
| `-s` | System sleep (AC only) | Server-like behavior |
| `-u` | Declare user active | Wake display + prevent idle |
| `-t N` | Sleep for N seconds | Time-limited prevention |
| `-w PID` | Sleep until process exits | Track another process |

## Common Patterns

### Keep awake during a command

```bash
caffeinate -i make -j8
caffeinate -i npm run build
caffeinate -i rsync -av /source /dest
```

### Keep awake for a specific time

```bash
caffeinate -t 3600    # 1 hour
caffeinate -t 7200    # 2 hours
caffeinate -t 28800   # 8 hours
```

### Presentation mode (display stays on)

```bash
caffeinate -disu      # Full prevention: display, idle, system, user
```

### Background server mode

For headless Macs where you want CPU on but display can sleep:

```bash
nohup caffeinate -isu > /tmp/caffeinate.log 2>&1 &
```

This prevents system sleep without forcing the display on (no `-d` flag).

### Monitor a process

```bash
# Keep awake while backup runs
caffeinate -w $(pgrep -f "Time Machine")
```

## caffeinate vs pmset

| Aspect | caffeinate | pmset |
|--------|------------|-------|
| Persistence | Temporary (until exit) | Permanent (survives reboot) |
| Scope | Process-specific | System-wide |
| Use case | "Don't sleep during this task" | "Never sleep" |
| sudo | Not required | Required |

**Use caffeinate for:**
- Long-running builds
- File transfers
- Presentations
- Temporary server mode

**Use pmset for:**
- Headless servers
- Permanent workstation settings
- Boot-time configuration

## Gotchas

### Memory leak with repeated calls

Repeated `caffeinate` invocations create orphaned assertion handles, increasing kernel memory pressure by ~12KB per instance.

**Bad:**
```bash
while true; do
    caffeinate -t 60
done
```

**Good:**
```bash
caffeinate -i my-long-script.sh
```

### Remote SSH sessions

When connected via SSH, there's no display. Use `-i` not `-d`:

```bash
# Good for SSH
caffeinate -i -t 7200

# Unnecessary for SSH (no display)
caffeinate -d -t 7200
```

### Combining with pmset

For persistent remote wake, use pmset instead of caffeinate:

```bash
sudo pmset -a tcpkeepalive 1
```

## Check Active Assertions

See all power assertions (including caffeinate):

```bash
pmset -g assertions
```

Look for `PreventUserIdleSystemSleep` or `PreventUserIdleDisplaySleep`.

## Sources

- `man caffeinate` (run in Terminal)
- [ss64.com/mac/caffeinate.html](https://ss64.com/mac/caffeinate.html)
- [osxdaily.com — Prevent Mac Sleeping with caffeinate](https://osxdaily.com/2012/08/03/disable-sleep-mac-caffeinate-command/)
