# CA Bundle Management

Certificate rotation, bundling, and automation strategies.

## Certificate Lifecycle

Corporate certificates typically:
- **Validity:** 1-3 years
- **Rotation:** Annual or when security policy changes
- **Distribution:** Pushed via MDM, GPO, or manual

## Detecting Certificate Changes

### Check Current vs Extracted

```bash
# Current CA file fingerprint
current=$(openssl x509 -in ~/CAFile.pem -noout -sha256 -fingerprint 2>/dev/null | sed 's/.*=//')

# Freshly extracted fingerprint
new=$(openssl s_client -connect api.anthropic.com:443 -showcerts </dev/null 2>/dev/null | \
  awk '/BEGIN CERTIFICATE/,/END CERTIFICATE/' | \
  tail -n +1 | \
  openssl x509 -noout -sha256 -fingerprint 2>/dev/null | sed 's/.*=//')

if [[ "$current" != "$new" ]]; then
  echo "Certificate has changed! Re-extraction needed."
else
  echo "Certificate unchanged."
fi
```

### Check Expiry

```bash
# Days until expiry
expiry=$(openssl x509 -in ~/CAFile.pem -noout -enddate | sed 's/notAfter=//')
expiry_epoch=$(date -j -f "%b %d %T %Y %Z" "$expiry" +%s 2>/dev/null || date -d "$expiry" +%s)
now_epoch=$(date +%s)
days_left=$(( (expiry_epoch - now_epoch) / 86400 ))

echo "Certificate expires in $days_left days"

if [[ $days_left -lt 30 ]]; then
  echo "WARNING: Certificate expiring soon!"
fi
```

## Automated Re-extraction

### Cron Job (Weekly)

```bash
# Add to crontab: crontab -e
# Run every Monday at 9am
0 9 * * 1 /path/to/extract-cert.sh 2>&1 | logger -t cert-refresh
```

### launchd (macOS)

```xml
<!-- ~/Library/LaunchAgents/com.user.cert-refresh.plist -->
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.user.cert-refresh</string>
    <key>ProgramArguments</key>
    <array>
        <string>/Users/you/scripts/extract-cert.sh</string>
    </array>
    <key>StartCalendarInterval</key>
    <dict>
        <key>Weekday</key>
        <integer>1</integer>
        <key>Hour</key>
        <integer>9</integer>
    </dict>
    <key>StandardOutPath</key>
    <string>/tmp/cert-refresh.log</string>
    <key>StandardErrorPath</key>
    <string>/tmp/cert-refresh.log</string>
</dict>
</plist>
```

Load with:
```bash
launchctl load ~/Library/LaunchAgents/com.user.cert-refresh.plist
```

## Certificate Bundling

### When to Bundle

Single CA file works when:
- Proxy provides full certificate chain
- Target servers have complete chains

Bundle needed when:
- `unable to get issuer certificate` error persists
- Proxy sends incomplete chain
- Tool requires full chain validation

### Create Bundle: System + Corporate

**macOS:**
```bash
# Export system certs
security find-certificate -a -p /System/Library/Keychains/SystemRootCertificates.keychain > /tmp/system-ca.pem

# Combine
cat /tmp/system-ca.pem ~/CAFile.pem > ~/ca-bundle.pem

# Use bundle
export NODE_EXTRA_CA_CERTS=~/ca-bundle.pem
```

**Linux:**
```bash
# System bundle location varies
cat /etc/ssl/certs/ca-certificates.crt ~/CAFile.pem > ~/ca-bundle.pem
```

### Verify Bundle

```bash
# Count certificates
grep -c "BEGIN CERTIFICATE" ~/ca-bundle.pem

# Test with openssl
openssl s_client -connect api.anthropic.com:443 -CAfile ~/ca-bundle.pem </dev/null 2>/dev/null | grep "Verify return code"

# Test with Node.js
NODE_EXTRA_CA_CERTS=~/ca-bundle.pem node -e "require('https').get('https://api.anthropic.com/', r => console.log(r.statusCode))"
```

## Multiple Certificates

If your organization has multiple CAs (e.g., different proxies for different regions):

### Concatenate PEM Files

```bash
cat corporate-ca-1.pem corporate-ca-2.pem > ~/CAFile.pem
```

PEM format supports multiple certificates in one file.

### Verify All Certs in Bundle

```bash
# List all subjects in a bundle
openssl crl2pkcs7 -nocrl -certfile ~/CAFile.pem | openssl pkcs7 -print_certs -noout
```

## Backup Strategy

### Before Extraction

The `extract-cert.sh` script automatically backs up:
```
~/CAFile.pem      # Current
~/CAFile.pem.bak  # Previous
```

### Manual Backup

```bash
# Date-stamped backup
cp ~/CAFile.pem ~/CAFile.pem.$(date +%Y%m%d)
```

### Restore Previous

```bash
cp ~/CAFile.pem.bak ~/CAFile.pem
```

## Troubleshooting Rotation

### "Certificate was working, now fails"

1. **Check expiry:**
   ```bash
   openssl x509 -in ~/CAFile.pem -noout -dates
   ```

2. **Compare with current chain:**
   ```bash
   openssl s_client -connect api.anthropic.com:443 -showcerts </dev/null 2>/dev/null | grep "subject="
   ```

3. **Re-extract if different:**
   ```bash
   ./extract-cert.sh
   ```

### "New cert extracted but still fails"

The proxy might now use an intermediate CA. Try bundling:

```bash
# Extract ALL certs from chain (not just root)
openssl s_client -connect api.anthropic.com:443 -showcerts </dev/null 2>/dev/null | \
  awk '/BEGIN CERTIFICATE/,/END CERTIFICATE/' > ~/CAFile.pem
```

### "Works for some hosts, not others"

Different hosts may have different inspection policies:

```bash
# Check which hosts are inspected
for host in api.anthropic.com github.com internal.corp.com; do
  echo -n "$host: "
  openssl s_client -connect $host:443 </dev/null 2>/dev/null | grep "issuer=" | head -1
done
```

You may need different CA files for different hosts, or a combined bundle.

## Best Practices

1. **Don't commit CA files to git** - Add to `.gitignore`
2. **Document the extraction process** - Others may need to do it
3. **Monitor expiry dates** - Set calendar reminders
4. **Test after VPN updates** - IT changes can affect certs
5. **Keep backups** - Certificate rotation can be disruptive
6. **Verify before trusting** - Confirm cert came from your proxy
