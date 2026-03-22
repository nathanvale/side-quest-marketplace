---
name: observability
description: >
  Start, stop, or check status of the Side Quest observability event server.
  Use when asked to start the server, stop the server, check server status,
  or manage the observability dashboard lifecycle.
disable-model-invocation: true
argument-hint: "[start|stop|status]"
allowed-tools: Bash
---

# Observability Server

Manage the observability event server lifecycle. Mirrors the CLI subcommands.

Repo root: /Users/nathanvale/code/side-quest-observability
Default port: 7483

## Subcommand Routing

Route based on `$ARGUMENTS`:

| Argument | Action |
|----------|--------|
| `start` | Start the server |
| `stop` | Stop the server |
| `status` | Check server health |
| (empty) | Ask the user what they want to do |

## start

1. Check if a server is already running:

```bash
curl -sf http://127.0.0.1:7483/health 2>/dev/null
```

If healthy, report the existing server and stop -- do not start a second instance.

2. Start the server in the background from the repo root:

```bash
bun run /Users/nathanvale/code/side-quest-observability/packages/server/src/cli/index.ts start --port 7483 &
```

3. Wait briefly, then verify startup:

```bash
sleep 1 && curl -sf http://127.0.0.1:7483/health
```

4. Report to the user:
   - Health check result
   - Dashboard: http://127.0.0.1:7483
   - WebSocket: ws://127.0.0.1:7483/ws

### Custom port

If the user specifies a port, pass `--port <PORT>` and adjust all URLs.

## stop

1. Check if a server is running:

```bash
curl -sf http://127.0.0.1:7483/health 2>/dev/null
```

If not reachable, report that no server is running and stop.

2. Stop the server using the CLI:

```bash
bun run /Users/nathanvale/code/side-quest-observability/packages/server/src/cli/index.ts stop
```

3. Verify shutdown -- health endpoint should be unreachable:

```bash
curl -sf http://127.0.0.1:7483/health 2>/dev/null
```

4. Report that the server has been stopped.

## status

1. Hit the health endpoint:

```bash
curl -sf http://127.0.0.1:7483/health 2>/dev/null
```

2. If reachable, report the health response (uptime, event counts, port).
3. If not reachable, report that no server is running.

## Troubleshooting

### Port already in use

If start fails with EADDRINUSE, check what's on the port:

```bash
lsof -i :7483
```

Report the conflicting process and ask the user how to proceed.

### Server won't stop

If the CLI stop command fails, check the PID file:

```bash
cat ~/.cache/side-quest-observability/events.pid
```

Ask the user before killing the process directly.
