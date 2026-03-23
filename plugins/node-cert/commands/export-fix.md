# node-cert export-fix

Generate a standalone portable fix script for teammates.

## Usage

```
/node-cert:export-fix [output-path]
```

## Arguments

- `output-path` - Where to save the script (default: ~/fix-corporate-cert.sh)

## Instructions

Create a self-contained script that teammates can run without installing this plugin.

### 1. Generate Script

Write a script that combines extraction + configuration in one file:

```bash
#!/usr/bin/env bash
set -euo pipefail

# fix-corporate-cert.sh - Fix Node.js certificate errors on corporate VPN
#
# This script extracts your corporate root CA and configures Node.js to trust it.
# Run this while connected to your corporate VPN.
#
# Usage:
#   bash fix-corporate-cert.sh
#
# After running, add this to your ~/.zshrc or ~/.bashrc:
#   export NODE_EXTRA_CA_CERTS=~/CAFile.pem

# -- Configuration ------------------------------------------------------------

TARGET_HOST="${TARGET_HOST:-api.anthropic.com}"
CA_FILE="$HOME/CAFile.pem"

# -- Color helpers ------------------------------------------------------------

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m'

info() { echo -e "${BLUE}[INFO]${NC} $1"; }
pass() { echo -e "${GREEN}[PASS]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
fail() { echo -e "${RED}[FAIL]${NC} $1"; }

# -- Main ---------------------------------------------------------------------

echo "=== Corporate Certificate Fix ==="
echo ""

# Check DNS
info "Checking DNS resolution..."
if ! dig +short "$TARGET_HOST" >/dev/null 2>&1; then
  fail "Cannot resolve $TARGET_HOST - are you on VPN?"
  exit 1
fi
pass "DNS OK"

# Check for inspection
info "Checking for SSL inspection..."
issuer=$(openssl s_client -connect "$TARGET_HOST:443" -servername "$TARGET_HOST" </dev/null 2>/dev/null | grep -m1 "issuer=" | sed 's/.*issuer=//')
echo "  Certificate issuer: $issuer"

if echo "$issuer" | grep -qiE "amazon|digicert|let.s.encrypt|google"; then
  warn "Traffic doesn't appear to be inspected. You may not need this fix."
  echo "  Continue anyway? (y/n)"
  read -r answer
  [[ "$answer" != "y" ]] && exit 0
fi

# Extract certificate
info "Extracting certificate chain..."
chain=$(openssl s_client -connect "$TARGET_HOST:443" -servername "$TARGET_HOST" -showcerts </dev/null 2>/dev/null)

# Parse certificates
certs=()
current=""
in_cert=false
while IFS= read -r line; do
  if [[ "$line" == "-----BEGIN CERTIFICATE-----" ]]; then
    in_cert=true
    current="$line"
  elif [[ "$line" == "-----END CERTIFICATE-----" ]]; then
    current="$current"$'\n'"$line"
    certs+=("$current")
    current=""
    in_cert=false
  elif $in_cert; then
    current="$current"$'\n'"$line"
  fi
done <<< "$chain"

if [[ ${#certs[@]} -eq 0 ]]; then
  fail "No certificates found"
  exit 1
fi

info "Found ${#certs[@]} certificate(s)"

# Use last cert (root CA)
root_cert="${certs[$((${#certs[@]} - 1))]}"

# Verify
subject=$(echo "$root_cert" | openssl x509 -noout -subject 2>/dev/null | sed 's/.*CN *= *//')
echo "  Root CA: $subject"

# Write
echo "$root_cert" > "$CA_FILE"
pass "Saved to $CA_FILE"

# Test
info "Testing Node.js..."
result=$(NODE_EXTRA_CA_CERTS="$CA_FILE" node -e "
require('https').get('https://$TARGET_HOST/', r => {
  console.log('HTTP ' + r.statusCode);
  process.exit(0);
}).on('error', e => {
  console.log('ERROR: ' + e.message);
  process.exit(1);
});
" 2>&1) || true

if echo "$result" | grep -q "^HTTP"; then
  pass "Node.js connected: $result"
else
  fail "Node.js failed: $result"
  exit 1
fi

# Instructions
echo ""
echo "=== Success! ==="
echo ""
echo "Add this to your ~/.zshrc or ~/.bashrc:"
echo ""
echo "  export NODE_EXTRA_CA_CERTS=~/CAFile.pem"
echo ""
echo "Then restart your terminal or run: source ~/.zshrc"
```

### 2. Write the Script

```bash
OUTPUT="${1:-$HOME/fix-corporate-cert.sh}"
# Write the script content above to $OUTPUT
chmod +x "$OUTPUT"
```

### 3. Provide Instructions

After generating:

```
Created: ~/fix-corporate-cert.sh

Share this script with teammates who have the same VPN setup.

They can run it with:
  bash ~/fix-corporate-cert.sh

Requirements:
  - Connected to corporate VPN
  - Node.js installed
  - openssl installed (comes with macOS/Linux)

The script will:
  1. Check for SSL inspection
  2. Extract the corporate root CA
  3. Save it to ~/CAFile.pem
  4. Test Node.js connectivity
  5. Show the export command to add to shell config
```

## Customization

If the user's company uses a different target host or has specific requirements:

```bash
# Use different host for extraction
TARGET_HOST=internal.corp.com bash fix-corporate-cert.sh

# Custom CA path
CA_FILE=/custom/path/cert.pem bash fix-corporate-cert.sh
```
