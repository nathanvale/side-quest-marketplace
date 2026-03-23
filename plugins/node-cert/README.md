# node-cert

Claude Code plugin for fixing Node.js certificate trust issues behind corporate SSL-inspecting proxies.

## The Problem

Corporate proxies (Zscaler, Palo Alto, Cisco Umbrella, etc.) perform SSL/TLS inspection by intercepting HTTPS traffic and re-signing it with their own certificate. Node.js uses its own bundled CA store, not the system trust store, so it doesn't trust these corporate certificates.

This causes errors like:
- `UNABLE_TO_VERIFY_LEAF_SIGNATURE`
- `SELF_SIGNED_CERT_IN_CHAIN`
- `unable to get local issuer certificate`

## The Solution

Extract your corporate root CA and tell Node.js to trust it via `NODE_EXTRA_CA_CERTS`.

## Installation

```bash
# Add to your Claude Code plugins
claude --plugin-dir ~/code/side-quest-plugins/plugins/node-cert
```

Or add to your Claude Code settings.

## Quick Start

The easiest way to get started:

```
/node-cert:setup
```

This walks you through the complete process:
1. Diagnose your current state
2. Extract the corporate certificate
3. Configure your shell
4. Verify everything works

## Commands

| Command | Description |
|---------|-------------|
| `/node-cert:setup` | Complete guided setup workflow |
| `/node-cert:diagnose` | Full diagnostic sweep |
| `/node-cert:extract-cert` | Extract corporate root CA |
| `/node-cert:verify` | Check configuration (no network) |
| `/node-cert:smoke-test` | Test Node.js connectivity |
| `/node-cert:cert-info` | Display certificate details |
| `/node-cert:proxy-env` | Generate export statements |
| `/node-cert:proxy-toggle-setup` | Generate shell toggle functions |
| `/node-cert:check-inspection` | Detect SSL inspection |
| `/node-cert:cert-bundle` | Create combined CA bundle |
| `/node-cert:export-fix` | Generate portable fix script |

## Standalone Scripts

The `scripts/` directory contains portable bash scripts that work without the plugin:

```bash
# Full diagnostic
bash scripts/diagnose.sh

# Extract certificate
bash scripts/extract-cert.sh

# Test connectivity
bash scripts/smoke-test.sh

# View certificate details
bash scripts/cert-info.sh
```

## Manual Setup

If you prefer to set things up manually:

### 1. Extract the Certificate

While connected to your corporate VPN:

```bash
# Extract root CA from live TLS chain
openssl s_client -connect api.anthropic.com:443 -showcerts </dev/null 2>/dev/null | \
  awk '/BEGIN CERTIFICATE/,/END CERTIFICATE/' | \
  tail -n +1 > ~/CAFile.pem
```

### 2. Configure Your Shell

Add to `~/.zshrc` or `~/.bashrc`:

```bash
# Simple: Always export
export NODE_EXTRA_CA_CERTS=~/CAFile.pem

# Or: Toggle functions for VPN on/off
proxy-on() {
  export HTTP_PROXY="http://your-proxy:8080"
  export HTTPS_PROXY="$HTTP_PROXY"
  export NODE_EXTRA_CA_CERTS=~/CAFile.pem
  echo "Proxy ON"
}

proxy-off() {
  unset HTTP_PROXY HTTPS_PROXY NODE_EXTRA_CA_CERTS
  echo "Proxy OFF"
}
```

### 3. Verify

```bash
node -e "require('https').get('https://api.anthropic.com/', r => console.log('HTTP', r.statusCode))"
```

## Auto-Triggering

The skill auto-triggers when you mention:
- VPN, corporate VPN, corporate proxy
- SSL inspection, MITM proxy, TLS interception
- NODE_EXTRA_CA_CERTS, CAFile.pem
- Certificate errors (UNABLE_TO_VERIFY_LEAF_SIGNATURE, etc.)
- Claude Code on VPN, npm behind proxy

## Reference Documentation

The plugin includes detailed reference docs:

- **root-cause.md** - Why Node.js fails (TLS deep dive)
- **cert-extraction.md** - Step-by-step extraction procedure
- **proxy-env-vars.md** - All environment variables explained
- **tool-specific-fixes.md** - Claude Code, npm, git, pip, Docker
- **platform-guide.md** - macOS, Linux, Windows specifics
- **troubleshooting.md** - Error message lookup and decision tree
- **ca-bundle-management.md** - Certificate rotation and bundling

## Tool-Specific Configuration

### npm
```bash
npm config set cafile ~/CAFile.pem
```

### git
```bash
git config --global http.sslCAInfo ~/CAFile.pem
```

### pip
```bash
export REQUESTS_CA_BUNDLE=~/CAFile.pem
```

### Docker
```dockerfile
ENV NODE_EXTRA_CA_CERTS=/certs/CAFile.pem
COPY CAFile.pem /certs/
```

## Troubleshooting

### Certificate was working, now fails
Corporate CAs rotate periodically. Re-extract:
```bash
bash scripts/extract-cert.sh
```

### Works for some hosts, not others
Some hosts may bypass the proxy. Check:
```bash
/node-cert:check-inspection
```

### Still failing after setup
Check certificate details:
```bash
/node-cert:cert-info
```

May need a combined bundle:
```bash
/node-cert:cert-bundle
```

## License

MIT

## Author

Nathan Vale
