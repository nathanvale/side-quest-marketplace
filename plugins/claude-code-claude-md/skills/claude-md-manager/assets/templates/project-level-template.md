# ProjectName

Brief description of what this project does.

## Tech Stack
- Framework (version)
- Database
- Key libraries

## Project Structure
```
src/
  app/          # Routes/pages
  components/   # UI components
  lib/          # Utilities
```

## Commands
```bash
bun install          # Install dependencies
bun dev              # Development server
bun test             # Run tests
bun build            # Production build
```

## Setup
1. `bun install`
2. Copy `.env.example` to `.env`
3. `bun dev`

## Environment Variables
- `DATABASE_URL`: Database connection
- `API_KEY`: External service key

## Code Conventions
- Server Components by default
- Use Server Actions for mutations
- Keep components under 200 lines

## Testing
- Vitest + Testing Library
- Coverage goal: 80%
- Use `createMock*()` helpers

## Git Workflow
- Branch: `feature/description` or `fix/description`
- Commits: Conventional Commits format
- Squash merge PRs

## Known Issues
- Note any gotchas or workarounds

## Detailed Docs
@./.claude/architecture.md
@./.claude/api-reference.md
