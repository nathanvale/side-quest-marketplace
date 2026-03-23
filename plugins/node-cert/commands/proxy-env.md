---
description: Output export statements for proxy and certificate environment variables
model-invocation: disabled
argument-hint: [proxy-url]
---

# node-cert proxy-env

Output export statements for proxy and certificate environment variables.

## Usage

```
/node-cert:proxy-env [proxy-url]
```

## Arguments

- `proxy-url` - Corporate proxy URL (e.g., http://proxy.corp.com:8080)

## Instructions

Generate export statements the user can add to their shell config.

### 1. Ask for Proxy URL

If not provided, ask the user:
```
What is your corporate proxy URL?
Example: http://proxy.corp.com:8080
```

### 2. Ask for NO_PROXY Domains

Ask what domains should bypass the proxy:
```
What domains should bypass the proxy? (comma-separated)
Example: localhost,.corp.com,.internal.local
```

### 3. Generate Export Statements

```bash
# Corporate Proxy Configuration
# Add these to your ~/.zshrc or ~/.bashrc

# Proxy server
export HTTP_PROXY="http://proxy.corp.com:8080"
export HTTPS_PROXY="http://proxy.corp.com:8080"
export http_proxy="$HTTP_PROXY"
export https_proxy="$HTTPS_PROXY"

# Domains to bypass proxy
export NO_PROXY="localhost,127.0.0.1,.corp.com"
export no_proxy="$NO_PROXY"

# Node.js certificate trust
export NODE_EXTRA_CA_CERTS="$HOME/CAFile.pem"
```

### 4. Tool-Specific Variables (Optional)

If user mentions specific tools, include relevant vars:

**npm:**
```bash
export npm_config_proxy="$HTTP_PROXY"
export npm_config_https_proxy="$HTTPS_PROXY"
export npm_config_cafile="$HOME/CAFile.pem"
```

**git:**
```bash
export GIT_SSL_CAINFO="$HOME/CAFile.pem"
```

**Python/pip:**
```bash
export REQUESTS_CA_BUNDLE="$HOME/CAFile.pem"
```

### 5. Remind About CA File

After showing exports, remind:
```
Note: These exports assume you have the CA file at ~/CAFile.pem.
If you haven't extracted it yet, run: /node-cert:extract-cert
```

## Copy-Friendly Format

Present the exports in a code block for easy copy-paste:

```bash
# Paste this into your ~/.zshrc or ~/.bashrc
export HTTP_PROXY="http://proxy.corp.com:8080"
export HTTPS_PROXY="http://proxy.corp.com:8080"
export http_proxy="$HTTP_PROXY"
export https_proxy="$HTTPS_PROXY"
export NO_PROXY="localhost,127.0.0.1,.corp.com"
export no_proxy="$NO_PROXY"
export NODE_EXTRA_CA_CERTS="$HOME/CAFile.pem"
```
