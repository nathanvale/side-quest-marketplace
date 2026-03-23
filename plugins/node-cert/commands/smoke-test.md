---
description: Test Node.js HTTPS connectivity with current configuration
argument-hint: [host]
---

# node-cert smoke-test

Test Node.js HTTPS connectivity with current configuration.

## Usage

```
/node-cert:smoke-test [host]
```

## Arguments

- `host` - Target host to test (default: api.anthropic.com)

## Instructions

Run the smoke test script at `scripts/smoke-test.sh` which performs three tests:

### Test 1: With Current NODE_EXTRA_CA_CERTS

Tests using the currently set environment variable (if set).

### Test 2: With Explicit CA File

Tests with `~/CAFile.pem` explicitly, regardless of env var.

### Test 3: Without CA Override (Baseline)

Tests Node.js without any CA configuration to establish baseline.

## Interpreting Results

### All Tests Pass
```
[PASS] With NODE_EXTRA_CA_CERTS=~/CAFile.pem: HTTP 200
[PASS] With explicit CA file: HTTP 200
[WARN] Node.js works WITHOUT CA override - SSL inspection may not be active
```
If baseline passes, SSL inspection may not be active for this host.

### CA Tests Pass, Baseline Fails
```
[PASS] With NODE_EXTRA_CA_CERTS=~/CAFile.pem: HTTP 200
[PASS] With explicit CA file: HTTP 200
[FAIL] Without CA override: ERROR: unable to verify the first certificate
```
This is expected behind SSL inspection. Configuration is correct.

### All Tests Fail
```
[FAIL] With NODE_EXTRA_CA_CERTS: ERROR: unable to verify the first certificate
[FAIL] With explicit CA file: ERROR: unable to verify the first certificate
[FAIL] Without CA override: ERROR: unable to verify the first certificate
```
The CA file may be:
- Wrong certificate (intermediate instead of root)
- Expired
- For a different proxy

Run `/node-cert:cert-info` to check the certificate, then `/node-cert:extract-cert` to re-extract.

## Quick Manual Test

```bash
# Test with CA file
NODE_EXTRA_CA_CERTS=~/CAFile.pem node -e "
require('https').get('https://api.anthropic.com/', r => console.log('HTTP', r.statusCode))
"

# Test without (should fail if inspection active)
node -e "
require('https').get('https://api.anthropic.com/', r => console.log('HTTP', r.statusCode))
"
```
