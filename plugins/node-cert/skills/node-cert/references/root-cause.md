# Root Cause: Why Node.js Fails Behind Corporate Proxies

## TLS Certificate Trust 101

When you connect to `https://api.anthropic.com`, TLS (Transport Layer Security) ensures:

1. **Authentication** - You're really talking to Anthropic, not an imposter
2. **Encryption** - No one can read the traffic between you and the server
3. **Integrity** - No one can modify the traffic in transit

This works through a **certificate chain of trust**:

```
api.anthropic.com (leaf certificate)
    └── Amazon RSA 2048 M02 (intermediate CA)
        └── Amazon Root CA 1 (root CA - trusted)
```

Your system trusts Amazon Root CA 1 because it's in the **system trust store** - a curated list of Certificate Authorities that operating systems ship with.

## What Corporate Proxies Do

SSL-inspecting proxies (Zscaler, Palo Alto, Cisco Umbrella, Forcepoint, etc.) implement **man-in-the-middle decryption**:

```
┌─────────┐    TLS #1    ┌────────────────┐    TLS #2    ┌───────────────┐
│   You   │ ←─────────→  │ Corporate Proxy │ ←─────────→  │ api.anthropic │
└─────────┘  Corp cert   └────────────────┘  Real cert   └───────────────┘
```

1. **You connect to api.anthropic.com** - But the proxy intercepts
2. **Proxy connects to api.anthropic.com for you** - Sees the real certificate
3. **Proxy decrypts and inspects the traffic** - For security/compliance
4. **Proxy re-encrypts with its own certificate** - Signed by corporate CA
5. **You receive the corporate-signed certificate** - Not the real Amazon-signed one

The certificate you see now looks like:

```
api.anthropic.com (leaf - re-signed by proxy)
    └── YourCompany Forward Trust CA (intermediate)
        └── YourCompany Root CA (root - NOT in default trust stores!)
```

## The Trust Store Gap

**System trust stores** (macOS Keychain, Windows Certificate Store, Linux ca-certificates):
- Managed by the OS
- Updated automatically
- Corporate IT can add the company's root CA here

**Node.js bundled trust store**:
- Compiled into the Node.js binary
- Based on Mozilla's CA bundle at build time
- **Does NOT use the system trust store by default**
- Does NOT automatically include corporate CAs

This is the **trust store gap**: Corporate IT adds their CA to the system store, but Node.js ignores it.

## Why Node.js Uses Its Own Store

Node.js bundles its own CA store for:

1. **Consistency** - Same behavior across all platforms
2. **Security** - Not affected by system-level CA compromises
3. **Portability** - Works in containers, CI/CD without OS configuration

The trade-off: Corporate environments need explicit configuration.

## The Solution: NODE_EXTRA_CA_CERTS

Node.js provides an escape hatch: `NODE_EXTRA_CA_CERTS` environment variable.

```bash
export NODE_EXTRA_CA_CERTS=/path/to/corporate-root-ca.pem
```

This tells Node.js: "Trust your bundled CAs AND this additional certificate."

When set:
- Node.js loads the file at startup
- Adds it to the internal trust store
- All HTTPS requests will trust certificates signed by this CA

## Common Error Messages

| Error | Meaning |
|-------|---------|
| `UNABLE_TO_VERIFY_LEAF_SIGNATURE` | Can't verify the server cert - missing CA |
| `SELF_SIGNED_CERT_IN_CHAIN` | Found an untrusted self-signed cert in the chain |
| `unable to get local issuer certificate` | Can't find the CA that signed this cert |
| `certificate has expired` | CA file exists but wrong cert or expired |
| `unable to verify the first certificate` | Missing intermediate or root CA |

## Anti-Pattern: NODE_TLS_REJECT_UNAUTHORIZED=0

You might see advice to disable certificate verification:

```bash
# DON'T DO THIS
export NODE_TLS_REJECT_UNAUTHORIZED=0
```

This disables ALL certificate validation, making your connection vulnerable to actual MITM attacks. It's a security hole, not a fix.

The proper fix is always to add the corporate CA, not disable verification.

## Detecting SSL Inspection

To check if your traffic is being inspected:

```bash
openssl s_client -connect api.anthropic.com:443 -servername api.anthropic.com </dev/null 2>/dev/null | grep -E "issuer=|subject="
```

**Normal (no inspection):**
```
subject=CN = api.anthropic.com
issuer=C = US, O = Amazon, CN = Amazon RSA 2048 M02
```

**Inspected:**
```
subject=CN = api.anthropic.com
issuer=CN = YourCompany Forward Trust CA
```

If the issuer isn't a well-known CA (Amazon, DigiCert, Let's Encrypt, etc.), your traffic is being inspected.

## Summary

| Component | What It Is |
|-----------|------------|
| **System trust store** | OS-managed list of trusted root CAs |
| **Node.js trust store** | Bundled CA list, separate from OS |
| **Corporate CA** | Your company's root certificate for proxy signing |
| **NODE_EXTRA_CA_CERTS** | Env var to add corporate CA to Node.js |
| **Trust store gap** | Corporate CA in system store but not Node.js |
