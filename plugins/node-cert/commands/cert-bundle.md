# node-cert cert-bundle

Create a combined CA bundle with system certificates and corporate CA.

## Usage

```
/node-cert:cert-bundle [output-path]
```

## Arguments

- `output-path` - Where to save the bundle (default: ~/ca-bundle.pem)

## Instructions

Some scenarios require combining the corporate CA with system certificates:

- Proxy uses intermediate CA without full chain
- Tool needs complete chain validation
- Container/CI environment without system certs

### 1. Locate System CA Bundle

**macOS:**
```bash
# Homebrew OpenSSL (preferred)
SYSTEM_CA="/opt/homebrew/etc/openssl@3/cert.pem"

# Or export from Keychain
security find-certificate -a -p /System/Library/Keychains/SystemRootCertificates.keychain > /tmp/system-ca.pem
SYSTEM_CA="/tmp/system-ca.pem"
```

**Linux:**
```bash
# Debian/Ubuntu
SYSTEM_CA="/etc/ssl/certs/ca-certificates.crt"

# RHEL/CentOS/Fedora
SYSTEM_CA="/etc/pki/tls/certs/ca-bundle.crt"

# Alpine
SYSTEM_CA="/etc/ssl/cert.pem"
```

### 2. Verify Corporate CA Exists

```bash
CORP_CA="${NODE_EXTRA_CA_CERTS:-$HOME/CAFile.pem}"
if [[ ! -f "$CORP_CA" ]]; then
  echo "Corporate CA not found. Run /node-cert:extract-cert first."
  exit 1
fi
```

### 3. Create Combined Bundle

```bash
OUTPUT="${1:-$HOME/ca-bundle.pem}"

# Combine system certs + corporate CA
cat "$SYSTEM_CA" "$CORP_CA" > "$OUTPUT"

echo "Created bundle at $OUTPUT"
echo "  System certs: $(grep -c 'BEGIN CERTIFICATE' "$SYSTEM_CA") certificates"
echo "  Corporate CA: $(grep -c 'BEGIN CERTIFICATE' "$CORP_CA") certificates"
echo "  Total: $(grep -c 'BEGIN CERTIFICATE' "$OUTPUT") certificates"
```

### 4. Update Environment

```bash
# Use the bundle instead of just corporate CA
export NODE_EXTRA_CA_CERTS="$HOME/ca-bundle.pem"
export SSL_CERT_FILE="$HOME/ca-bundle.pem"
```

### 5. Verify Bundle Works

```bash
# Test with openssl
openssl s_client -connect api.anthropic.com:443 -CAfile ~/ca-bundle.pem </dev/null 2>/dev/null | grep "Verify return code"

# Test with Node.js
NODE_EXTRA_CA_CERTS=~/ca-bundle.pem node -e "require('https').get('https://api.anthropic.com/', r => console.log('HTTP', r.statusCode))"
```

## When You Need a Bundle

**Single CA file works for most cases:**
- Corporate proxy provides full chain
- Only need Node.js to trust corporate CA

**Bundle needed when:**
- `unable to get issuer certificate` even with corporate CA
- Tool validates full chain including public CAs
- Running in container without system certs
- Proxy sends incomplete chain

## Example Output

```
Created bundle at /Users/you/ca-bundle.pem
  System certs: 147 certificates
  Corporate CA: 1 certificates
  Total: 148 certificates

To use this bundle:
  export NODE_EXTRA_CA_CERTS=~/ca-bundle.pem
  export SSL_CERT_FILE=~/ca-bundle.pem
```

## Maintenance

When corporate CA rotates:
1. Re-extract with `/node-cert:extract-cert`
2. Re-create bundle with `/node-cert:cert-bundle`

Consider automating with a weekly cron job if certs rotate frequently.
