# Platform-Specific Guide

Certificate handling differences across macOS, Linux, and Windows.

## macOS

### System Trust Store

**Location:** Keychain Access app

**View trusted CAs:**
```bash
security find-certificate -a -p /System/Library/Keychains/SystemRootCertificates.keychain
```

**Export all system CAs:**
```bash
security find-certificate -a -p /System/Library/Keychains/SystemRootCertificates.keychain > ~/system-ca.pem
```

**Add CA to system trust (requires admin):**
```bash
sudo security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain ~/CAFile.pem
```

Note: Adding to system Keychain makes it trusted system-wide, but Node.js still needs `NODE_EXTRA_CA_CERTS`.

### OpenSSL Location

**Homebrew OpenSSL:**
```bash
# Cert directory
/opt/homebrew/etc/openssl@3/certs/

# CA bundle
/opt/homebrew/etc/openssl@3/cert.pem
```

**System LibreSSL:**
```bash
# Uses Keychain, not file-based certs
/usr/bin/openssl version  # LibreSSL
```

### Common VPN Clients

| Client | Process Name | Detection |
|--------|-------------|-----------|
| GlobalProtect | `GlobalProtect` | `pgrep GlobalProtect` |
| Cisco AnyConnect | `vpnagentd` | `pgrep vpnagentd` |
| Zscaler | `ZscalerTunnel` | `pgrep Zscaler` |
| FortiClient | `FortiClient` | `pgrep FortiClient` |

### Shell Config Files

| Shell | File | When Loaded |
|-------|------|-------------|
| zsh | `~/.zshrc` | Interactive shells |
| zsh | `~/.zshenv` | ALL shells (including GUI apps) |
| zsh | `~/.zprofile` | Login shells |
| bash | `~/.bashrc` | Interactive non-login |
| bash | `~/.bash_profile` | Login shells |

For GUI apps to inherit env vars, use `~/.zshenv`.

### Launching Apps with Environment

```bash
# Launch VS Code with current env
open -a "Visual Studio Code"

# Or explicitly
env NODE_EXTRA_CA_CERTS=~/CAFile.pem open -a "Visual Studio Code"
```

## Linux

### System Trust Store

**Debian/Ubuntu:**
```bash
# CA directory
/usr/share/ca-certificates/

# Combined bundle
/etc/ssl/certs/ca-certificates.crt

# Add CA
sudo cp ~/CAFile.pem /usr/local/share/ca-certificates/corporate-ca.crt
sudo update-ca-certificates
```

**RHEL/CentOS/Fedora:**
```bash
# CA directory
/etc/pki/ca-trust/source/anchors/

# Combined bundle
/etc/pki/tls/certs/ca-bundle.crt

# Add CA
sudo cp ~/CAFile.pem /etc/pki/ca-trust/source/anchors/corporate-ca.pem
sudo update-ca-trust
```

**Alpine:**
```bash
# Combined bundle
/etc/ssl/cert.pem

# Add CA
cp ~/CAFile.pem /usr/local/share/ca-certificates/corporate-ca.crt
update-ca-certificates
```

### OpenSSL Location

```bash
openssl version -d  # Shows OPENSSLDIR

# Typically
/etc/ssl/           # Debian/Ubuntu
/etc/pki/tls/       # RHEL/Fedora
```

### Shell Config Files

```bash
~/.bashrc           # Interactive bash
~/.bash_profile     # Login bash
~/.profile          # Login sh/bash
/etc/environment    # System-wide env vars
```

### systemd Services

For services managed by systemd:
```ini
# /etc/systemd/system/myservice.service.d/override.conf
[Service]
Environment="NODE_EXTRA_CA_CERTS=/path/to/CAFile.pem"
```

Then:
```bash
sudo systemctl daemon-reload
sudo systemctl restart myservice
```

## Windows

### System Trust Store

**Location:** Certificate Manager (`certmgr.msc`)

**Add CA via GUI:**
1. Run `certmgr.msc`
2. Right-click "Trusted Root Certification Authorities"
3. All Tasks > Import
4. Select PEM file

**Add CA via PowerShell:**
```powershell
Import-Certificate -FilePath "C:\path\to\CAFile.pem" -CertStoreLocation Cert:\LocalMachine\Root
```

### Environment Variables

**User-level (persists):**
```powershell
[Environment]::SetEnvironmentVariable("NODE_EXTRA_CA_CERTS", "C:\Users\you\CAFile.pem", "User")
```

**Session-level:**
```powershell
$env:NODE_EXTRA_CA_CERTS = "C:\Users\you\CAFile.pem"
```

**System-level (requires admin):**
```powershell
[Environment]::SetEnvironmentVariable("NODE_EXTRA_CA_CERTS", "C:\certs\CAFile.pem", "Machine")
```

### Shell Config

**PowerShell profile:**
```powershell
# $PROFILE typically at:
# C:\Users\you\Documents\PowerShell\Microsoft.PowerShell_profile.ps1

$env:NODE_EXTRA_CA_CERTS = "$HOME\CAFile.pem"
```

**Git Bash:**
Uses `~/.bashrc` like Linux.

### WSL (Windows Subsystem for Linux)

WSL is essentially Linux:
```bash
# In WSL terminal
export NODE_EXTRA_CA_CERTS=~/CAFile.pem
```

To access Windows cert from WSL:
```bash
export NODE_EXTRA_CA_CERTS=/mnt/c/Users/you/CAFile.pem
```

## Docker / Containers

### Base Image Trust Store

**Alpine:**
```dockerfile
COPY CAFile.pem /usr/local/share/ca-certificates/corporate-ca.crt
RUN update-ca-certificates
```

**Debian/Ubuntu:**
```dockerfile
COPY CAFile.pem /usr/local/share/ca-certificates/corporate-ca.crt
RUN update-ca-certificates
```

**Node.js specific:**
```dockerfile
ENV NODE_EXTRA_CA_CERTS=/app/certs/CAFile.pem
COPY CAFile.pem /app/certs/
```

### Build-time vs Run-time

**Build-time (for npm install):**
```dockerfile
ARG NODE_EXTRA_CA_CERTS=/certs/CAFile.pem
COPY CAFile.pem /certs/
RUN npm ci
```

**Run-time:**
```yaml
# docker-compose.yml
services:
  app:
    environment:
      - NODE_EXTRA_CA_CERTS=/certs/CAFile.pem
    volumes:
      - ./CAFile.pem:/certs/CAFile.pem:ro
```

## CI/CD Environments

### GitHub Actions

```yaml
env:
  NODE_EXTRA_CA_CERTS: ${{ github.workspace }}/certs/CAFile.pem

steps:
  - name: Add corporate CA
    run: |
      mkdir -p certs
      echo "${{ secrets.CORPORATE_CA }}" > certs/CAFile.pem
```

### GitLab CI

```yaml
variables:
  NODE_EXTRA_CA_CERTS: "$CI_PROJECT_DIR/certs/CAFile.pem"

before_script:
  - mkdir -p certs
  - echo "$CORPORATE_CA" > certs/CAFile.pem
```

### Jenkins

```groovy
environment {
    NODE_EXTRA_CA_CERTS = "${WORKSPACE}/certs/CAFile.pem"
}
```

## Summary: Where to Configure

| Context | macOS | Linux | Windows |
|---------|-------|-------|---------|
| Terminal only | `~/.zshrc` | `~/.bashrc` | PowerShell profile |
| All shells | `~/.zshenv` | `~/.profile` | System env var |
| GUI apps | `~/.zshenv` | N/A | System env var |
| System service | launchd plist | systemd override | Service properties |
| Docker | Dockerfile ENV | Dockerfile ENV | Dockerfile ENV |
