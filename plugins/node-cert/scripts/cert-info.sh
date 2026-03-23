#!/usr/bin/env bash
set -euo pipefail

# cert-info.sh - Display certificate details
#
# Shows subject, issuer, validity dates, fingerprint, and other details
# for a PEM certificate file.
#
# Usage:
#   ./cert-info.sh                    # Use ~/CAFile.pem
#   ./cert-info.sh /path/to/cert.pem  # Use specific file
#   ./cert-info.sh --help             # Show help

# -- Configuration ------------------------------------------------------------

CERT_FILE="${1:-${NODE_EXTRA_CA_CERTS:-$HOME/CAFile.pem}}"

# -- Color helpers ------------------------------------------------------------

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

info()  { echo -e "${BLUE}[INFO]${NC} $1"; }
pass()  { echo -e "${GREEN}[PASS]${NC} $1"; }
warn()  { echo -e "${YELLOW}[WARN]${NC} $1"; }
fail()  { echo -e "${RED}[FAIL]${NC} $1"; }
label() { echo -e "${CYAN}$1${NC}"; }

# -- Help ---------------------------------------------------------------------

if [[ "${1:-}" == "--help" || "${1:-}" == "-h" ]]; then
  cat <<EOF
cert-info.sh - Display certificate details

Usage:
  ./cert-info.sh [FILE]        Show details for FILE (default: ~/CAFile.pem)
  ./cert-info.sh --help        Show this help

Output:
  - Subject (who the cert is for)
  - Issuer (who signed it)
  - Validity dates
  - Whether it's self-signed (root CA)
  - SHA-256 fingerprint
  - Key type and size
  - Basic constraints (CA flag)
EOF
  exit 0
fi

# -- Check file exists --------------------------------------------------------

if [[ ! -f "$CERT_FILE" ]]; then
  fail "Certificate file not found: $CERT_FILE"
  echo ""
  echo "If you haven't extracted the certificate yet, run:"
  echo "  ./extract-cert.sh"
  exit 1
fi

info "Reading: $CERT_FILE"
echo ""

# -- Parse certificate --------------------------------------------------------

# Basic info
subject=$(openssl x509 -in "$CERT_FILE" -noout -subject 2>/dev/null | sed 's/^subject=//')
issuer=$(openssl x509 -in "$CERT_FILE" -noout -issuer 2>/dev/null | sed 's/^issuer=//')

# Dates
dates=$(openssl x509 -in "$CERT_FILE" -noout -dates 2>/dev/null)
not_before=$(echo "$dates" | grep "notBefore" | sed 's/notBefore=//')
not_after=$(echo "$dates" | grep "notAfter" | sed 's/notAfter=//')

# Fingerprint
fingerprint=$(openssl x509 -in "$CERT_FILE" -noout -sha256 -fingerprint 2>/dev/null | sed 's/.*=//')

# Key info
pubkey_info=$(openssl x509 -in "$CERT_FILE" -noout -text 2>/dev/null | grep -A1 "Public Key Algorithm" | head -2 || true)
key_algo=$(echo "$pubkey_info" | grep "Public Key Algorithm" | sed 's/.*: //' || true)
key_size=$(openssl x509 -in "$CERT_FILE" -noout -text 2>/dev/null | grep -E "RSA Public-Key:|EC Public-Key:" | head -1 | grep -oE '\([0-9]+ bit\)' || true)

# CA flag
is_ca=$(openssl x509 -in "$CERT_FILE" -noout -text 2>/dev/null | grep -A1 "Basic Constraints" | grep "CA:" 2>/dev/null || true)

# Serial
serial=$(openssl x509 -in "$CERT_FILE" -noout -serial 2>/dev/null | sed 's/serial=//')

# -- Display info -------------------------------------------------------------

label "Subject:"
echo "  $subject"
echo ""

label "Issuer:"
echo "  $issuer"
echo ""

# Check if self-signed
subject_cn=$(echo "$subject" | sed 's/.*CN *= *//' | sed 's/,.*//')
issuer_cn=$(echo "$issuer" | sed 's/.*CN *= *//' | sed 's/,.*//')
if [[ "$subject_cn" == "$issuer_cn" ]]; then
  echo -e "  ${GREEN}(Self-signed - this is a ROOT CA)${NC}"
else
  echo -e "  ${YELLOW}(NOT self-signed - this may be an intermediate CA)${NC}"
fi
echo ""

label "Validity:"
echo "  From:  $not_before"
echo "  Until: $not_after"

# Check if expired
end_epoch=$(date -j -f "%b %d %T %Y %Z" "$not_after" +%s 2>/dev/null || date -d "$not_after" +%s 2>/dev/null || echo "0")
now_epoch=$(date +%s)
if [[ "$end_epoch" -lt "$now_epoch" ]]; then
  echo -e "  ${RED}STATUS: EXPIRED${NC}"
else
  days_left=$(( (end_epoch - now_epoch) / 86400 ))
  if [[ $days_left -lt 30 ]]; then
    echo -e "  ${YELLOW}STATUS: Valid ($days_left days remaining - expires soon!)${NC}"
  else
    echo -e "  ${GREEN}STATUS: Valid ($days_left days remaining)${NC}"
  fi
fi
echo ""

label "Certificate Type:"
if [[ -n "$is_ca" ]]; then
  if echo "$is_ca" | grep -q "CA:TRUE"; then
    echo -e "  ${GREEN}CA Certificate (can sign other certificates)${NC}"
  else
    echo "  End-entity certificate (leaf)"
  fi
else
  echo "  Unknown (no Basic Constraints extension)"
fi
echo ""

label "Key:"
echo "  Algorithm: ${key_algo:-unknown}"
echo "  Size: ${key_size:-unknown}"
echo ""

label "Fingerprint (SHA-256):"
echo "  $fingerprint"
echo ""

label "Serial Number:"
echo "  $serial"
echo ""

# -- File info ----------------------------------------------------------------

label "File:"
file_size=$(wc -c < "$CERT_FILE" | tr -d ' ')
echo "  Path: $CERT_FILE"
echo "  Size: $file_size bytes"

# Count certificates in file (some bundles have multiple)
cert_count=$(grep -c "BEGIN CERTIFICATE" "$CERT_FILE" 2>/dev/null || echo "0")
if [[ "$cert_count" -gt 1 ]]; then
  echo -e "  ${YELLOW}Contains $cert_count certificates (bundle)${NC}"
else
  echo "  Contains 1 certificate"
fi
