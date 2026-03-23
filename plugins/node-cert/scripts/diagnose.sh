#!/usr/bin/env bash
set -euo pipefail

# diagnose.sh - Diagnose Node.js certificate/proxy connectivity issues
#
# Runs a comprehensive check of your environment, network connectivity,
# and certificate configuration. Paste the output to Claude Code for analysis.
#
# Usage:
#   ./diagnose.sh                    # Use default host (api.anthropic.com)
#   ./diagnose.sh github.com         # Use specific host
#   ./diagnose.sh --help             # Show help

# -- Configuration ------------------------------------------------------------

TARGET_HOST="${1:-api.anthropic.com}"
CA_FILE="${NODE_EXTRA_CA_CERTS:-$HOME/CAFile.pem}"

# -- Help ---------------------------------------------------------------------

if [[ "${1:-}" == "--help" || "${1:-}" == "-h" ]]; then
  cat <<EOF
diagnose.sh - Diagnose Node.js certificate/proxy connectivity issues

Usage:
  ./diagnose.sh [HOST]       Run diagnostics against HOST (default: api.anthropic.com)
  ./diagnose.sh --help       Show this help

Checks:
  1. Environment variables (proxy, cert settings)
  2. VPN/proxy client detection
  3. DNS resolution
  4. Direct TLS connection (no proxy)
  5. TLS with CA file
  6. Proxy connectivity
  7. HTTPS via proxy
  8. Direct HTTPS with CA file
  9. Node.js TLS test
  10. Summary

The output can be pasted to Claude Code for analysis.
EOF
  exit 0
fi

# -- Helpers ------------------------------------------------------------------

divider() { echo ""; echo "== $1 =="; }
pass()    { echo "  [PASS] $1"; }
fail()    { echo "  [FAIL] $1"; }
info()    { echo "  [INFO] $1"; }

# -- 1. Environment -----------------------------------------------------------

divider "1. Environment"

info "Date: $(date)"
info "Shell: ${SHELL:-unknown}"
info "Node: $(node --version 2>/dev/null || echo 'not found')"
info "OpenSSL: $(openssl version 2>/dev/null || echo 'not found')"

if [[ -n "${HTTP_PROXY:-}" ]]; then
  info "HTTP_PROXY=$HTTP_PROXY"
else
  info "HTTP_PROXY=(unset)"
fi

if [[ -n "${HTTPS_PROXY:-}" ]]; then
  info "HTTPS_PROXY=$HTTPS_PROXY"
else
  info "HTTPS_PROXY=(unset)"
fi

if [[ -n "${NO_PROXY:-}" ]]; then
  info "NO_PROXY=$NO_PROXY"
else
  info "NO_PROXY=(unset)"
fi

if [[ -n "${NODE_EXTRA_CA_CERTS:-}" ]]; then
  info "NODE_EXTRA_CA_CERTS=$NODE_EXTRA_CA_CERTS"
  if [[ -f "$NODE_EXTRA_CA_CERTS" ]]; then
    pass "CA file exists ($(wc -c < "$NODE_EXTRA_CA_CERTS" | tr -d ' ') bytes)"
    # Show CA subject
    ca_subject=$(openssl x509 -in "$NODE_EXTRA_CA_CERTS" -noout -subject 2>/dev/null | sed 's/.*CN *= *//' || echo "unknown")
    info "CA Subject: $ca_subject"
    # Check expiry
    ca_end=$(openssl x509 -in "$NODE_EXTRA_CA_CERTS" -noout -enddate 2>/dev/null | sed 's/notAfter=//' || echo "unknown")
    info "CA Expires: $ca_end"
  else
    fail "CA file does not exist at $NODE_EXTRA_CA_CERTS"
  fi
else
  info "NODE_EXTRA_CA_CERTS=(unset)"
fi

# -- 2. VPN/Proxy Client Detection --------------------------------------------

divider "2. VPN/Proxy Client Detection"

vpn_found=false

if pgrep -q "GlobalProtect" 2>/dev/null; then
  pass "GlobalProtect process is running"
  vpn_found=true
fi

if pgrep -q "Cisco AnyConnect" 2>/dev/null || pgrep -q "vpnagentd" 2>/dev/null; then
  pass "Cisco AnyConnect process is running"
  vpn_found=true
fi

if pgrep -q "openvpn" 2>/dev/null; then
  pass "OpenVPN process is running"
  vpn_found=true
fi

if pgrep -q "ZscalerTunnel" 2>/dev/null || pgrep -q "Zscaler" 2>/dev/null; then
  info "Zscaler tunnel process detected"
  vpn_found=true
fi

if pgrep -q "FortiClient" 2>/dev/null || pgrep -q "forticlient" 2>/dev/null; then
  pass "FortiClient process is running"
  vpn_found=true
fi

if ! $vpn_found; then
  info "No known VPN client detected"
fi

# -- 3. DNS Resolution --------------------------------------------------------

divider "3. DNS Resolution"

if resolved_ip=$(dig +short "$TARGET_HOST" 2>/dev/null | head -1); then
  if [[ -n "$resolved_ip" ]]; then
    pass "$TARGET_HOST resolves to $resolved_ip"
  else
    fail "$TARGET_HOST did not resolve (empty response)"
  fi
else
  fail "DNS lookup failed for $TARGET_HOST"
fi

# -- 4. Direct TLS (no proxy) -------------------------------------------------

divider "4. Direct TLS to $TARGET_HOST (no proxy)"

echo "  Attempting direct connection..."
direct_tls_output=$(openssl s_client -connect "$TARGET_HOST:443" -servername "$TARGET_HOST" </dev/null 2>&1 | head -50 || true)

# Who issued the cert we received?
direct_issuer=$(echo "$direct_tls_output" | grep -m1 "issuer=" | sed 's/.*issuer=//')
if [[ -n "$direct_issuer" ]]; then
  info "Certificate issuer: $direct_issuer"
  if echo "$direct_issuer" | grep -qiE "zscaler|palo alto|fortinet|cisco|websense|bluecoat|forcepoint|mcafee|symantec web|forward trust"; then
    info "SSL inspection DETECTED - corporate proxy is intercepting traffic"
  elif echo "$direct_issuer" | grep -qiE "amazon|digicert|let.s.encrypt|google|comodo|globalsign|entrust"; then
    info "No SSL inspection detected - seeing real server certificate"
  else
    info "Unknown issuer - may or may not be inspected"
  fi
else
  fail "Could not extract certificate issuer"
fi

# Did TLS succeed?
if echo "$direct_tls_output" | grep -q "Verify return code: 0"; then
  pass "TLS handshake succeeded (system trusts this cert)"
else
  verify_code=$(echo "$direct_tls_output" | grep "Verify return code:" | head -1)
  fail "TLS handshake failed: ${verify_code:-unknown}"
fi

# -- 5. Direct TLS with CAFile ------------------------------------------------

divider "5. Direct TLS with CAFile ($CA_FILE)"

if [[ -f "$CA_FILE" ]]; then
  ca_tls_output=$(openssl s_client -connect "$TARGET_HOST:443" -servername "$TARGET_HOST" -CAfile "$CA_FILE" </dev/null 2>&1 | head -50 || true)

  if echo "$ca_tls_output" | grep -q "Verify return code: 0"; then
    pass "TLS handshake succeeded with CAFile"
  else
    verify_code=$(echo "$ca_tls_output" | grep "Verify return code:" | head -1)
    fail "TLS handshake failed even with CAFile: ${verify_code:-unknown}"
    info "You may need to combine system certs + corporate CA into one bundle"
  fi
else
  info "Skipped - CA file not found at $CA_FILE"
fi

# -- 6. Proxy Connectivity ----------------------------------------------------

divider "6. Proxy Connectivity"

if [[ -n "${HTTP_PROXY:-}" ]]; then
  # Parse proxy host and port
  proxy_url="${HTTP_PROXY#http://}"
  proxy_url="${proxy_url#https://}"
  proxy_url="${proxy_url##*@}"
  proxy_host="${proxy_url%%:*}"
  proxy_port="${proxy_url##*:}"
  proxy_port="${proxy_port%%/*}"

  if [[ -n "$proxy_host" && -n "$proxy_port" ]]; then
    if nc -z -w5 "$proxy_host" "$proxy_port" 2>/dev/null; then
      pass "Proxy $proxy_host:$proxy_port is reachable"
    else
      fail "Cannot reach proxy $proxy_host:$proxy_port"
      info "Check VPN connection or proxy settings"
    fi
  else
    fail "Could not parse proxy host:port from HTTP_PROXY"
  fi
else
  info "HTTP_PROXY not set - skipping proxy connectivity check"
fi

# -- 7. HTTPS via Proxy -------------------------------------------------------

divider "7. HTTPS to $TARGET_HOST via proxy"

if [[ -n "${HTTP_PROXY:-}" && -f "$CA_FILE" ]]; then
  proxy_curl_output=$(curl -sS -o /dev/null -w "%{http_code}" \
    --proxy "$HTTP_PROXY" \
    --cacert "$CA_FILE" \
    --max-time 10 \
    "https://$TARGET_HOST/" 2>&1) || true

  if [[ "$proxy_curl_output" =~ ^[0-9]+$ ]]; then
    if [[ "$proxy_curl_output" == "403" ]]; then
      fail "HTTP 403 - proxy may be blocking $TARGET_HOST"
    elif [[ "$proxy_curl_output" -ge 200 && "$proxy_curl_output" -lt 500 ]]; then
      pass "Got HTTP $proxy_curl_output through proxy (connection works)"
    else
      info "HTTP $proxy_curl_output through proxy"
    fi
  else
    fail "Proxy request failed: $proxy_curl_output"
  fi
else
  info "Skipped - HTTP_PROXY not set or CA file missing"
fi

# -- 8. Direct HTTPS with CAFile (no proxy) -----------------------------------

divider "8. curl direct to $TARGET_HOST (no proxy, with CAFile)"

if [[ -f "$CA_FILE" ]]; then
  direct_curl_output=$(curl -sS -o /dev/null -w "%{http_code}" \
    --noproxy "*" \
    --cacert "$CA_FILE" \
    --max-time 10 \
    "https://$TARGET_HOST/" 2>&1) || true

  if [[ "$direct_curl_output" =~ ^[0-9]+$ ]]; then
    if [[ "$direct_curl_output" -ge 200 && "$direct_curl_output" -lt 500 ]]; then
      pass "Got HTTP $direct_curl_output direct (no proxy needed for this host)"
    else
      info "HTTP $direct_curl_output direct"
    fi
  else
    fail "Direct request failed: $direct_curl_output"
  fi
else
  info "Skipped - CA file not found"
fi

# -- 9. Node.js TLS Test ------------------------------------------------------

divider "9. Node.js TLS Test"

if command -v node &>/dev/null; then
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

  if echo "$node_result" | grep -q "^HTTP"; then
    pass "Node.js connected: $node_result"
  else
    fail "Node.js failed: $node_result"
  fi
else
  fail "Node.js not found"
fi

# -- 10. Summary --------------------------------------------------------------

divider "10. Summary"

echo ""
echo "  Copy everything above and paste it to Claude Code for analysis."
echo "  It will tell you exactly what to fix."
echo ""
