---
description: Extract the corporate root CA from a live TLS connection
argument-hint: [host]
---

# node-cert extract-cert

Extract the corporate root CA from a live TLS connection.

## Usage

```
/node-cert:extract-cert [host]
```

## Arguments

- `host` - Host to extract certificate from (default: api.anthropic.com)

## Instructions

Run the extraction script at `scripts/extract-cert.sh` which:

1. Checks for VPN client (informational)
2. Verifies DNS resolution
3. Detects SSL inspection by checking certificate issuer
4. Connects and extracts the full certificate chain
5. Extracts the root CA (last cert in chain)
6. Verifies it's self-signed (subject == issuer)
7. Backs up existing CA file if different
8. Writes new CA to ~/CAFile.pem
9. Runs Node.js smoke test

After successful extraction, remind the user to:

1. Add to shell config:
   ```bash
   export NODE_EXTRA_CA_CERTS=~/CAFile.pem
   ```

2. Or use the toggle functions:
   ```bash
   # Run /node-cert:proxy-toggle-setup to generate these
   proxy-on   # Enable proxy + cert
   proxy-off  # Disable
   ```

3. Restart terminal or source rc file

## Custom Output Path

```bash
CA_OUTPUT=/custom/path/cert.pem ./extract-cert.sh
```

## Troubleshooting

If extraction fails:
- **"No known VPN client detected"** - Informational only, script continues
- **"Cannot resolve host"** - DNS issue, check network
- **"Certificate issuer appears to be public CA"** - SSL inspection may not be active for this host, try different host
- **"Node.js could not connect"** - Extracted cert may be intermediate, not root; may need cert bundling
