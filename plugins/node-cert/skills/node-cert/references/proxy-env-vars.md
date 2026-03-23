# Proxy Environment Variables

Configure environment variables for corporate proxy and certificate trust.

## Core Variables

### Proxy Configuration

| Variable | Purpose | Example |
|----------|---------|---------|
| `HTTP_PROXY` | Proxy for HTTP requests | `http://proxy.corp.com:8080` |
| `HTTPS_PROXY` | Proxy for HTTPS requests | `http://proxy.corp.com:8080` |
| `http_proxy` | Lowercase variant (some tools) | Same as above |
| `https_proxy` | Lowercase variant (some tools) | Same as above |
| `NO_PROXY` | Hosts to bypass proxy | `localhost,.corp.com,.internal` |
| `no_proxy` | Lowercase variant | Same as above |

### Certificate Trust

| Variable | Purpose | Example |
|----------|---------|---------|
| `NODE_EXTRA_CA_CERTS` | Additional CA for Node.js | `~/CAFile.pem` |
| `SSL_CERT_FILE` | CA bundle for OpenSSL/curl | `/etc/ssl/certs/ca-bundle.crt` |
| `REQUESTS_CA_BUNDLE` | CA bundle for Python requests | `~/CAFile.pem` |
| `GIT_SSL_CAINFO` | CA file for git over HTTPS | `~/CAFile.pem` |
| `npm_config_cafile` | CA file for npm | `~/CAFile.pem` |

## Proxy URL Format

```
http://[user:password@]host:port
```

Examples:
- `http://proxy.corp.com:8080` - Basic proxy
- `http://proxy.corp.com:80` - Port 80 (common for transparent proxies)
- `http://user:pass@proxy.corp.com:8080` - With authentication

Note: Even for HTTPS traffic, the proxy URL usually uses `http://` because the CONNECT method establishes the tunnel.

## NO_PROXY Syntax

Comma-separated list of hosts/domains to bypass the proxy:

```bash
export NO_PROXY=localhost,127.0.0.1,.corp.com,.internal.local
```

Patterns:
- `localhost` - Exact hostname match
- `.corp.com` - All subdomains of corp.com
- `192.168.1.0/24` - CIDR ranges (some tools only)
- `*` - All hosts (effectively disables proxy)

## Shell Configuration

### Basic Setup

Add to `~/.zshrc` or `~/.bashrc`:

```bash
# Corporate Proxy Configuration
export HTTP_PROXY="http://proxy.corp.com:8080"
export HTTPS_PROXY="http://proxy.corp.com:8080"
export http_proxy="$HTTP_PROXY"
export https_proxy="$HTTPS_PROXY"
export NO_PROXY="localhost,127.0.0.1,.corp.com"
export no_proxy="$NO_PROXY"

# Node.js Certificate Trust
export NODE_EXTRA_CA_CERTS="$HOME/CAFile.pem"
```

### Toggle Functions (Recommended)

For VPN on/off scenarios, use toggle functions:

```bash
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
    echo "  HTTP_PROXY: $HTTP_PROXY"
    echo "  NODE_EXTRA_CA_CERTS: ${NODE_EXTRA_CA_CERTS:-unset}"
    if [[ -f "${NODE_EXTRA_CA_CERTS:-}" ]]; then
      local cn
      cn=$(openssl x509 -in "$NODE_EXTRA_CA_CERTS" -noout -subject 2>/dev/null | sed 's/.*CN *= *//')
      echo "  CA Subject: $cn"
    fi
  else
    echo "Proxy: OFF"
  fi
}
```

## Tool-Specific Variables

### npm

```bash
# Via environment
export npm_config_proxy="http://proxy.corp.com:8080"
export npm_config_https_proxy="http://proxy.corp.com:8080"
export npm_config_cafile="$HOME/CAFile.pem"

# Via npm config (persistent)
npm config set proxy http://proxy.corp.com:8080
npm config set https-proxy http://proxy.corp.com:8080
npm config set cafile ~/CAFile.pem
```

### git

```bash
# Via environment
export GIT_SSL_CAINFO="$HOME/CAFile.pem"

# Via git config (persistent)
git config --global http.proxy http://proxy.corp.com:8080
git config --global http.sslCAInfo ~/CAFile.pem
```

### pip (Python)

```bash
export REQUESTS_CA_BUNDLE="$HOME/CAFile.pem"
# or
pip config set global.cert ~/CAFile.pem
```

### curl

```bash
export CURL_CA_BUNDLE="$HOME/CAFile.pem"
# or in ~/.curlrc
cacert = /path/to/CAFile.pem
```

### Docker

Docker daemon reads system certs, but for builds:

```dockerfile
ENV NODE_EXTRA_CA_CERTS=/certs/corporate-ca.pem
COPY CAFile.pem /certs/corporate-ca.pem
```

## Verification Commands

Check current proxy settings:

```bash
# All proxy-related vars
env | grep -iE 'proxy|ca_cert|ssl|cafile'

# Specific checks
echo "HTTP_PROXY: ${HTTP_PROXY:-unset}"
echo "NODE_EXTRA_CA_CERTS: ${NODE_EXTRA_CA_CERTS:-unset}"
[[ -f "$NODE_EXTRA_CA_CERTS" ]] && echo "CA file exists" || echo "CA file missing"
```

Test connectivity through proxy:

```bash
# curl with verbose SSL info
curl -v https://api.anthropic.com/ 2>&1 | grep -E "Trying|Connected|SSL|issuer"

# Node.js quick test
node -e "require('https').get('https://api.anthropic.com/', r => console.log('HTTP', r.statusCode))"
```

## Common Issues

### "Proxy authentication required"

Add credentials to the proxy URL:

```bash
export HTTP_PROXY="http://username:password@proxy.corp.com:8080"
```

Or use `~/.netrc` for sensitive credentials.

### "Connection refused" to proxy

1. Check you're on VPN
2. Verify proxy hostname/port with IT
3. Try both port 80 and 8080

### Tools ignore proxy

Some tools need lowercase variants:

```bash
export http_proxy="$HTTP_PROXY"
export https_proxy="$HTTPS_PROXY"
```

### NODE_EXTRA_CA_CERTS not working

1. Check file exists: `ls -la ~/CAFile.pem`
2. Check it's valid PEM: `openssl x509 -in ~/CAFile.pem -noout -text`
3. Restart your terminal (env vars aren't inherited by running processes)
4. Check for typos in the path

## Security Notes

- **Never commit proxy credentials** - Use env vars or netrc
- **Verify CA certificates** - Only trust certs from your IT team
- **Use NO_PROXY for internal hosts** - Don't route internal traffic through external inspection
