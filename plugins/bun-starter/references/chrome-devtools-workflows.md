# Chrome DevTools Workflows

Browser automation workflows for npm and GitHub setup tasks. Each workflow uses Chrome DevTools MCP tools to drive Chrome with remote debugging.

## General Patterns

### Navigation Pattern

Every workflow follows this sequence:

1. `navigate_page` to the target URL
2. `wait_for` the page to load (check for a key element)
3. `take_snapshot` to get the accessibility tree
4. Identify target elements by **text content and role** (never hardcoded coordinates)
5. Perform action (`click`, `fill`, `select`)
6. `take_screenshot` to verify the result

### Element Finding: Snapshot-First

**Always use `take_snapshot` (accessibility tree) to locate elements.** It is cheaper, faster, and more resilient to UI changes than screenshots.

- Match elements by their **accessible name** (visible text) and **role** (button, link, textbox, etc.)
- If the primary text isn't found, search for alternative labels (e.g., "Generate token" vs "Generate Token" vs "Create token")
- Only use `take_screenshot` for visual verification after actions, not for element discovery

### Auth Detection

Before any workflow, check login state:

1. `navigate_page` to the target site root (e.g., `https://www.npmjs.com`)
2. `take_snapshot`
3. Look for indicators:
   - **Logged in**: Username/avatar in snapshot, profile menu items
   - **Not logged in**: "Sign In", "Log in", "Sign Up" text present
4. If not logged in: Tell the user to log in manually in the debug profile, then `wait_for` authenticated state

### 1Password Vault Storage (Optional)

When secrets are created (npm tokens, API keys), offer to store them in 1Password via the `op` CLI. This avoids clipboard exposure and creates an audit trail.

**Detection**: Check if `op` is available before offering:
```bash
op --version 2>/dev/null
```

**Vault**: `API Credentials` — the sole vault. No resolution logic needed.

**Auth**: `OP_SERVICE_ACCOUNT_TOKEN` is set in the shell environment (sourced from `~/code/dotfiles/.env`). This means all `op` commands run non-interactively — no Touch ID prompts, fully automatable by agents.

**Store a secret**:
```bash
op item create \
  --category=api_credential \
  --title="<TITLE>" \
  --vault="API Credentials" \
  "credential=<SECRET_VALUE>" \
  "type=<TYPE>" \
  "expires=<EXPIRY_DATE>"
```

**Retrieve a secret**:
```bash
op read "op://API Credentials/<ITEM>/<FIELD>"
```

**Check if a secret already exists** (before creating duplicates):
```bash
op item list --vault="API Credentials" --format=json | grep -i "<SEARCH_TERM>"
```

**Conventions**:
- **Title format**: `<service> - <purpose>` (e.g., "npm - github-actions-publish token")
- **Tags**: Add relevant tags (e.g., `npm`, `ci-cd`, `github-actions`)
- **Notes field**: Include context — which repo, what scope, when it expires
- **Expiry tracking**: Set the expiry date on the item so 1Password can warn before it lapses

**Graceful degradation**: If `op` is not installed, `OP_SERVICE_ACCOUNT_TOKEN` is not set, or the user declines, fall back to the existing behavior (warn to copy manually, offer `gh secret set`).

### Error Recovery

On any step failure:

1. `take_screenshot` of the current state (if connection alive)
2. Check for common interrupts: 2FA prompt, CAPTCHA, session expiry, rate limit
3. Report: which step failed, what is visible on screen
4. Provide remaining steps as manual instructions
5. Never retry destructive actions automatically

---

## Workflows

### npm-create-token

**Task**: Create a granular access token on npmjs.com
**Why browser**: No CLI equivalent for granular token creation with custom scopes.

**Variables needed**:
- `TOKEN_NAME` — descriptive name (e.g., "github-actions-publish")
- `EXPIRY` — token expiry period (default: 90 days)
- `PACKAGE_SCOPE` — package or scope to grant access to
- `PERMISSIONS` — Read and Write (for publishing)

**Steps**:

1. **Navigate** to token creation page
   ```
   navigate_page → https://www.npmjs.com/settings/<username>/tokens/granular-access-tokens/new
   wait_for → text "Generate a granular access token"
   ```

2. **Verify auth** — `take_snapshot`, confirm no login redirect

3. **Fill token name**
   ```
   take_snapshot → find textbox with label "Token name" or "Name"
   fill → TOKEN_NAME value
   ```

4. **Set expiry**
   ```
   take_snapshot → find dropdown/select near "Expiration"
   click → expiry option (90 days recommended)
   ```

5. **Configure package scope**
   ```
   take_snapshot → find "Packages and scopes" section
   select → "Only select packages and scopes"
   fill → PACKAGE_SCOPE in the package/scope input
   ```

6. **Set permissions**
   ```
   take_snapshot → find permissions section
   select → "Read and Write" for the package scope
   ```

7. **Generate token**
   ```
   take_snapshot → find button with text "Generate token" or "Generate Token"
   click → the generate button
   wait_for → token value display (text starting with "npm_")
   ```

8. **Extract and warn**
   ```
   take_snapshot → find the token value (starts with "npm_")
   take_screenshot → visual confirmation
   ```
   - **CRITICAL**: Warn user this token is shown only once — copy it immediately

9. **Store the token** (offer in priority order)
   1. **1Password** (if `op` available): Resolve vault (see Vault Resolution), then store with expiry tracking
      ```bash
      op item create --category=api_credential \
        --title="npm - TOKEN_NAME" \
        --vault="API Credentials" \
        "credential=<token_value>" \
        "type=granular_access_token" \
        "scope=PACKAGE_SCOPE" \
        "expires=<90 days from now>"
      ```
   2. **GitHub secret**: Pipe to `gh secret set NPM_TOKEN` for CI usage
      ```bash
      echo "<token_value>" | gh secret set NPM_TOKEN --repo <OWNER>/<REPO>
      ```
   3. **Manual**: Tell user to copy and store it themselves

   Offer all applicable options — the user may want both vault storage AND the GitHub secret set.

**Verification**: Token value starts with `npm_` and is displayed on screen.

---

### npm-oidc-setup

**Task**: Configure OpenID Connect trusted publishing for a package
**Why browser**: OIDC trusted publisher setup has no CLI equivalent.

**Variables needed**:
- `PACKAGE_NAME` — npm package name (e.g., `my-package`)
- `GITHUB_ORG_OR_USER` — GitHub org or username
- `GITHUB_REPO` — repository name
- `WORKFLOW_FILE` — workflow filename (default: `publish.yml`)

**Steps**:

1. **Navigate** to package access page
   ```
   navigate_page → https://www.npmjs.com/package/<PACKAGE_NAME>/access
   wait_for → text "Publishing access" or "Access"
   ```

2. **Verify auth** — `take_snapshot`, confirm logged in as package owner

3. **Find trusted publisher section**
   ```
   take_snapshot → find "Trusted Publisher" or "GitHub Actions" section
   ```
   - If not visible, the package may not support OIDC yet — fall back to manual instructions

4. **Select GitHub Actions**
   ```
   click → "GitHub Actions" option or "Configure trusted publisher"
   wait_for → form fields for GitHub org/repo/workflow
   ```

5. **Fill GitHub details**
   ```
   take_snapshot → find form fields
   fill → GITHUB_ORG_OR_USER in org/username field
   fill → GITHUB_REPO in repository field
   fill → WORKFLOW_FILE in workflow filename field
   ```

6. **Submit**
   ```
   take_snapshot → find button "Set up connection" or "Save" or "Configure"
   click → the submit button
   wait_for → success confirmation
   ```

7. **Verify**
   ```
   take_screenshot → capture confirmation
   take_snapshot → confirm trusted publisher is now listed
   ```

**Verification**: Page shows the GitHub repository as a trusted publisher for this package.

---

### npm-view-access

**Task**: View current access configuration for a package
**Why browser**: Quick visual audit of publishing method, trusted publishers, 2FA requirements.

**Variables needed**:
- `PACKAGE_NAME` — npm package name

**Steps**:

1. **Navigate**
   ```
   navigate_page → https://www.npmjs.com/package/<PACKAGE_NAME>/access
   wait_for → page load
   ```

2. **Capture state**
   ```
   take_snapshot → full accessibility tree
   take_screenshot → visual record
   ```

3. **Report** the following from the snapshot:
   - Current publishing method (token, OIDC, or both)
   - Trusted publisher configuration (if any)
   - 2FA requirements (require 2FA for publish?)
   - Team/user access list

**Verification**: Information successfully extracted and reported to user.

---

### github-set-secret

**Task**: Set a repository secret
**Preferred method**: CLI (`gh secret set`), with optional 1Password sourcing

**CLI method** (preferred):
```bash
# Direct value:
echo "<SECRET_VALUE>" | gh secret set <SECRET_NAME> --repo <OWNER>/<REPO>

# From 1Password (if op available and secret is vaulted):
op read "op://Developer/<ITEM>/credential" | gh secret set <SECRET_NAME> --repo <OWNER>/<REPO>
```

When `op` is available, check if the secret already exists in the vault before asking the user to provide it manually. This avoids unnecessary clipboard exposure.

**Browser fallback** (when `gh` unavailable):

**Variables needed**:
- `REPO_OWNER` / `REPO_NAME`
- `SECRET_NAME` — e.g., `NPM_TOKEN`
- `SECRET_VALUE`

**Steps**:

1. **Navigate**
   ```
   navigate_page → https://github.com/<REPO_OWNER>/<REPO_NAME>/settings/secrets/actions
   wait_for → text "Actions secrets" or "Repository secrets"
   ```

2. **Verify auth** — `take_snapshot`, confirm access to settings

3. **Create or update secret**
   ```
   take_snapshot → find "New repository secret" button
   click → "New repository secret"
   wait_for → form fields
   ```

4. **Fill secret**
   ```
   fill → SECRET_NAME in "Name" field
   fill → SECRET_VALUE in "Secret" / "Value" field
   ```

5. **Save**
   ```
   take_snapshot → find "Add secret" or "Update secret" button
   click → save button
   wait_for → redirect to secrets list
   ```

6. **Verify**
   ```
   take_snapshot → confirm SECRET_NAME appears in the secrets list
   take_screenshot → visual confirmation
   ```

---

### github-branch-protection

**Task**: Configure branch protection rules
**Preferred method**: CLI (`gh api`)

**CLI method** (preferred):
```bash
gh api repos/<OWNER>/<REPO>/branches/main/protection \
  --method PUT \
  --field required_status_checks='{"strict":true,"contexts":["pr-quality"]}' \
  --field enforce_admins=true \
  --field required_pull_request_reviews='{"required_approving_review_count":1}'
```

**Browser fallback** (when `gh` unavailable):

**Variables needed**:
- `REPO_OWNER` / `REPO_NAME`
- `BRANCH` — branch to protect (default: `main`)
- `REQUIRED_CHECKS` — status checks to require (e.g., `pr-quality`)

**Steps**:

1. **Navigate**
   ```
   navigate_page → https://github.com/<REPO_OWNER>/<REPO_NAME>/settings/branches
   wait_for → text "Branch protection rules" or "Branches"
   ```

2. **Add or edit rule**
   ```
   take_snapshot → find existing rule for BRANCH, or "Add branch protection rule" / "Add rule"
   click → edit existing or create new
   wait_for → rule configuration form
   ```

3. **Configure branch name pattern**
   ```
   fill → BRANCH in "Branch name pattern" field (if creating new)
   ```

4. **Enable required status checks**
   ```
   take_snapshot → find "Require status checks to pass before merging"
   click → enable checkbox if not already checked
   fill → REQUIRED_CHECKS in the status check search field
   click → select the matching check from the dropdown
   ```

5. **Enable additional protections** (as needed)
   ```
   take_snapshot → find and enable:
   - "Require a pull request before merging"
   - "Include administrators" / "Do not allow bypassing"
   ```

6. **Save**
   ```
   take_snapshot → find "Create" or "Save changes" button
   click → save
   wait_for → redirect to branches settings
   ```

7. **Verify**
   ```
   take_snapshot → confirm rule is listed for BRANCH
   take_screenshot → visual confirmation
   ```

---

## Edge Cases

### 2FA Prompts

npm and GitHub may prompt for 2FA during sensitive operations:

1. `take_snapshot` — detect 2FA prompt (text like "Two-factor authentication", "Verify", "Enter code")
2. Tell the user: _"A 2FA prompt appeared. Please enter your code in the browser, then tell me when you're done."_
3. `wait_for` the 2FA form to disappear
4. Resume the workflow

### Token Exposure

When handling tokens (npm tokens, secrets):

- Warn the user immediately that the token is visible
- **Preferred**: Store in 1Password vault via `op item create` (if `op` available) — creates audit trail and expiry tracking
- **Also offer**: Pipe directly to `gh secret set` for CI usage (can source from vault: `op read ... | gh secret set ...`)
- **Fallback**: Tell user to copy manually if they decline both
- Never log or display the full token value in conversation output — show only the first 8 characters followed by `...`

### UI Changes

npm and GitHub periodically update their UI. The snapshot-first approach handles this:

- Element finding uses **text content and roles**, not CSS selectors or coordinates
- If expected text isn't found, search for **alternative labels** (e.g., "Generate" vs "Create", "Save" vs "Submit")
- If no matching element is found after alternatives, fall back to manual instructions with a screenshot of what's currently on screen

### Not Logged In

If a login page is detected at any point during a workflow:

1. `take_screenshot` — show the user what's on screen
2. Instruct: _"You need to log in to [site] in the debug Chrome profile. Please log in, then tell me when you're ready."_
3. `wait_for` — wait for the authenticated page to load
4. Re-run `take_snapshot` to verify login succeeded
5. Resume the workflow from the interrupted step
