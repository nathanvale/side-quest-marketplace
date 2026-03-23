# Tool-Specific Certificate Fixes

Configuration for common tools that need certificate trust.

## Claude Code

Claude Code uses Node.js for API calls.

**Fix:**
```bash
export NODE_EXTRA_CA_CERTS=~/CAFile.pem
```

**Verification:**
```bash
claude --version  # Should complete without certificate errors
```

**GUI Launch Issue:**
If launching from Finder/Spotlight, GUI apps don't inherit shell env vars.

Solutions:
1. Launch from terminal: `open -a "Visual Studio Code"` then use Claude in VS Code
2. Add to `~/.zshenv` (loaded by all zsh sessions including GUI apps)
3. Configure in VS Code: `terminal.integrated.env.osx`

## Gemini CLI

Similar to Claude Code - uses Node.js.

**Fix:**
```bash
export NODE_EXTRA_CA_CERTS=~/CAFile.pem
```

## npm

npm has its own certificate configuration.

**Environment variables:**
```bash
export NODE_EXTRA_CA_CERTS=~/CAFile.pem
```

**npm config (persistent):**
```bash
npm config set cafile ~/CAFile.pem
npm config set strict-ssl true  # Keep validation enabled
```

**Verify:**
```bash
npm config get cafile
npm ping  # Should succeed
```

**Project-level .npmrc:**
```ini
cafile=/Users/you/CAFile.pem
```

**Anti-pattern (don't do this):**
```bash
# DON'T disable SSL verification
npm config set strict-ssl false  # INSECURE
```

## Yarn

**Yarn 1.x:**
```bash
yarn config set cafile ~/CAFile.pem
```

**Yarn 2+/Berry:**
```yaml
# .yarnrc.yml
httpsCaFilePath: ~/CAFile.pem
```

## pnpm

pnpm respects `NODE_EXTRA_CA_CERTS`:
```bash
export NODE_EXTRA_CA_CERTS=~/CAFile.pem
```

Or configure directly:
```bash
pnpm config set ca-file ~/CAFile.pem
```

## git

git uses system OpenSSL/LibreSSL for HTTPS.

**Environment variable:**
```bash
export GIT_SSL_CAINFO=~/CAFile.pem
```

**git config (persistent):**
```bash
git config --global http.sslCAInfo ~/CAFile.pem
```

**Per-repository:**
```bash
git config http.sslCAInfo ~/CAFile.pem
```

**Verify:**
```bash
git ls-remote https://github.com/anthropics/anthropic-sdk-python.git
```

**Anti-pattern:**
```bash
# DON'T disable SSL verification
git config --global http.sslVerify false  # INSECURE
```

## GitHub CLI (gh)

gh uses git's HTTPS settings:
```bash
export GIT_SSL_CAINFO=~/CAFile.pem
```

Or it may need proxy settings disabled when off VPN:
```bash
unset HTTP_PROXY HTTPS_PROXY
gh pr list
```

## pip (Python)

**Environment variable:**
```bash
export REQUESTS_CA_BUNDLE=~/CAFile.pem
export SSL_CERT_FILE=~/CAFile.pem
```

**pip config (persistent):**
```bash
pip config set global.cert ~/CAFile.pem
```

**Per-command:**
```bash
pip install --cert ~/CAFile.pem requests
```

**Verify:**
```bash
pip config get global.cert
pip install --dry-run requests  # Should not error on cert
```

## conda

```bash
conda config --set ssl_verify ~/CAFile.pem
```

## curl

**Environment variable:**
```bash
export CURL_CA_BUNDLE=~/CAFile.pem
```

**~/.curlrc:**
```
cacert = /Users/you/CAFile.pem
```

**Per-command:**
```bash
curl --cacert ~/CAFile.pem https://api.anthropic.com/
```

## wget

**~/.wgetrc:**
```
ca_certificate = /Users/you/CAFile.pem
```

**Per-command:**
```bash
wget --ca-certificate=~/CAFile.pem https://example.com/
```

## Docker

Docker daemon uses system certs. For builds:

**Dockerfile:**
```dockerfile
# Copy CA into image
COPY CAFile.pem /usr/local/share/ca-certificates/corporate-ca.crt
RUN update-ca-certificates

# For Node.js specifically
ENV NODE_EXTRA_CA_CERTS=/usr/local/share/ca-certificates/corporate-ca.crt
```

**docker-compose.yml:**
```yaml
services:
  app:
    environment:
      - NODE_EXTRA_CA_CERTS=/certs/CAFile.pem
    volumes:
      - ~/CAFile.pem:/certs/CAFile.pem:ro
```

## Homebrew

Homebrew uses curl:
```bash
export HOMEBREW_CURL_PATH=$(which curl)  # Use system curl
export CURL_CA_BUNDLE=~/CAFile.pem
```

Or configure curl globally (see curl section).

## VS Code Extensions

Extensions run in Node.js:
```json
// settings.json
{
  "terminal.integrated.env.osx": {
    "NODE_EXTRA_CA_CERTS": "~/CAFile.pem"
  }
}
```

## JetBrains IDEs

**Preferences > Tools > Server Certificates:**
- Add corporate CA to "Accepted certificates"

Or use JVM trust store:
```bash
keytool -importcert -file ~/CAFile.pem -keystore $JAVA_HOME/lib/security/cacerts -alias corporate-ca
```

## AWS CLI

```bash
export AWS_CA_BUNDLE=~/CAFile.pem
```

Or in `~/.aws/config`:
```ini
[default]
ca_bundle = /Users/you/CAFile.pem
```

## Azure CLI

```bash
export REQUESTS_CA_BUNDLE=~/CAFile.pem
```

## Terraform

```bash
export SSL_CERT_FILE=~/CAFile.pem
```

## Summary Table

| Tool | Environment Variable | Config Command/File |
|------|---------------------|---------------------|
| Node.js | `NODE_EXTRA_CA_CERTS` | - |
| npm | `NODE_EXTRA_CA_CERTS` | `npm config set cafile` |
| yarn | `NODE_EXTRA_CA_CERTS` | `yarn config set cafile` |
| git | `GIT_SSL_CAINFO` | `git config http.sslCAInfo` |
| pip | `REQUESTS_CA_BUNDLE` | `pip config set global.cert` |
| curl | `CURL_CA_BUNDLE` | `~/.curlrc` |
| Docker | - | Dockerfile `COPY` + `update-ca-certificates` |
| AWS CLI | `AWS_CA_BUNDLE` | `~/.aws/config` |
