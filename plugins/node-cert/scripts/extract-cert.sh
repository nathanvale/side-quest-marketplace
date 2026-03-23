#!/usr/bin/env bash
set -euo pipefail

# extract-cert.sh - Extract corporate root CA from live TLS chain
#
# Corporate SSL-inspecting proxies present a certificate chain like:
#   api.anthropic.com
#     -> Forward Trust CA (intermediate)
#       -> Corporate Root CA (self-signed)
#
# Node.js needs the root CA in NODE_EXTRA_CA_CERTS to trust TLS connections.
# This script extracts it from the live chain and writes it to ~/CAFile.pem.
#
# Usage:
#   ./extract-cert.sh                    # Use default host (api.anthropic.com)
#   ./extract-cert.sh github.com         # Use specific host
#   ./extract-cert.sh --help             # Show help

# -- Configuration ------------------------------------------------------------

TARGET_HOST="${1:-api.anthropic.com}"
CA_FILE="${CA_OUTPUT:-$HOME/CAFile.pem}"
CA_BACKUP="$CA_FILE.bak"

# -- Color helpers (self-contained) -------------------------------------------

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

info()    { echo -e "${BLUE}[INFO]${NC} $1"; }
pass()    { echo -e "${GREEN}[PASS]${NC} $1"; }
warn()    { echo -e "${YELLOW}[WARN]${NC} $1"; }
fail()    { echo -e "${RED}[FAIL]${NC} $1"; }

# -- Help ---------------------------------------------------------------------

if [[ "${1:-}" == "--help" || "${1:-}" == "-h" ]]; then
  cat <<EOF
extract-cert.sh - Extract corporate root CA from live TLS chain

Usage:
  ./extract-cert.sh [HOST]       Extract CA using HOST (default: api.anthropic.com)
  ./extract-cert.sh --help       Show this help

Environment:
  CA_OUTPUT    Output path for CA file (default: ~/CAFile.pem)

Examples:
  ./extract-cert.sh                          # Extract from api.anthropic.com
  ./extract-cert.sh github.com               # Extract from github.com
  CA_OUTPUT=/tmp/corp.pem ./extract-cert.sh  # Custom output path

After extraction, add to your shell config:
  export NODE_EXTRA_CA_CERTS=$CA_FILE
EOF
  exit 0
fi

# -- Pre-flight checks --------------------------------------------------------

info "Pre-flight checks..."

# Check for VPN client (informational, not blocking)
vpn_detected=""
if pgrep -q "GlobalProtect" 2>/dev/null; then
  vpn_detected="GlobalProtect"
elif pgrep -q "Cisco AnyConnect" 2>/dev/null; then
  vpn_detected="Cisco AnyConnect"
elif pgrep -q "openvpn" 2>/dev/null; then
  vpn_detected="OpenVPN"
elif pgrep -q "ZscalerTunnel" 2>/dev/null || pgrep -q "Zscaler" 2>/dev/null; then
  vpn_detected="Zscaler"
fi

if [[ -n "$vpn_detected" ]]; then
  info "VPN client detected: $vpn_detected"
else
  warn "No known VPN client detected. Proceeding anyway..."
fi

# Check DNS resolution
if ! dig +short "$TARGET_HOST" 2>/dev/null | grep -q .; then
  fail "Cannot resolve $TARGET_HOST - DNS issue?"
  exit 1
fi
info "$TARGET_HOST resolves OK"

# -- Check for SSL inspection -------------------------------------------------

info "Checking for SSL inspection..."

issuer=$(openssl s_client -connect "$TARGET_HOST:443" -servername "$TARGET_HOST" </dev/null 2>/dev/null | grep -m1 "issuer=" | sed 's/.*issuer=//' || true)

if [[ -z "$issuer" ]]; then
  fail "Could not connect to $TARGET_HOST:443"
  exit 1
fi

# Check if it's a known public CA
if echo "$issuer" | grep -qiE "amazon|digicert|let.s.encrypt|google|comodo|globalsign|entrust"; then
  warn "Certificate issuer appears to be a public CA: $issuer"
  warn "SSL inspection may not be active. Extracting anyway..."
else
  info "Certificate issuer: $issuer"
  info "SSL inspection appears to be active"
fi

# -- Extract root CA from live TLS chain --------------------------------------

info "Connecting to $TARGET_HOST to extract certificate chain..."

chain_output=$(openssl s_client \
  -connect "$TARGET_HOST:443" \
  -servername "$TARGET_HOST" \
  -showcerts </dev/null 2>/dev/null) || true

if [[ -z "$chain_output" ]]; then
  fail "Could not connect to $TARGET_HOST:443"
  exit 1
fi

# Parse all PEM certificates from the chain
certs=()
current_cert=""
in_cert=false

while IFS= read -r line; do
  if [[ "$line" == "-----BEGIN CERTIFICATE-----" ]]; then
    in_cert=true
    current_cert="$line"
  elif [[ "$line" == "-----END CERTIFICATE-----" ]]; then
    current_cert="$current_cert"$'\n'"$line"
    certs+=("$current_cert")
    current_cert=""
    in_cert=false
  elif $in_cert; then
    current_cert="$current_cert"$'\n'"$line"
  fi
done <<< "$chain_output"

cert_count=${#certs[@]}

if [[ $cert_count -eq 0 ]]; then
  fail "No certificates found in the TLS chain"
  exit 1
fi

info "Found $cert_count certificate(s) in chain"

# The last cert in the chain is typically the root CA
root_cert="${certs[$((cert_count - 1))]}"

# -- Verify extracted cert ----------------------------------------------------

info "Verifying extracted certificate..."

cert_subject=$(echo "$root_cert" | openssl x509 -noout -subject 2>/dev/null | sed 's/.*CN *= *//' || echo "unknown")
cert_issuer=$(echo "$root_cert" | openssl x509 -noout -issuer 2>/dev/null | sed 's/.*CN *= *//' || echo "unknown")
cert_dates=$(echo "$root_cert" | openssl x509 -noout -dates 2>/dev/null || echo "")
cert_start=$(echo "$cert_dates" | grep "notBefore" | sed 's/notBefore=//' || echo "unknown")
cert_end=$(echo "$cert_dates" | grep "notAfter" | sed 's/notAfter=//' || echo "unknown")

echo ""
echo "  Subject: $cert_subject"
echo "  Issuer:  $cert_issuer"
echo "  Valid:   $cert_start"
echo "  Expires: $cert_end"
echo ""

# Verify it's self-signed (subject == issuer for root CAs)
if [[ "$cert_subject" != "$cert_issuer" ]]; then
  warn "Certificate is NOT self-signed (subject != issuer)"
  warn "This may not be the root CA, but we'll use it as the best candidate."
fi

# -- Backup existing CA file --------------------------------------------------

if [[ -f "$CA_FILE" ]]; then
  existing_hash=$(shasum -a 256 "$CA_FILE" 2>/dev/null | cut -d' ' -f1 || echo "none")
  new_hash=$(echo "$root_cert" | shasum -a 256 | cut -d' ' -f1)

  if [[ "$existing_hash" == "$new_hash" ]]; then
    info "CA file already contains this certificate - no changes needed"
  else
    cp "$CA_FILE" "$CA_BACKUP"
    info "Backed up existing CA file to $CA_BACKUP"
  fi
else
  info "No existing CA file - creating new one"
fi

# -- Write new CA file --------------------------------------------------------

echo "$root_cert" > "$CA_FILE"
info "Wrote root CA to $CA_FILE ($(wc -c < "$CA_FILE" | tr -d ' ') bytes)"

# -- Node.js smoke test -------------------------------------------------------

info "Running Node.js smoke test..."

if ! command -v node &>/dev/null; then
  warn "Node.js not found - skipping smoke test"
else
  node_result=$(NODE_EXTRA_CA_CERTS="$CA_FILE" node -e "
    const https = require('https');
    const req = https.get('https://$TARGET_HOST/', (res) => {
      console.log('HTTP ' + res.statusCode);
      req.destroy();
    });
    req.on('error', (e) => {
      console.log('ERROR: ' + e.message);
    });
    req.setTimeout(10000, () => {
      console.log('ERROR: timeout');
      req.destroy();
    });
  " 2>&1)

  echo ""
  if echo "$node_result" | grep -q "^HTTP"; then
    pass "Node.js connected: $node_result"
    echo ""
    echo "  Certificate extracted successfully!"
    echo "  Add this to your shell config:"
    echo ""
    echo "    export NODE_EXTRA_CA_CERTS=$CA_FILE"
    echo ""
  else
    fail "Node.js could not connect: $node_result"
    echo ""
    echo "  The certificate was extracted but Node.js still can't connect."
    echo "  Possible causes:"
    echo "  1. The extracted cert isn't the root CA"
    echo "  2. Multiple CAs in the chain need bundling"
    echo "  3. Proxy requires additional configuration"
    echo ""
    exit 1
  fi
fi
