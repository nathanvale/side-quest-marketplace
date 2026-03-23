# node-cert proxy-toggle-setup

Generate proxy-on/off/status shell functions for rc file.

## Usage

```
/node-cert:proxy-toggle-setup [proxy-url]
```

## Arguments

- `proxy-url` - Corporate proxy URL (optional, will prompt if not provided)

## Instructions

Generate toggle functions that users can add to their shell config (`.zshrc`, `.bashrc`).

### 1. Gather Information

Ask for (if not provided):
- Proxy URL (e.g., `http://proxy.corp.com:8080`)
- NO_PROXY domains (e.g., `localhost,.corp.com`)
- CA file path (default: `~/CAFile.pem`)

### 2. Generate Functions

```bash
# Proxy Toggle Functions
# Add these to your ~/.zshrc or ~/.bashrc

proxy-on() {
  export HTTP_PROXY="http://proxy.corp.com:8080"
  export HTTPS_PROXY="http://proxy.corp.com:8080"
  export http_proxy="$HTTP_PROXY"
  export https_proxy="$HTTPS_PROXY"
  export NO_PROXY="localhost,127.0.0.1,.corp.com"
  export no_proxy="$NO_PROXY"
  export NODE_EXTRA_CA_CERTS="$HOME/CAFile.pem"
  echo "Proxy ON"
}

proxy-off() {
  unset HTTP_PROXY HTTPS_PROXY http_proxy https_proxy
  unset NO_PROXY no_proxy
  unset NODE_EXTRA_CA_CERTS
  echo "Proxy OFF"
}

proxy-status() {
  if [[ -n "${HTTP_PROXY:-}" ]]; then
    echo "Proxy: ON"
    echo "  URL: $HTTP_PROXY"
    echo "  CA:  ${NODE_EXTRA_CA_CERTS:-unset}"
    if [[ -f "${NODE_EXTRA_CA_CERTS:-}" ]]; then
      local cn
      cn=$(openssl x509 -in "$NODE_EXTRA_CA_CERTS" -noout -subject 2>/dev/null | sed 's/.*CN *= *//')
      echo "  CA Subject: $cn"
    fi
  else
    echo "Proxy: OFF"
  fi
}

# Default: Proxy OFF (uncomment if you want this behavior)
# proxy-off >/dev/null
```

### 3. Usage Instructions

After showing the functions, explain:

```
Usage:
  proxy-on      # Enable proxy when connecting to VPN
  proxy-off     # Disable proxy when off VPN
  proxy-status  # Check current state

Workflow:
1. Connect to VPN
2. Run: proxy-on
3. Work normally (Claude Code, npm, etc.)
4. Disconnect from VPN
5. Run: proxy-off

The functions are idempotent - safe to run multiple times.
```

### 4. Offer to Write

Offer to append to user's rc file:

```
Would you like me to add these to your shell config?
I can append to:
- ~/.zshrc (recommended for zsh users)
- ~/.bashrc (for bash users)
```

If user agrees, use Write tool to append (with a comment header).

## Advanced: Auto-Detection

For users who want automatic detection, mention this approach:

```bash
# Auto-detect VPN and toggle proxy
# Add to ~/.zshrc AFTER the functions above

if pgrep -q "GlobalProtect\|vpnagentd\|openvpn" 2>/dev/null; then
  proxy-on >/dev/null
else
  proxy-off >/dev/null
fi
```

Caution: Auto-detection can be fragile. Manual toggle is more reliable.
