---
name: node-cert
description: >
  Fix Node.js certificate trust issues behind corporate SSL-inspecting proxies.
  Use when discussing: VPN, corporate VPN, corporate proxy, SSL inspection, MITM
  proxy, TLS interception, NODE_EXTRA_CA_CERTS, self-signed certificate error,
  UNABLE_TO_VERIFY_LEAF_SIGNATURE, certificate chain, proxy CA, corporate network,
  Claude Code on VPN, Gemini CLI on VPN, npm behind proxy, Node.js certificate
  error, CAFile.pem, proxy-on, proxy-off, HTTPS_PROXY, HTTP_PROXY, openssl s_client,
  certificate extraction, corporate root CA, forward trust CA, trust store gap.
allowed-tools:
  - Bash
  - Read
  - Write
  - WebSearch
---

# Node.js Certificate Trust Expert

Fix certificate errors when Node.js tools run behind corporate SSL-inspecting proxies (Zscaler, Palo Alto, Cisco Umbrella, etc.).

## The Core Problem

Corporate proxies perform SSL/TLS inspection by:

1. Intercepting HTTPS connections
2. Decrypting traffic with their own CA
3. Re-encrypting with a corporate certificate
4. Forwarding to the destination

Node.js uses its own bundled CA store, not the system trust store. When a corporate proxy re-signs certificates, Node.js sees an untrusted issuer and fails with errors like:

- `UNABLE_TO_VERIFY_LEAF_SIGNATURE`
- `SELF_SIGNED_CERT_IN_CHAIN`
- `unable to get local issuer certificate`
- `certificate has expired` (even for valid certs)

The fix: Extract the corporate root CA and tell Node.js to trust it via `NODE_EXTRA_CA_CERTS`.

## Capabilities

| Action | What It Does |
|--------|--------------|
| **Diagnose** | Full connectivity check (VPN, DNS, SSL, env vars, CA file, Node.js test) |
| **Extract cert** | Get corporate root CA from live TLS chain using openssl |
| **Verify config** | Check env vars and CA file are correctly configured |
| **Smoke test** | Test actual Node.js HTTPS connectivity |
| **Cert info** | Display certificate details (subject, issuer, expiry) |
| **Proxy env** | Output export statements for shell configuration |
| **Toggle setup** | Generate proxy-on/off/status functions for rc file |
| **Check inspection** | Detect if SSL inspection is currently active |
| **Cert bundle** | Combine system certs + corporate CA into one bundle |
| **Export fix** | Generate portable script for teammates |

## Reference Documentation

| Topic | Reference |
|-------|-----------|
| Why Node.js fails (deep dive) | [root-cause.md](references/root-cause.md) |
| Certificate extraction procedure | [cert-extraction.md](references/cert-extraction.md) |
| Proxy environment variables | [proxy-env-vars.md](references/proxy-env-vars.md) |
| Tool-specific fixes | [tool-specific-fixes.md](references/tool-specific-fixes.md) |
| macOS/Linux/Windows specifics | [platform-guide.md](references/platform-guide.md) |
| Error messages and decision tree | [troubleshooting.md](references/troubleshooting.md) |
| Certificate rotation and bundling | [ca-bundle-management.md](references/ca-bundle-management.md) |

## Workflow

### 1. Diagnose the Problem

When a user reports certificate errors:

1. **Confirm they're on VPN/corporate network** - "Are you connected to your company VPN?"
2. **Check for SSL inspection** - "Let me check if your traffic is being inspected"
3. **Run diagnostics** - Use `/node-cert:diagnose` or the diagnose script

### 2. Extract the Certificate

If SSL inspection is detected:

1. **Read** [cert-extraction.md](references/cert-extraction.md)
2. **Run extraction** - `/node-cert:extract-cert` or `scripts/extract-cert.sh`
3. **Verify the cert** - Check it's the root CA, not intermediate

### 3. Configure Environment

Set up the environment variables:

1. **Read** [proxy-env-vars.md](references/proxy-env-vars.md)
2. **Generate shell functions** - `/node-cert:proxy-toggle-setup`
3. **Add to shell rc file** - `.zshrc`, `.bashrc`, or `.bash_profile`

### 4. Test the Fix

Verify everything works:

1. **Run smoke test** - `/node-cert:smoke-test`
2. **Test specific tools** - Claude Code, npm, git, etc.

## Scripts

Portable scripts in `scripts/` that work without the plugin:

| Script | Purpose |
|--------|---------|
| `diagnose.sh` | Full diagnostic sweep |
| `extract-cert.sh` | Extract corporate root CA |
| `smoke-test.sh` | Test Node.js HTTPS connectivity |
| `cert-info.sh` | Display certificate details |

Run with: `bash scripts/<script>.sh`

## Response Guidelines

- **Always check references first** before answering questions
- **Show commands** - users should see exactly what will run
- **Explain the why** - not just the command, but why it works
- **Platform-aware** - macOS, Linux, and Windows have differences
- **No company-specific values** - use placeholders user can customize
- **Cite sources** - reference file or external URL

## Examples

### Example 1: User Reports Certificate Error

```
User: I'm getting "UNABLE_TO_VERIFY_LEAF_SIGNATURE" when running Claude Code on my corporate VPN

Skill: This error means Node.js doesn't trust the certificate it received. Corporate proxies
often re-sign TLS traffic with their own CA, which Node.js doesn't know about.

Let me check if SSL inspection is active and extract your corporate certificate.

[Runs /node-cert:diagnose]

I can see Zscaler is intercepting your traffic. The certificate chain shows:
- api.anthropic.com
- YourCompany Forward Trust CA (intermediate)
- YourCompany Root CA (root - this is what we need)

I'll extract the root CA now...

[Runs /node-cert:extract-cert]

Done! The certificate was saved to ~/CAFile.pem. Now configure your environment:

export NODE_EXTRA_CA_CERTS=~/CAFile.pem

To make this permanent and toggleable, I can generate shell functions for your rc file.
Want me to run /node-cert:proxy-toggle-setup?
```

### Example 2: Help Teammate

```
User: My colleague is having the same VPN cert issues. Can I give them a script?

Skill: Yes! I'll generate a portable fix script they can run.

[Runs /node-cert:export-fix]

Created: ~/fix-corporate-cert.sh

This script:
1. Extracts the corporate root CA from the live TLS chain
2. Saves it to ~/CAFile.pem
3. Outputs the export statement to add to their shell

They can run it with: bash fix-corporate-cert.sh

No dependencies required beyond openssl (comes with macOS/Linux).
```

### Example 3: Debug Why Fix Stopped Working

```
User: The VPN cert fix was working yesterday, but now Claude Code is failing again

Skill: This often happens when the corporate CA rotates. Let me check...

[Runs /node-cert:cert-info ~/CAFile.pem]

Your current CA file shows:
- Subject: YourCompany Root CA
- Expires: 2024-03-15 (EXPIRED!)

The corporate CA has rotated. I'll extract the new one:

[Runs /node-cert:extract-cert]

New certificate saved. It expires 2026-01-15. Claude Code should work now.

Tip: Some companies rotate certs quarterly. If this happens often, consider
adding a weekly cron job to re-extract the cert.
```

## Allowed Tools

This skill can use:
- `Read` - to read reference files
- `Bash` - to run diagnostic and extraction scripts
- `Write` - to generate shell config and export scripts
- `WebSearch` - to research tool-specific certificate configurations
