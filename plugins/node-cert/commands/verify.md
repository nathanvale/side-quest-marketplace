---
description: Verify certificate and proxy configuration without network requests
model-invocation: disabled
---

# node-cert verify

Verify certificate and proxy configuration without network requests.

## Usage

```
/node-cert:verify
```

## Instructions

Check the user's environment configuration (no network requests):

### 1. Check Environment Variables

```bash
echo "=== Proxy Variables ==="
echo "HTTP_PROXY: ${HTTP_PROXY:-unset}"
echo "HTTPS_PROXY: ${HTTPS_PROXY:-unset}"
echo "http_proxy: ${http_proxy:-unset}"
echo "https_proxy: ${https_proxy:-unset}"
echo "NO_PROXY: ${NO_PROXY:-unset}"

echo ""
echo "=== Certificate Variables ==="
echo "NODE_EXTRA_CA_CERTS: ${NODE_EXTRA_CA_CERTS:-unset}"
echo "SSL_CERT_FILE: ${SSL_CERT_FILE:-unset}"
echo "REQUESTS_CA_BUNDLE: ${REQUESTS_CA_BUNDLE:-unset}"
echo "GIT_SSL_CAINFO: ${GIT_SSL_CAINFO:-unset}"
```

### 2. Check CA File

If `NODE_EXTRA_CA_CERTS` is set:

```bash
if [[ -f "$NODE_EXTRA_CA_CERTS" ]]; then
  echo "CA file exists: $(wc -c < "$NODE_EXTRA_CA_CERTS") bytes"
  openssl x509 -in "$NODE_EXTRA_CA_CERTS" -noout -subject -issuer -dates
else
  echo "CA file NOT FOUND at $NODE_EXTRA_CA_CERTS"
fi
```

### 3. Validate CA File Format

```bash
openssl x509 -in "$NODE_EXTRA_CA_CERTS" -noout -text >/dev/null 2>&1 && echo "Valid PEM format" || echo "INVALID PEM format"
```

### 4. Check for Common Issues

Report any of these:
- `NODE_EXTRA_CA_CERTS` unset
- CA file doesn't exist
- CA file is empty or invalid PEM
- CA file is expired
- Proxy vars set but no CA file (likely to fail)
- Lowercase/uppercase proxy vars mismatch

## Expected Output

Good configuration:
```
=== Proxy Variables ===
HTTP_PROXY: http://proxy.corp.com:8080
HTTPS_PROXY: http://proxy.corp.com:8080
NO_PROXY: localhost,.corp.com

=== Certificate Variables ===
NODE_EXTRA_CA_CERTS: /Users/you/CAFile.pem

=== CA File ===
CA file exists: 1842 bytes
subject=CN = YourCompany Root CA
issuer=CN = YourCompany Root CA
notBefore=Jan  1 00:00:00 2024 GMT
notAfter=Dec 31 23:59:59 2026 GMT

=== Validation ===
Valid PEM format
Self-signed (root CA): YES
Status: Valid (698 days remaining)
```

Bad configuration:
```
NODE_EXTRA_CA_CERTS: unset
ISSUE: CA environment variable not set. Run /node-cert:extract-cert first.
```
