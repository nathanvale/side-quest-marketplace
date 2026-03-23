---
description: Complete guided setup - diagnose, extract certificate, configure shell, and verify
---

# node-cert setup

Complete guided setup that orchestrates the full certificate fix workflow.

## Usage

```
/node-cert:setup
```

## Overview

This command walks the user through fixing Node.js certificate issues step-by-step:

1. **Diagnose** - Check current state
2. **Extract** - Get the corporate root CA
3. **Configure** - Set up shell environment
4. **Verify** - Confirm everything works

## Instructions

### Step 1: Initial Check

First, confirm the user is on their corporate VPN:

```
Are you currently connected to your corporate VPN?
```

If not, ask them to connect first - we need traffic flowing through the proxy to extract the certificate.

### Step 2: Run Diagnostics

Run the diagnostic script to understand the current state:

```bash
bash scripts/diagnose.sh
```

Analyze the output for:
- Is SSL inspection active? (Look for corporate CA in issuer)
- Is NODE_EXTRA_CA_CERTS set?
- Does the CA file exist and is it valid?
- Can Node.js connect?

If Node.js already works, inform the user they're already configured and offer to verify with a smoke test.

### Step 3: Extract Certificate (if needed)

If SSL inspection is detected and Node.js is failing:

```bash
bash scripts/extract-cert.sh
```

Confirm extraction succeeded by checking:
- CA file was written to ~/CAFile.pem
- Node.js smoke test passed

### Step 4: Configure Shell

Ask the user about their shell configuration preference:

```
How would you like to configure your shell?

1. Toggle functions (proxy-on/proxy-off) - Recommended for VPN users
2. Always-on exports - For permanent proxy environments
3. Show me the exports only - I'll configure manually
```

**Option 1: Toggle Functions**

Generate and offer to append to their shell rc file:

```bash
# Proxy Toggle Functions
proxy-on() {
  export HTTP_PROXY="<detected-or-ask>"
  export HTTPS_PROXY="$HTTP_PROXY"
  export http_proxy="$HTTP_PROXY"
  export https_proxy="$HTTPS_PROXY"
  export NO_PROXY="localhost,127.0.0.1"
  export no_proxy="$NO_PROXY"
  export NODE_EXTRA_CA_CERTS="$HOME/CAFile.pem"
  echo "Proxy ON"
}

proxy-off() {
  unset HTTP_PROXY HTTPS_PROXY http_proxy https_proxy
  unset NO_PROXY no_proxy NODE_EXTRA_CA_CERTS
  echo "Proxy OFF"
}

proxy-status() {
  if [[ -n "${HTTP_PROXY:-}" ]]; then
    echo "Proxy: ON -> $HTTP_PROXY"
  else
    echo "Proxy: OFF"
  fi
}
```

Ask: "Would you like me to add these to your ~/.zshrc (or ~/.bashrc)?"

**Option 2: Always-on exports**

Generate static exports for permanent proxy environments.

**Option 3: Manual**

Just display the configuration for them to copy.

### Step 5: Gather Proxy Details

If proxy URL wasn't detected, ask:

```
What is your corporate proxy URL?
Example: http://proxy.corp.com:8080
```

```
What domains should bypass the proxy? (comma-separated)
Example: localhost,.corp.com,.internal
```

### Step 6: Final Verification

After configuration:

1. Ask user to open a new terminal (or source their rc file)
2. Run the smoke test:

```bash
bash scripts/smoke-test.sh
```

3. Confirm success:

```
Setup complete! Here's what was configured:

- CA file: ~/CAFile.pem (extracted from <issuer>)
- Shell functions: proxy-on, proxy-off, proxy-status
- Added to: ~/.zshrc

To use:
1. Connect to VPN
2. Run: proxy-on
3. Use Claude Code, npm, etc. normally
4. When done: proxy-off
```

### Step 7: Offer Additional Tools

After successful setup, mention:

```
Other tools that may need configuration:
- npm: Already works via NODE_EXTRA_CA_CERTS
- git: Run `git config --global http.sslCAInfo ~/CAFile.pem`
- pip: export REQUESTS_CA_BUNDLE=~/CAFile.pem

See /node-cert:proxy-env for tool-specific exports.
```

## Error Handling

### "No SSL inspection detected"

```
Your traffic doesn't appear to be SSL-inspected on this network.
Node.js should work without additional configuration.

If you're still seeing certificate errors:
1. Make sure you're connected to the corporate VPN
2. Try a different target host: /node-cert:diagnose github.com
```

### "Extraction failed"

```
Certificate extraction failed. Possible causes:
1. Not connected to VPN
2. Target host is bypassed by the proxy
3. Network connectivity issues

Try:
- Verify VPN connection
- Use a different host: /node-cert:extract-cert registry.npmjs.org
- Check /node-cert:diagnose output for clues
```

### "Smoke test still fails after setup"

```
The smoke test is still failing. Let's debug:

1. Check the CA file: /node-cert:cert-info
2. Verify it's not expired
3. The corporate CA may have rotated - re-extract: /node-cert:extract-cert

If the issue persists, you may need a combined CA bundle.
Run: /node-cert:cert-bundle
```
