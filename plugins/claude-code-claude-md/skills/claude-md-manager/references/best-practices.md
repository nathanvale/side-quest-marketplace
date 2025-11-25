# CLAUDE.md Best Practices and Optimization

## Token Optimization Strategies

### Why Optimize for Tokens?

Every character in CLAUDE.md counts against Claude's context window. Efficient CLAUDE.md files mean:
- More room for code in context
- Faster response times
- Lower costs (if using API directly)
- Better focus on relevant information

### Token Budgets by Level

| Level | Target Lines | Max Lines | Typical Tokens |
|-------|--------------|-----------|----------------|
| User | 100-150 | 200 | 800-1600 |
| Project | 300-400 | 500 | 2400-4000 |
| Module | 50-75 | 100 | 400-800 |
| Import | Varies | 300 | 2400 |

**Note**: 1 line ≈ 8 tokens on average. Actual tokens depend on content density.

### Strategy 1: Progressive Disclosure

**Principle**: Core information in main file, details in imports.

**Before** (500 lines, 4000 tokens):
```markdown
# Project

## Architecture (200 lines)
Detailed explanation of every component...
Class diagrams, sequence diagrams...
Every design decision explained...

## API Reference (250 lines)
Every endpoint documented...
Full request/response examples...
Error codes and handling...
```

**After** (100 lines, 800 tokens main + 3200 tokens in imports):
```markdown
# Project

## Architecture
3-tier: React UI → Express API → PostgreSQL
- UI: React 18 with Vite
- API: Express + TypeScript
- DB: PostgreSQL 16 with Kysely

For details: @./.claude/architecture.md

## API Reference
RESTful API at /api/v1
Key endpoints: /users, /posts, /comments

For full docs: @./.claude/api-reference.md
```

**Result**: Same information, but main file is scannable. Details loaded only when needed.

### Strategy 2: Eliminate Redundancy

**Before**:
```markdown
## Installation
1. Clone the repository
2. Run npm install
3. Copy .env.example to .env
4. Run npm run dev

## Getting Started
1. Clone the repository
2. Install dependencies with npm install
3. Set up environment variables by copying .env.example to .env
4. Start development server with npm run dev
```

**After**:
```markdown
## Quick Start
\`\`\`bash
git clone <repo>
npm install
cp .env.example .env
npm run dev
\`\`\`
```

**Saved**: ~100 tokens

### Strategy 3: Use Code Blocks Instead of Prose

**Before** (wordy):
```markdown
## Authentication
To authenticate a user, you need to call the signIn function that is exported
from the auth module. You should pass it an object containing the user's email
and password. The function will return a promise that resolves to either a
session object if successful, or an error object if authentication failed.
```

**After** (code-first):
```markdown
## Authentication
\`\`\`typescript
import { signIn } from './auth'

const session = await signIn({ email, password })
// Returns session or throws error
\`\`\`
```

**Saved**: ~60 tokens, more useful

### Strategy 4: Leverage Hierarchy

**Before** (everything in project CLAUDE.md):
```markdown
# Project

## My Personal Preferences
- I like concise responses
- I prefer functional programming
...

## Project Setup
...

## Code Style
...
```

**After** (separated by level):

**~/.claude/CLAUDE.md** (user level):
```markdown
# My Preferences
- Concise responses
- Functional programming
...
```

**project/CLAUDE.md** (project level):
```markdown
# Project

## Setup
...

## Code Style
...
```

**Saved**: ~100 tokens, better organization

### Strategy 5: Smart Summarization

**Before**:
```markdown
## Commands

To run the development server, execute the command \`npm run dev\` which will
start the Vite development server on port 3000 by default, or you can specify
a different port using the PORT environment variable.

To run tests, you can use \`npm test\` which runs the entire test suite using
Vitest, or \`npm run test:watch\` to run tests in watch mode, or
\`npm run test:ui\` to open the Vitest UI.

To build for production, use \`npm run build\` which will create an optimized
production build in the dist/ directory.
```

**After**:
```markdown
## Commands
\`\`\`bash
npm run dev          # Dev server (port 3000, set PORT to override)
npm test             # Run all tests
npm run test:watch   # Tests in watch mode
npm run test:ui      # Vitest UI
npm run build        # Production build → dist/
\`\`\`
```

**Saved**: ~150 tokens

### Strategy 6: Reference, Don't Duplicate

**Before**:
```markdown
## ESLint Config
We use the following ESLint rules:
- no-console: warn
- no-unused-vars: error
- @typescript-eslint/explicit-function-return-type: warn
... 50 more rules ...
```

**After**:
```markdown
## Linting
ESLint with TypeScript plugin. See \`.eslintrc.js\` for config.
Key: no console warnings, explicit return types on exports.
```

**Saved**: ~300 tokens

### Strategy 7: Tables Over Lists

**Before**:
```markdown
## Environment Variables

DATABASE_URL: This is the connection string for the PostgreSQL database

API_KEY: The API key for the external service

SECRET_KEY: The secret key used for JWT signing

REDIS_URL: Connection string for Redis cache
```

**After**:
```markdown
## Environment Variables
| Variable | Purpose |
|----------|---------|
| DATABASE_URL | PostgreSQL connection |
| API_KEY | External service auth |
| SECRET_KEY | JWT signing |
| REDIS_URL | Redis cache |
```

**Saved**: ~40 tokens, more scannable

## Writing Style Best Practices

### Be Imperative

**Bad**:
```markdown
You should probably use TypeScript strict mode because it helps catch bugs.
```

**Good**:
```markdown
Use TypeScript strict mode.
```

### Be Specific

**Bad**:
```markdown
Format code properly.
```

**Good**:
```markdown
Use 2-space indentation. Run Prettier before committing.
```

### Use Examples

**Bad**:
```markdown
Handle errors appropriately in API routes.
```

**Good**:
```markdown
\`\`\`typescript
export async function GET(req: Request) {
  try {
    const data = await fetchData()
    return Response.json(data)
  } catch (error) {
    console.error(error)
    return Response.json({ error: 'Failed to fetch' }, { status: 500 })
  }
}
\`\`\`
```

### Avoid Noise

**Bad**:
```markdown
## Introduction

Welcome to our project! We're excited to have you here. This document will
help guide you through the codebase. Let's get started!

## Table of Contents
1. Introduction
2. Getting Started
3. Architecture
...
```

**Good**:
```markdown
# Project Name

## Quick Start
\`\`\`bash
npm install && npm run dev
\`\`\`

## Architecture
...
```

## Organization Best Practices

### Frontload Important Information

Users need these first:
1. Quick start / common commands
2. Project structure
3. Tech stack
4. Code conventions

Save for later (imports):
- Detailed architecture
- API reference
- Database schemas
- Deployment docs

### Use Meaningful Headers

**Bad**:
```markdown
## Stuff
## Things to Know
## Other
```

**Good**:
```markdown
## Quick Start
## Code Conventions
## Testing Strategy
```

### Group Related Information

**Bad**:
```markdown
## Commands
npm install

## Dependencies
We use React

## Commands
npm run dev

## Dependencies
Also Next.js
```

**Good**:
```markdown
## Tech Stack
- React 18
- Next.js 14

## Commands
\`\`\`bash
npm install
npm run dev
\`\`\`
```

## Import Best Practices

### When to Extract to Import

Extract when:
- Section exceeds 100 lines
- Information is optional/advanced
- Content rarely changes
- Multiple modules need it

Keep inline when:
- Information is essential
- Less than 50 lines
- Frequently referenced
- Context-critical

### Import Organization

**Good structure**:
```markdown
# CLAUDE.md (core context)
Core project info (200 lines)

## Imports
@./.claude/architecture.md      # High-level architecture
@./.claude/api-reference.md     # API docs
@./.claude/database.md          # DB schema
@./.claude/conventions.md       # Code style details
```

**Bad structure**:
```markdown
# CLAUDE.md (just imports)
@./file1.md
@./file2.md
@./file3.md
... 20 more imports ...
```

### Import Naming

**Good names**:
- `architecture.md` - clear what it contains
- `api-endpoints.md` - specific
- `database-schema.md` - descriptive

**Bad names**:
- `stuff.md` - vague
- `doc1.md` - meaningless
- `readme.md` - confusing (we have README.md)

### Import Directory Structure

**Flat** (good for small projects):
```
.claude/
  architecture.md
  api-reference.md
  database.md
```

**Nested** (good for large projects):
```
.claude/
  architecture/
    overview.md
    frontend.md
    backend.md
  api/
    endpoints.md
    authentication.md
    errors.md
  database/
    schema.md
    queries.md
```

## Maintenance Best Practices

### Keep It Current

**Do**:
- Update CLAUDE.md when making architectural changes
- Remove deprecated instructions
- Update version numbers
- Remove completed TODOs

**Don't**:
- Leave outdated setup instructions
- Keep references to removed dependencies
- Maintain "future plans" sections (use issues instead)

### Version Control

**Commit with changes**:
```bash
# Bad
git commit -m "Add feature X"

# Good
git add src/feature-x.ts
git add CLAUDE.md  # Updated with feature X conventions
git commit -m "feat: add feature X"
```

### Team Collaboration

**For teams**:
- Review CLAUDE.md in PRs
- Discuss major changes
- Keep style consistent
- Don't include personal preferences in project file

**For solo**:
- Still commit CLAUDE.md
- Future you will thank present you
- Helps onboard contributors later

## Anti-Patterns to Avoid

### ❌ Anti-Pattern 1: The Novel

```markdown
# Project (2000 lines)

## Introduction (200 lines)
Welcome to our project! Let me tell you the whole history...

## Architecture (800 lines)
Every single detail about every component...

## API Reference (1000 lines)
Every endpoint fully documented inline...
```

**Why bad**: Exceeds token budget, hard to navigate, contains too much detail.

**Fix**: Use progressive disclosure and imports.

### ❌ Anti-Pattern 2: The Abbreviation Soup

```markdown
## Tech
- NX + TS + RN + RQ
- DB: PG w/ P ORM
- Auth: NA.js w/ JWT
```

**Why bad**: Unclear, assumes knowledge, hard to search.

**Fix**: Use full names at least once.

```markdown
## Tech Stack
- Next.js with TypeScript and React Native
- Database: PostgreSQL with Prisma ORM
- Auth: NextAuth.js with JWT tokens
```

### ❌ Anti-Pattern 3: The Time Capsule

```markdown
## Setup
1. Install Node.js 14 (we're planning to upgrade to 16 soon)
2. Use npm (we might switch to yarn later)
3. Set up MongoDB (TODO: migrate to PostgreSQL in Q3)
```

**Why bad**: Contains outdated/aspirational info, confusing.

**Fix**: Document current state only.

### ❌ Anti-Pattern 4: The Duplicate

```markdown
# project/CLAUDE.md
Use TypeScript strict mode

# ~/.claude/CLAUDE.md
Use TypeScript strict mode

# project/frontend/CLAUDE.md
Use TypeScript strict mode
```

**Why bad**: Wastes tokens, creates inconsistency risk.

**Fix**: Preference in user file, project-specific in project file, only mention in module if it differs.

### ❌ Anti-Pattern 5: The Implementation Manual

```markdown
## UserRepository

The UserRepository class is located in src/repositories/UserRepository.ts
and extends the BaseRepository class. It has the following methods:

- findById(id: string): Promise<User | null>
  This method takes a string ID parameter and returns a promise that
  resolves to a User object or null if not found. Internally it uses
  Prisma's findUnique method with a where clause...
```

**Why bad**: Implementation details belong in code/JSDoc, not CLAUDE.md.

**Fix**: Document patterns and conventions, not implementation.

```markdown
## Database Layer

Use Repository pattern. All repos extend BaseRepository.

\`\`\`typescript
const user = await userRepo.findById(id)  // Returns User | null
\`\`\`
```

## Advanced Techniques

### Conditional Documentation

For projects with multiple modes:

```markdown
## Environment-Specific Setup

### Development
\`\`\`bash
cp .env.development .env
npm run dev
\`\`\`

### Production
\`\`\`bash
docker-compose up -d
\`\`\`

See @./.claude/deployment.md for detailed production setup.
```

### Version-Specific Notes

```markdown
## Migrations

Currently on Prisma 5.x. Breaking changes from 4.x:
- \`@@unique\` syntax changed
- Client generation is now async

For migration guide: @./.claude/prisma-migration.md
```

### Multi-Language Projects

```markdown
# Monorepo

## Backend (Python)
@./backend/CLAUDE.md

## Frontend (TypeScript)
@./frontend/CLAUDE.md

## Shared Conventions (Both)
- Git: Conventional Commits
- Testing: 80% coverage goal
- CI: GitHub Actions
```

## Measuring Effectiveness

### Good Signs

- ✅ New contributors get started quickly
- ✅ Common questions rarely asked
- ✅ Claude gives correct answers about project
- ✅ File stays under token budget
- ✅ Information is easy to find

### Bad Signs

- ❌ File exceeds 500 lines (project) or 200 lines (user)
- ❌ Claude gives incorrect/outdated answers
- ❌ Lots of redundant information
- ❌ Hard to find specific information
- ❌ Not updated when project changes

### Quick Audit

Ask yourself:
1. Can a new developer get started with just CLAUDE.md?
2. Are all instructions current and accurate?
3. Is it under the token budget?
4. Is information easy to scan?
5. Are imports used appropriately?

If "no" to any, time to optimize!
