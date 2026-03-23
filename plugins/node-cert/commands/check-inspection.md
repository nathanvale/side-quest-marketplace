# node-cert check-inspection

Detect if SSL/TLS inspection is active on the current network.

## Usage

```
/node-cert:check-inspection [host]
```

## Arguments

- `host` - Host to check (default: api.anthropic.com)

## Instructions

Check if the user's traffic is being SSL-inspected by examining certificate issuers.

### 1. Check Certificate Issuer

```bash
openssl s_client -connect api.anthropic.com:443 -servername api.anthropic.com </dev/null 2>/dev/null | grep -E "subject=|issuer="
```

### 2. Interpret Results

**No inspection (direct connection):**
```
subject=CN = api.anthropic.com
issuer=C = US, O = Amazon, CN = Amazon RSA 2048 M02
```
Known public CAs: Amazon, DigiCert, Let's Encrypt, Google Trust, Comodo, GlobalSign, Entrust

**SSL inspection active:**
```
subject=CN = api.anthropic.com
issuer=CN = YourCompany Forward Trust CA
```
Corporate/proxy CAs: Zscaler, Palo Alto, Fortinet, Cisco, BlueCoat, Forcepoint, McAfee, Symantec Web Gateway, or company-named CAs

### 3. Check Multiple Hosts

Some proxies bypass certain domains. Check a few:

```bash
for host in api.anthropic.com github.com registry.npmjs.org; do
  echo "$host:"
  openssl s_client -connect "$host:443" -servername "$host" </dev/null 2>/dev/null | grep "issuer=" | head -1
  echo ""
done
```

### 4. Report Findings

**If inspection detected:**
```
SSL inspection IS active on your network.

The certificate for api.anthropic.com is signed by:
  YourCompany Forward Trust CA

This means your corporate proxy is intercepting HTTPS traffic.
Node.js won't trust these certificates by default.

To fix: Run /node-cert:extract-cert to get the corporate root CA.
```

**If no inspection:**
```
SSL inspection is NOT active for api.anthropic.com.

The certificate is signed by Amazon (a public CA).
Node.js should trust this certificate without additional configuration.

If you're still seeing certificate errors, the issue may be:
- Firewall blocking the connection
- DNS resolution issues
- Network connectivity problems
```

**If mixed results:**
```
SSL inspection is PARTIAL on your network.

Inspected hosts:
- api.anthropic.com (YourCompany Forward Trust CA)
- registry.npmjs.org (YourCompany Forward Trust CA)

Bypassed hosts:
- github.com (DigiCert)

Some domains are inspected, others are not. You still need the CA file
for the inspected domains.
```
