# Troubleshooting Guide

Error message lookup and decision tree for certificate issues.

## Error Message Reference

### Node.js Errors

| Error | Cause | Fix |
|-------|-------|-----|
| `UNABLE_TO_VERIFY_LEAF_SIGNATURE` | Missing CA for the certificate chain | Set `NODE_EXTRA_CA_CERTS` to corporate CA |
| `SELF_SIGNED_CERT_IN_CHAIN` | Self-signed cert without trust | Add the self-signed CA to `NODE_EXTRA_CA_CERTS` |
| `unable to get local issuer certificate` | Missing intermediate or root CA | Extract full chain, may need to bundle certs |
| `certificate has expired` | CA file contains expired cert | Re-extract the certificate |
| `unable to verify the first certificate` | Missing the CA that signed the leaf | Extract and configure corporate CA |
| `CERT_NOT_YET_VALID` | Certificate date is in the future | Check system clock; cert may have wrong dates |
| `DEPTH_ZERO_SELF_SIGNED_CERT` | Server sent self-signed cert directly | Rare; add that specific cert to trust |
| `unable to get issuer certificate` | Intermediate CA missing | May need to bundle system certs + corporate CA |

### npm Errors

| Error | Cause | Fix |
|-------|-------|-----|
| `UNABLE_TO_GET_ISSUER_CERT_LOCALLY` | npm can't verify registry cert | Set `npm_config_cafile` |
| `unable to verify the first certificate` | Same as Node.js | Set `NODE_EXTRA_CA_CERTS` or `npm_config_cafile` |
| `self signed certificate in certificate chain` | Corporate proxy re-signing | Extract CA, configure npm |
| `request to https://registry.npmjs.org failed` | Network or cert issue | Check proxy vars and CA file |

### git Errors

| Error | Cause | Fix |
|-------|-------|-----|
| `SSL certificate problem: unable to get local issuer certificate` | Missing CA for HTTPS git | Set `GIT_SSL_CAINFO` |
| `SSL certificate problem: self signed certificate in certificate chain` | Corporate proxy | Extract CA, set `GIT_SSL_CAINFO` |
| `server certificate verification failed` | OpenSSL can't verify | Add CA to system store or set `GIT_SSL_CAINFO` |

### curl Errors

| Error | Cause | Fix |
|-------|-------|-----|
| `SSL certificate problem: unable to get local issuer certificate` | Missing CA | Use `--cacert` flag or `CURL_CA_BUNDLE` |
| `SSL: no alternative certificate subject name matches target host` | Wrong cert presented | Check you're going through proxy correctly |

### Python/pip Errors

| Error | Cause | Fix |
|-------|-------|-----|
| `SSLError: [SSL: CERTIFICATE_VERIFY_FAILED]` | Missing CA | Set `REQUESTS_CA_BUNDLE` |
| `ssl.SSLCertVerificationError` | Same | Same |

## Decision Tree

### Step 1: Is SSL Inspection Active?

```bash
openssl s_client -connect api.anthropic.com:443 -servername api.anthropic.com </dev/null 2>/dev/null | grep "issuer="
```

- **Issuer is Amazon/DigiCert/Let's Encrypt**: No inspection - check network/firewall
- **Issuer is YourCompany/Zscaler/Palo Alto**: Inspection active - continue to Step 2

### Step 2: Do You Have the CA File?

```bash
ls -la ~/CAFile.pem 2>/dev/null
```

- **File doesn't exist**: Run `/node-cert:extract-cert`
- **File exists**: Continue to Step 3

### Step 3: Is the CA File Valid?

```bash
openssl x509 -in ~/CAFile.pem -noout -dates
```

- **"unable to load certificate"**: File is corrupted or not PEM format - re-extract
- **notAfter date is in the past**: Certificate expired - re-extract
- **Dates look valid**: Continue to Step 4

### Step 4: Is NODE_EXTRA_CA_CERTS Set?

```bash
echo "${NODE_EXTRA_CA_CERTS:-unset}"
```

- **"unset"**: Set it: `export NODE_EXTRA_CA_CERTS=~/CAFile.pem`
- **Set but wrong path**: Fix the path
- **Set correctly**: Continue to Step 5

### Step 5: Does the CA Match What Proxy Sends?

```bash
# Get current CA subject
openssl x509 -in ~/CAFile.pem -noout -subject

# Get what proxy is sending
openssl s_client -connect api.anthropic.com:443 -showcerts </dev/null 2>/dev/null | \
  openssl x509 -noout -subject
```

- **Subjects match**: CA is correct
- **Subjects differ**: Corporate CA may have rotated - re-extract

### Step 6: Test Node.js Directly

```bash
node -e "
const https = require('https');
https.get('https://api.anthropic.com/', res => {
  console.log('HTTP', res.statusCode);
}).on('error', e => console.log('Error:', e.message));
"
```

- **"HTTP 200" or "HTTP 404"**: TLS works! Problem is elsewhere
- **Certificate error**: CA file isn't being read - check it's absolute path

### Step 7: Check for Tool-Specific Config

Some tools need their own CA configuration:

```bash
# npm
npm config get cafile

# git
git config --global http.sslCAInfo

# pip
pip config get global.cert
```

## Quick Fixes

### "Works in Terminal but Not in IDE/App"

GUI apps don't inherit shell environment. Solutions:

1. **Set globally**: Add to `~/.zshenv` (loaded by all zsh instances)
2. **Launch from terminal**: `open -a "Visual Studio Code"` inherits env
3. **Configure in app**: VS Code: `terminal.integrated.env.osx`

### "Works for curl but Not Node"

curl uses system certs by default. Node.js doesn't.

```bash
# Verify curl works
curl https://api.anthropic.com/

# Node needs explicit CA
NODE_EXTRA_CA_CERTS=~/CAFile.pem node -e "..."
```

### "Certificate Changed" (Worked Yesterday)

Corporate CAs rotate periodically. Re-extract:

```bash
bash ~/code/side-quest-plugins/plugins/node-cert/scripts/extract-cert.sh
```

### "Only Fails on Certain Domains"

Proxy might bypass some domains. Check:

```bash
# Compare issuers
for host in api.anthropic.com github.com internal.corp.com; do
  echo "$host: $(openssl s_client -connect $host:443 </dev/null 2>/dev/null | grep issuer=)"
done
```

Bypassed domains show real CA (Amazon, DigiCert). Inspected domains show corporate CA.

### "NODE_EXTRA_CA_CERTS Works but npm Still Fails"

npm sometimes needs its own config:

```bash
npm config set cafile ~/CAFile.pem
```

### "Error Persists After Setting Everything"

Terminal sessions don't inherit mid-session env changes. Either:

1. Source your rc file: `source ~/.zshrc`
2. Open a new terminal
3. Restart your IDE/app

## Environment Checklist

Run this to check your setup:

```bash
echo "=== Proxy Variables ==="
echo "HTTP_PROXY: ${HTTP_PROXY:-unset}"
echo "HTTPS_PROXY: ${HTTPS_PROXY:-unset}"
echo "NO_PROXY: ${NO_PROXY:-unset}"

echo ""
echo "=== Certificate Variables ==="
echo "NODE_EXTRA_CA_CERTS: ${NODE_EXTRA_CA_CERTS:-unset}"

echo ""
echo "=== CA File Check ==="
if [[ -f "${NODE_EXTRA_CA_CERTS:-}" ]]; then
  echo "CA file exists: $(wc -c < "$NODE_EXTRA_CA_CERTS") bytes"
  openssl x509 -in "$NODE_EXTRA_CA_CERTS" -noout -subject -dates 2>/dev/null || echo "Invalid PEM"
else
  echo "CA file does not exist"
fi

echo ""
echo "=== SSL Inspection Check ==="
issuer=$(openssl s_client -connect api.anthropic.com:443 </dev/null 2>/dev/null | grep "issuer=" | head -1)
echo "Certificate issuer: $issuer"
```
