---
name: env-manager
description: |
  This skill provides knowledge for managing environment variables in the dotfiles repository.
  It should be used when the user asks about API keys, secrets, environment variables, .env files,
  or 1Password integration. Triggers include: "add env", "addenv", "environment variable", "API key",
  "secret", "syncenv", "lsenv", ".env", "1Password", "expiry", "token management", "provider".
---

# Environment Variable Manager

This skill documents the CLI-based environment variable management system that integrates with 1Password for secure secret storage and synchronization.

## Architecture: Pattern C (1Password is Truth, .env is Cache)

```
addenv KEY "value" -p provider [-u url] [-e expiry]
                    ↓
              ┌─────┴─────┐
              ▼           ▼
         1Password    .env (regenerated)
         (source)     (cache)
         [tags]       [comments]
              │           │
              └─────┬─────┘
                    ▼
              syncenv (pulls from 1Password → regenerates .env)
```

**Key principles:**
- 1Password is the single source of truth
- The `.env` file is a generated cache that can be regenerated at any time
- **Provider is MANDATORY** (`-p` flag) - all keys must be tagged for easy grouping

## Available Commands

All commands are located in `bin/env/` and added to PATH via `.zshrc`.

### addenv - Add/Update Environment Variables

```bash
addenv KEY_NAME "value" -p|--provider <name> [-u|--url <url>] [-e|--expiry <date>]
```

**Arguments:**
- `KEY_NAME` - Environment variable name (UPPERCASE_WITH_UNDERSCORES)
- `value` - The secret value

**Required Flags:**
- `-p, --provider <name>` - Provider name (e.g., openai, stripe, tavily)

**Optional Flags:**
- `-u, --url <url>` - URL where to get/regenerate this key
- `-e, --expiry <date>` - Expiration date (YYYY-MM-DD) or relative (30d, 6m, 1y)
- `-h, --help` - Show help message

**Examples:**
```bash
# Full example with all options
addenv OPENAI_API_KEY "sk-xxx" -p openai -u "https://platform.openai.com/api-keys" -e 1y

# With provider and URL only
addenv STRIPE_KEY "sk_live_xxx" --provider stripe --url "https://dashboard.stripe.com/apikeys"

# With provider and expiry only
addenv TAVILY_API_KEY "tvly-xxx" -p tavily -e 90d

# Minimal (just provider required)
addenv MY_SECRET "secretvalue" -p internal

# Multiple keys from same provider
addenv OPENAI_API_KEY_PROD "sk-prod-xxx" -p openai -u "https://platform.openai.com/api-keys" -e 1y
addenv OPENAI_API_KEY_DEV "sk-dev-xxx" -p openai -u "https://platform.openai.com/api-keys" -e 1y
```

### syncenv - Sync from 1Password to .env

```bash
syncenv [--dry-run]
```

**Options:**
- `--dry-run` - Show what would be done without making changes
- `-h, --help` - Show help message

**Purpose:** Regenerates `.env` file from 1Password vault and syncs to launchctl for GUI apps.

**Use cases:**
- New machine setup
- After manually editing 1Password
- Refreshing .env after credential rotation

### lsenv - List Environment Variables

```bash
lsenv [-v|--verbose] [-p|--provider <name>] [--providers]
```

**Options:**
- `-v, --verbose` - Show provider, expiry, and last modified dates
- `-p, --provider <name>` - Filter keys by provider (e.g., openai, stripe)
- `--providers` - List all unique providers with key counts
- `-h, --help` - Show help message

**Simple output:**
```
Environment variables in 1Password (Dotfiles):
  CLAUDE_API_KEY
  FIRECRAWL_API_KEY
  NPM_TOKEN
Total: 3 keys (source: 1Password)
```

**Verbose output (`-v`):**
```
KEY                       PROVIDER        EXPIRES      LAST MODIFIED
---                       --------        -------      -------------
CLAUDE_API_KEY            anthropic       -            2025-11-22
NPM_TOKEN                 npm             2025-12-31   2025-11-22
GEMINI_API_KEY            google          2025-12-15   2025-11-22      ← yellow (expiring soon)
TAVILY_API_KEY            tavily          2025-11-01   2025-11-22      ← red (expired!)
```

**Filter by provider:**
```bash
lsenv -p openai
# Shows only OpenAI keys
```

**List all providers:**
```bash
lsenv --providers
# Output:
# Providers in 1Password (Dotfiles):
#   anthropic           (1 keys)
#   google              (1 keys)
#   npm                 (1 keys)
#   openai              (2 keys)
#   tavily              (1 keys)
# Total: 5 providers
```

## Two Operating Modes

The scripts automatically detect which mode to use based on 1Password CLI availability.

### 1Password Mode (Preferred)

**When:** `op` CLI is installed and authenticated (biometric via Touch ID)

**Features:**
- Keys stored securely in 1Password "Dotfiles" vault
- **Provider stored as 1Password tag** for filtering
- `.env` file auto-regenerated from 1Password
- Expiry tracking with color-coded warnings
- URL documentation stored with each key
- Sync across machines with `syncenv`
- 1Password Watchtower notifications for expiring keys
- Filter keys by provider with `lsenv -p <name>`

### Manual Mode (Fallback)

**When:** 1Password CLI not available or not authenticated

**Features:**
- Keys stored directly in `.env` file
- Provider stored in comments: `# KEY [provider: xxx]`
- No sync capability
- Expiry dates shown in comments only (no notifications)
- Still updates `.env.example` for documentation
- Provider filtering still works via comment parsing

## File Locations

| File | Purpose |
|------|---------|
| `bin/env/addenv` | Add/update environment variables |
| `bin/env/syncenv` | Sync from 1Password to .env |
| `bin/env/lsenv` | List environment variables |
| `.env` | Generated cache (gitignored) |
| `.env.example` | Template with placeholders (committed) |

## 1Password Vault Structure

Keys are stored in the "Dotfiles" vault as "API Credential" items with provider tags:

```
Vault: "Dotfiles"
├── Item: "CLAUDE_API_KEY" (type: API Credential)
│   ├── credential: "sk-ant-..."
│   ├── website: "https://console.anthropic.com/settings/keys"
│   ├── tags: ["anthropic"]           ← Provider tag for grouping
│   └── Expiry Date: 2025-12-31 (optional)
├── Item: "OPENAI_API_KEY_PROD"
│   ├── credential: "sk-prod-..."
│   ├── website: "https://platform.openai.com/api-keys"
│   └── tags: ["openai"]              ← Same provider, multiple keys
├── Item: "OPENAI_API_KEY_DEV"
│   ├── credential: "sk-dev-..."
│   ├── website: "https://platform.openai.com/api-keys"
│   └── tags: ["openai"]              ← Same provider, multiple keys
└── ...
```

## Common Workflows

### Adding a New API Key

```bash
# Get the key from the provider, then:
addenv NEW_API_KEY "the-secret-value" -p provider-name -u "https://provider.com/api-keys" -e 1y
```

This will:
1. Create item in 1Password with credential, URL, expiry, and **provider tag**
2. Regenerate `.env` from 1Password (with provider in comments)
3. Update `.env.example` with placeholder
4. Sync to launchctl for GUI apps

### Setting Up a New Machine

```bash
# Install 1Password CLI
brew install 1password-cli

# Authenticate (triggers Touch ID)
op vault list

# Regenerate .env from 1Password
syncenv

# Reload shell
source ~/.zshrc
```

### Checking for Expiring Keys

```bash
lsenv -v
```

Look for:
- **Yellow dates** = Expiring within 30 days
- **Red dates with warning** = Already expired

### Rotating an Expired Key

```bash
# Get new key from provider (URL shown in lsenv -v or 1Password)
# Then update:
addenv EXPIRED_KEY "new-value" -p provider-name -u "https://provider.com/keys" -e 1y
```

### Managing Multiple Keys from Same Provider

```bash
# Add multiple keys with the same provider tag
addenv STRIPE_KEY_LIVE "sk_live_xxx" -p stripe -u "https://dashboard.stripe.com/apikeys" -e 1y
addenv STRIPE_KEY_TEST "sk_test_xxx" -p stripe -u "https://dashboard.stripe.com/apikeys" -e 1y

# List all Stripe keys
lsenv -p stripe

# See all providers
lsenv --providers
```

## Expiry Date Formats

| Format | Example | Meaning |
|--------|---------|---------|
| `YYYY-MM-DD` | `2025-12-31` | Absolute date |
| `Nd` | `30d`, `90d` | N days from now |
| `Nm` | `6m`, `12m` | N months from now |
| `Ny` | `1y`, `2y` | N years from now |

## Provider Naming Conventions

Use lowercase provider names with hyphens for multi-word names:

| Provider | Tag |
|----------|-----|
| OpenAI | `openai` |
| Anthropic | `anthropic` |
| Google (Gemini) | `google` |
| Stripe | `stripe` |
| Azure AI | `azure-ai` |
| Internal/Custom | `internal` |

## Quick Reference

```bash
# Add a new key
addenv API_KEY "value" -p provider -u "url" -e 1y

# List all keys
lsenv

# List with details
lsenv -v

# Filter by provider
lsenv -p openai

# List all providers
lsenv --providers

# Sync from 1Password
syncenv

# Preview sync changes
syncenv --dry-run
```

## Troubleshooting

### "1Password CLI found but not authenticated"

Run `op vault list` to trigger biometric authentication, then retry.

### Keys not available in GUI apps (VS Code, etc.)

Run `syncenv` to sync to launchctl, then restart the app.

### .env file is empty or missing keys

Run `syncenv` to regenerate from 1Password.

### Need to see where to get a new key

```bash
lsenv -v  # Shows URLs and providers in 1Password mode
# Or check .env comments in manual mode
```

### "Missing required --provider flag"

The `addenv` command requires the `-p` flag:
```bash
# Wrong:
addenv MY_KEY "value"

# Correct:
addenv MY_KEY "value" -p provider-name
```

### Filter keys by provider

```bash
# See all keys from a specific provider
lsenv -p openai

# See all available providers
lsenv --providers
```
