# Certificate Extraction Procedure

Extract the corporate root CA from a live TLS connection using `openssl s_client`.

## Prerequisites

- Connected to corporate VPN (traffic must flow through the proxy)
- `openssl` installed (default on macOS/Linux)
- Access to an HTTPS endpoint that gets inspected (e.g., `api.anthropic.com`)

## Quick Extraction

One-liner to extract and save the root CA:

```bash
# Connect to a known HTTPS endpoint and extract the certificate chain
openssl s_client -connect api.anthropic.com:443 -servername api.anthropic.com -showcerts </dev/null 2>/dev/null | \
  awk '/-----BEGIN CERTIFICATE-----/,/-----END CERTIFICATE-----/' | \
  tail -n +1 > /tmp/chain.pem

# Extract the last certificate (root CA) from the chain
csplit -f /tmp/cert- -s /tmp/chain.pem '/-----BEGIN CERTIFICATE-----/' '{*}'
last_cert=$(ls -1 /tmp/cert-* | tail -1)
cp "$last_cert" ~/CAFile.pem
rm /tmp/cert-* /tmp/chain.pem

# Verify it's the root CA
openssl x509 -in ~/CAFile.pem -noout -subject -issuer
```

## Step-by-Step Explanation

### 1. Get the Certificate Chain

```bash
openssl s_client -connect api.anthropic.com:443 -servername api.anthropic.com -showcerts </dev/null 2>/dev/null
```

Flags:
- `-connect host:port` - Target server
- `-servername host` - SNI (Server Name Indication) for virtual hosts
- `-showcerts` - Show ALL certificates in the chain, not just the leaf
- `</dev/null` - Don't wait for input
- `2>/dev/null` - Suppress connection diagnostics

Output includes multiple PEM-encoded certificates:

```
-----BEGIN CERTIFICATE-----
MIIDxx...  (leaf - api.anthropic.com)
-----END CERTIFICATE-----
-----BEGIN CERTIFICATE-----
MIIDyy...  (intermediate - Forward Trust CA)
-----END CERTIFICATE-----
-----BEGIN CERTIFICATE-----
MIIDzz...  (root - Corporate Root CA) <- This is what we need
-----END CERTIFICATE-----
```

### 2. Identify the Root CA

The root CA is:
- **Last in the chain** (deepest in the trust hierarchy)
- **Self-signed** (Subject == Issuer)

To verify:

```bash
# Extract subject and issuer
openssl x509 -in ~/CAFile.pem -noout -subject -issuer
```

Expected output for root CA:
```
subject=CN = YourCompany Root CA
issuer=CN = YourCompany Root CA
```

If subject != issuer, you have an intermediate, not the root.

### 3. Check Certificate Details

```bash
openssl x509 -in ~/CAFile.pem -noout -text | head -20
```

Look for:
- `CA:TRUE` in Basic Constraints (confirms it's a CA cert)
- Validity dates (ensure not expired)
- Key Usage includes "Certificate Sign"

## Common Hosts to Extract From

Use any HTTPS host that:
1. Gets inspected by your proxy
2. Is reliably available

Good choices:
- `api.anthropic.com` - Claude API
- `api.openai.com` - OpenAI API
- `registry.npmjs.org` - npm registry
- `github.com` - GitHub
- `google.com` - Almost always works

## Troubleshooting Extraction

### "No certificates found"

The connection might be bypassed (not inspected):

```bash
# Check if this host is inspected
openssl s_client -connect api.anthropic.com:443 -servername api.anthropic.com </dev/null 2>/dev/null | grep "issuer="
```

If issuer is Amazon/DigiCert/etc., the host isn't inspected. Try a different host.

### Only Getting Leaf Certificate

Missing `-showcerts` flag - it only shows the leaf by default.

### Chain Has Only One Certificate

Some proxies don't send the full chain. The leaf might be directly signed by the root:

```bash
# Check what signed the leaf
openssl s_client -connect api.anthropic.com:443 </dev/null 2>/dev/null | openssl x509 -noout -issuer
```

If the issuer looks like a root CA (not "Forward Trust" or "Intermediate"), that single cert might be what you need.

### Permission Denied Writing File

Use a writable location:

```bash
# Write to home directory
openssl ... > ~/CAFile.pem

# Or use /tmp first, then copy
openssl ... > /tmp/CAFile.pem
cp /tmp/CAFile.pem ~/CAFile.pem
```

## Verifying the Extracted Certificate

After extraction, verify it works:

```bash
# Test TLS with the extracted CA
openssl s_client -connect api.anthropic.com:443 -servername api.anthropic.com -CAfile ~/CAFile.pem </dev/null 2>/dev/null | grep "Verify return code"
```

Expected: `Verify return code: 0 (ok)`

If you get a non-zero code, the certificate might be:
- Wrong certificate (intermediate instead of root)
- Chain requires bundling with system certs
- Expired or not yet valid

## Security Considerations

- **Store securely** - The CA file is sensitive; don't commit to public repos
- **Verify before trusting** - Confirm the cert came from your corporate proxy
- **Check expiry** - Corporate certs typically rotate annually or quarterly
- **One CA per file** - `NODE_EXTRA_CA_CERTS` expects a single PEM file (can contain multiple certs)

## Automation

For scripts that teammates can run, see `scripts/extract-cert.sh` which:
- Detects VPN clients
- Extracts from a configurable host
- Validates the extraction
- Backs up existing CA files
- Runs a Node.js smoke test
