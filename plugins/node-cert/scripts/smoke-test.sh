#!/usr/bin/env bash
set -euo pipefail

# smoke-test.sh - Test Node.js HTTPS connectivity
#
# Quick test to verify Node.js can make HTTPS requests with current
# certificate configuration.
#
# Usage:
#   ./smoke-test.sh                    # Use default host (api.anthropic.com)
#   ./smoke-test.sh github.com         # Use specific host
#   ./smoke-test.sh --help             # Show help

# -- Configuration ------------------------------------------------------------

TARGET_HOST="${1:-api.anthropic.com}"
CA_FILE="${NODE_EXTRA_CA_CERTS:-$HOME/CAFile.pem}"

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

# -- Help ---------------------------------------------------------------------

if [[ "${1:-}" == "--help" || "${1:-}" == "-h" ]]; then
  cat <<EOF
smoke-test.sh - Test Node.js HTTPS connectivity

Usage:
  ./smoke-test.sh [HOST]       Test connectivity to HOST (default: api.anthropic.com)
  ./smoke-test.sh --help       Show this help

Tests:
  1. Node.js with current NODE_EXTRA_CA_CERTS
  2. Node.js with explicit CA file path
  3. Node.js without any CA override (baseline)

Exit codes:
  0 - All tests passed
  1 - One or more tests failed
EOF
  exit 0
fi

# -- Prerequisites ------------------------------------------------------------

if ! command -v node &>/dev/null; then
  fail "Node.js not found"
  exit 1
fi

info "Target: $TARGET_HOST"
info "CA file: ${NODE_EXTRA_CA_CERTS:-unset}"
info "Node: $(node --version)"
echo ""

# -- Test function ------------------------------------------------------------

run_node_test() {
  local ca_setting="$1"
  local description="$2"

  local result
  if [[ "$ca_setting" == "none" ]]; then
    result=$(node -e "
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
  else
    result=$(NODE_EXTRA_CA_CERTS="$ca_setting" node -e "
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
  fi

  if echo "$result" | grep -q "^HTTP"; then
    pass "$description: $result"
    return 0
  else
    fail "$description: $result"
    return 1
  fi
}

# -- Run tests ----------------------------------------------------------------

tests_passed=0
tests_failed=0

# Test 1: With current NODE_EXTRA_CA_CERTS
if [[ -n "${NODE_EXTRA_CA_CERTS:-}" ]]; then
  if run_node_test "$NODE_EXTRA_CA_CERTS" "With NODE_EXTRA_CA_CERTS=$NODE_EXTRA_CA_CERTS"; then
    tests_passed=$((tests_passed + 1))
  else
    tests_failed=$((tests_failed + 1))
  fi
else
  info "Skipping NODE_EXTRA_CA_CERTS test (not set)"
fi

# Test 2: With explicit CA file
if [[ -f "$CA_FILE" ]]; then
  if run_node_test "$CA_FILE" "With explicit CA file ($CA_FILE)"; then
    tests_passed=$((tests_passed + 1))
  else
    tests_failed=$((tests_failed + 1))
  fi
else
  info "Skipping explicit CA test (file not found: $CA_FILE)"
fi

# Test 3: Without any CA override (baseline)
info "Testing without CA override (baseline)..."
if run_node_test "none" "Without CA override"; then
  tests_passed=$((tests_passed + 1))
  warn "Node.js works WITHOUT CA override - SSL inspection may not be active"
else
  tests_failed=$((tests_failed + 1))
  info "As expected - Node.js needs CA override for this host"
fi

# -- Summary ------------------------------------------------------------------

echo ""
echo "=== Summary ==="
echo "  Passed: $tests_passed"
echo "  Failed: $tests_failed"
echo ""

if [[ $tests_failed -gt 0 ]]; then
  echo "Some tests failed. Check your certificate configuration."
  echo "Run: ./diagnose.sh for detailed diagnostics"
  exit 1
else
  echo "All applicable tests passed!"
  exit 0
fi
