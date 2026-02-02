# Linting & Formatting

## Biome

Single tool for linting + formatting (replaces ESLint + Prettier).

### Configuration (`biome.json`)

```json
{
  "$schema": "https://biomejs.dev/schemas/2.3.11/schema.json",
  "vcs": { "enabled": true, "clientKind": "git", "useIgnoreFile": true },
  "assist": {
    "actions": { "source": { "organizeImports": "on" } }
  },
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true,
      "complexity": { "noForEach": "off" },
      "style": { "noNonNullAssertion": "off" }
    }
  },
  "formatter": {
    "enabled": true,
    "indentStyle": "tab",
    "indentWidth": 2,
    "lineWidth": 80,
    "lineEnding": "lf"
  },
  "javascript": {
    "formatter": {
      "quoteStyle": "single",
      "semicolons": "asNeeded",
      "trailingCommas": "all",
      "bracketSpacing": true,
      "arrowParentheses": "always"
    }
  }
}
```

### Key Style Choices

| Setting | Value | Notes |
|---------|-------|-------|
| Indent | Tabs (width 2) | Accessibility-friendly |
| Quotes | Single | JS convention |
| Semicolons | As needed | Minimal |
| Line width | 80 chars (100 in tests) | |
| Trailing commas | All | Clean diffs |
| Line endings | LF | Cross-platform consistency |

### Overrides

- **`**/config/generator.ts`**: `noTemplateCurlyInString: off` (template placeholders)
- **Test files** (`*.test.*`, `__tests__/**`): Relaxed rules — `noExplicitAny: off`, `noTemplateCurlyInString: off`, `noCommaOperator: off`, line width 100

### Commands

```bash
bun run check          # Lint + format with auto-fix (write mode)
bun run lint           # Lint only (report)
bun run lint:fix       # Lint with auto-fix
bun run format         # Format with auto-fix
bun run format:check   # Format check (no write)
```

## Commitlint

Enforces Conventional Commits format via `@commitlint/config-conventional`.

### Configuration (`commitlint.config.mjs`)

```javascript
export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'body-max-line-length': [0, 'always'],       // No body line limit
    'footer-max-line-length': [0, 'always'],     // No footer line limit
    'header-max-length': [2, 'always', 100],     // 100-char header max
    'type-enum': [2, 'always', [
      'feat', 'fix', 'docs', 'style', 'refactor',
      'perf', 'test', 'build', 'ci', 'chore', 'revert',
    ]],
    'subject-empty': [2, 'never'],
  },
}
```

## Husky Git Hooks

### `pre-commit`

Runs `lint-staged` which applies `biome check --write` to staged files:

```json
"lint-staged": {
  "*.{ts,tsx,js,jsx,mts,cts,json}": ["biome check --write"]
}
```

Also runs `actionlint` (non-blocking) if workflow files are staged.

### `commit-msg`

Validates commit message format via commitlint: `pnpm exec commitlint --edit "$1"`

### `pre-push`

Blocks direct pushes to `main`/`master`. Override with `ALLOW_PUSH_PROTECTED=1 git push`.

## Workflow Linting

```bash
bun run lint:scripts    # ShellCheck on .github/scripts/*.sh
bun run lint:workflows  # actionlint on .github/workflows/*.yml
```

## Troubleshooting

### "biome check" fails on template placeholders

The `{{PLACEHOLDER}}` syntax triggers `noTemplateCurlyInString`. The biome.json override for `config/generator.ts` handles this. If you add new files with placeholders, add them to the overrides.

### Commitlint rejects valid message

Check the format: `type(scope): subject`. The scope is optional. Subject must not be empty. Header must be <= 100 characters.

### Pre-push blocks push to main

This is intentional. Create a feature branch and open a PR. Override only in setup: `ALLOW_PUSH_PROTECTED=1 git push`.
