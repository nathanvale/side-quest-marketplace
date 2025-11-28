# Module-Level CLAUDE.md Template

For: `src/[module]/CLAUDE.md` (feature/module subdirectory)

**Budget:** 30-50 lines (max 100 before split)

---

## Template Structure

```markdown
# [Module Name]

[One-line purpose: what this module does]

---

## Key Files

| File | Purpose |
|------|---------|
| `[file].ts` | [What it does] |
| `[file].ts` | [What it does] |
| `types.ts` | [Module-specific types] |

---

## Conventions

- [Module-specific convention]
- [Another convention]
- [Pattern used in this module]

---

## Dependencies

**Uses**: `[dependency]` | **Consumed by**: `[consumer]`

**External APIs**:
- [API name] - [What it's used for]

---

## Testing

\`\`\`bash
[test command for this module specifically]
\`\`\`

**Coverage**: [requirement or note]

---

## Notes

[Module-specific gotchas or important context]
```

---

## Key Sections Explained

### One-Line Purpose

Be specific about what this module handles:
- ✅ "Handles user authentication and session management"
- ❌ "Auth stuff"

### Key Files

List only the most important files in this module with their purposes:
```markdown
| File | Purpose |
|------|---------|
| `auth.ts` | Main authentication logic (login, logout, refresh) |
| `session.ts` | Session management and token validation |
| `middleware.ts` | Auth middleware for protected routes |
| `types.ts` | Auth-related TypeScript types |
```

### Conventions

Module-specific patterns or rules that differ from or extend project-level conventions:
```markdown
## Conventions

- JWT tokens expire after 24h
- Refresh tokens stored in httpOnly cookies
- All auth errors use custom `AuthError` class
- Session data cached in Redis (TTL: 30 min)
```

### Dependencies

What this module uses and what uses it:
```markdown
## Dependencies

**Uses**: `database`, `redis`, `jwt-library`
**Consumed by**: `api-routes`, `middleware`

**External APIs**:
- Auth0 - OAuth provider
- SendGrid - Email verification
```

### Testing

Module-specific test commands or notes:
```bash
bun test src/auth/           # Run all auth tests
bun test:integration auth    # Integration tests only
```

---

## What NOT to Include

❌ Project-wide standards (inherit from root CLAUDE.md)
❌ Personal preferences
❌ Full architecture docs
❌ Duplicate content from parent

**Keep it focused**: One module, one concern.

---

## Scope Check

Module files should be:
- ✅ Focused on a single feature/module
- ✅ Brief (30-50 lines typical)
- ✅ Referenced from project CLAUDE.md via @import

If your module file is >100 lines or covers multiple features, split it further.
