# Conventional Commits Reference

## Types

| Type | Description | Example |
|------|-------------|---------|
| **feat** | New feature for the user | `feat(auth): add OAuth2 login` |
| **fix** | Bug fix for the user | `fix(api): handle null response` |
| **docs** | Documentation only changes | `docs(readme): update install guide` |
| **style** | Formatting, whitespace, semicolons (no code change) | `style(lint): fix indentation` |
| **refactor** | Code change that neither fixes bug nor adds feature | `refactor(core): simplify data flow` |
| **perf** | Performance improvement | `perf(queries): add database index` |
| **test** | Adding or updating tests | `test(auth): add login unit tests` |
| **build** | Build system or external dependencies | `build(deps): upgrade to Node 20` |
| **ci** | CI configuration and scripts | `ci(actions): add deploy workflow` |
| **chore** | Maintenance tasks | `chore(deps): update dependencies` |
| **revert** | Revert a previous commit | `revert: feat(auth): add OAuth2` |

## Scope Guidelines

The scope should identify the area of the codebase affected:

- **Module/package name**: `auth`, `api`, `utils`, `config`
- **Feature area**: `login`, `checkout`, `dashboard`
- **Layer**: `db`, `routes`, `middleware`, `ui`
- **Plugin name** (for monorepos): `git`, `kit`, `para-obsidian`

Scope is optional but recommended for clarity.

## Subject Rules

1. **Imperative mood**: "add" not "added", "fix" not "fixed"
2. **Lowercase**: Start with lowercase letter
3. **No period**: Don't end with a period
4. **Max 100 chars**: Keep the header line short
5. **What, not how**: Describe the change, not implementation

## Body (Optional)

Use the body to explain:
- **What** changed and **why** (not how)
- Breaking changes
- Migration instructions
- Related issues

Separate from subject with a blank line.

When a commit touches multiple areas, name the affected modules or services in the body so readers know which diffs matter without reading every changed file.

## Footer (Optional)

- `BREAKING CHANGE:` for breaking changes
- `Fixes #123` or `Closes #123` for issue references
- `Co-Authored-By:` for pair programming

### AI Attribution

Always add `Co-Authored-By: Claude <noreply@anthropic.com>` when Claude generates or substantially modifies code. GitHub renders this as a co-author avatar in the commit list.

## Breaking Changes

Indicate breaking changes with:
1. `!` after type/scope: `feat(api)!: change response format`
2. `BREAKING CHANGE:` in footer

```
feat(api)!: change response format

BREAKING CHANGE: Response now returns array instead of object.
Migration: Update client code to handle array response.
```

## Full Examples

### Simple single-line commit

```
chore(deps): update dependencies to latest versions

Generated with [Claude Code](https://claude.ai/code)

Co-Authored-By: Claude <noreply@anthropic.com>
```

### Commit with body and footer

```
fix(api): handle null response in user endpoint

The /api/users endpoint was crashing when the database
returned null for deleted users. Now returns 404.

Fixes #234

Generated with [Claude Code](https://claude.ai/code)

Co-Authored-By: Claude <noreply@anthropic.com>
```

### Breaking change commit

```
feat(api)!: change authentication to JWT

BREAKING CHANGE: Session-based auth removed. All clients must
update to use Bearer token authentication.

Migration guide: https://docs.example.com/auth-migration

Generated with [Claude Code](https://claude.ai/code)

Co-Authored-By: Claude <noreply@anthropic.com>
```

## Anti-Slop Guardrails

Bad commit messages echo the debugging session. Good ones describe the outcome.

**Bad -- narrates the journey:**

```
fix(auth): fix token validation

First I checked the error logs and saw null pointer exceptions.
After investigating, I found that validateToken() didn't handle
empty OAuth payloads. I added a null guard and updated the tests.
```

**Good -- describes the outcome:**

```
fix(auth): reject null OAuth tokens before validation

Empty OAuth payloads from the provider caused a null pointer in
validateToken(). The null guard returns 401 before reaching the
JWT decoder.
```

**Bad -- subtle process narration:**

```
refactor(db): refactor query builder for better performance

The investigation revealed that the query builder was generating
suboptimal joins. Testing confirmed that rewriting the join logic
reduced query time across all endpoints.
```

**Good -- states what changed and why:**

```
perf(db): rewrite join logic in query builder

Inner joins replace left joins where nulls are impossible.
Benchmarked: 3x faster on the /users endpoint.
```

**Common slop transformations:**

| Slop | Clean |
|------|-------|
| `This commit adds JWT auth support` | `feat(auth): add JWT authentication` |
| `Updated user service to ensure proper error handling` | `fix(user): handle null response in getUser` |
| `Refactored and streamlined the database query` | `perf(db): add index on users.email` |
| `Let's fix the bug where login fails` | `fix(auth): prevent login failure on expired token` |

**Words that signal AI-generated text** (avoid in commit messages):

| Avoid | Use instead |
|-------|-------------|
| ensure | verify, check, guard |
| comprehensive | (omit -- show scope via file list) |
| robust | (omit -- tests prove robustness) |
| streamline | simplify, reduce |
| enhance | improve, add |
| leverage | use |
| seamless | (omit -- users decide) |
| proper | correct, valid |

The diff shows *how*. The message explains *what* and *why*.
