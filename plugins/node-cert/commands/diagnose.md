---
description: Run a comprehensive diagnostic sweep for certificate and proxy issues
argument-hint: [host]
---

# node-cert diagnose

Run a comprehensive diagnostic sweep for certificate and proxy issues.

## Usage

```
/node-cert:diagnose [host]
```

## Arguments

- `host` - Target host to test against (default: api.anthropic.com)

## Instructions

Run the diagnostic script at `scripts/diagnose.sh` which checks:

1. **Environment variables** - proxy settings, NODE_EXTRA_CA_CERTS
2. **VPN/proxy client detection** - GlobalProtect, Cisco, Zscaler, etc.
3. **DNS resolution** - Can we resolve the target host?
4. **Direct TLS connection** - What certificate does the proxy present?
5. **TLS with CA file** - Does our CA file fix the trust issue?
6. **Proxy connectivity** - Can we reach the proxy server?
7. **HTTPS via proxy** - Does curl work through the proxy?
8. **Direct HTTPS** - Does curl work without proxy?
9. **Node.js TLS test** - Can Node.js make HTTPS requests?
10. **Summary** - Quick overview of findings

After running, analyze the output and recommend fixes based on:
- If SSL inspection is detected, ensure CA is extracted
- If CA file missing, run `/node-cert:extract-cert`
- If CA file exists but Node.js fails, check file validity
- If proxy unreachable, check VPN connection

## Example Output Analysis

```
== 4. Direct TLS to api.anthropic.com (no proxy) ==
  [INFO] Certificate issuer: CN = YourCompany Forward Trust CA
  [INFO] SSL inspection DETECTED - corporate proxy is intercepting traffic
  [FAIL] TLS handshake failed: Verify return code: 21 (unable to verify)
```

This means:
1. SSL inspection is active (corporate CA in chain)
2. System doesn't trust the corporate CA
3. Need to extract and configure the corporate root CA
