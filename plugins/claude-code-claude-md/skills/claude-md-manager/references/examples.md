# Real-World CLAUDE.md Examples

## Table of Contents
- [User-Level Examples](#user-level-examples)
- [Project-Level Examples](#project-level-examples)
- [Module-Level Examples](#module-level-examples)
- [Import Chain Example](#import-chain-example)
- [Monorepo Example](#monorepo-example)

## User-Level Examples

### Example 1: Minimalist Developer

**File**: `~/.claude/CLAUDE.md`

```markdown
# Development Preferences

## Style
- Be concise, skip pleasantries
- Code over words

## Git
- Conventional commits required
- Squash merge PRs

## Code
- TypeScript strict mode
- No `any` types
- Functional over OOP
```

**Analysis**:
- Very concise (under 50 lines)
- Clear, actionable preferences
- Applies globally to all projects

### Example 2: Detailed Preferences

**File**: `~/.claude/CLAUDE.md`

```markdown
# My Claude Code Workflow

## Communication
- Technical but friendly tone
- Explain architectural decisions
- No emojis except in commit messages
- Ask before major refactors

## Development Workflow
- Always create CLAUDE.md for new projects
- Write tests first (TDD when possible)
- Run linter before committing
- Create feature branches from main

## Code Style

### TypeScript
- Strict mode always
- Explicit return types for exported functions
- Use `interface` over `type` for objects
- Prefer readonly properties
- No default exports (use named exports)

### React
- Functional components only
- Custom hooks for reusable logic
- Prefer composition over props drilling
- Keep components under 150 lines

### Testing
- Vitest over Jest
- Testing Library for React
- Aim for 80% coverage on new code
- Integration tests over unit tests

## Tools
- Bun for package management
- Biome for linting and formatting
- Prefer built-in tools over bash commands

## Anti-Patterns
- No abbreviated variable names
- No nested ternaries
- No magic numbers (use constants)
- No `useEffect` for data fetching (use react-query)
```

**Analysis**:
- Comprehensive but still under 200 lines
- Specific, actionable guidelines
- Covers multiple languages/frameworks
- Clear anti-patterns

## Project-Level Examples

### Example 1: Next.js Application

**File**: `<project>/CLAUDE.md`

```markdown
# TaskFlow - Project Management App

## Tech Stack
- Next.js 14 (App Router)
- TypeScript 5.3
- Tailwind CSS 3.4
- Prisma ORM
- PostgreSQL 16
- NextAuth.js for authentication

## Project Structure
\`\`\`
src/
  app/              # Next.js app router pages
  components/       # React components
    ui/             # Reusable UI components
    features/       # Feature-specific components
  lib/              # Utilities and helpers
  server/           # Server actions and API
prisma/
  schema.prisma     # Database schema
  migrations/       # Database migrations
\`\`\`

## Common Commands
\`\`\`bash
bun install                # Install dependencies
bun dev                    # Development server (localhost:3000)
bun test                   # Run test suite
bun run db:push            # Push schema changes to DB
bun run db:studio          # Open Prisma Studio
bun run lint               # Lint and format
\`\`\`

## Development Setup

### Prerequisites
- Bun 1.0+
- PostgreSQL 16
- Node.js 20+ (for some tooling)

### First-Time Setup
1. \`bun install\`
2. Copy \`.env.example\` to \`.env\`
3. Update DATABASE_URL in \`.env\`
4. \`bun run db:push\`
5. \`bun dev\`

### Environment Variables
- \`DATABASE_URL\`: PostgreSQL connection string
- \`NEXTAUTH_SECRET\`: Generate with \`openssl rand -base64 32\`
- \`NEXTAUTH_URL\`: App URL (http://localhost:3000 for dev)

## Code Conventions

### React Components
- Use Server Components by default
- Add "use client" only when needed (interactivity, hooks, browser APIs)
- Prefer Server Actions over API routes for mutations
- Keep components under 200 lines
- Extract complex logic to hooks or utilities

### Database
- All queries through Prisma
- Use transactions for multi-model operations
- Include error handling for unique constraint violations
- Use \`select\` to avoid over-fetching

### Testing
- Components: Vitest + Testing Library
- Server Actions: Integration tests with test DB
- Use \`createMockSession()\` for auth tests
- Coverage goal: 80% on new code

## Repository Workflow

### Branching
- Main branch: \`main\`
- Feature branches: \`feature/description\`
- Bug fixes: \`fix/description\`

### Commits
- Use Conventional Commits
- Format: \`type(scope): description\`
- Types: feat, fix, docs, refactor, test, chore
- Run \`bun run lint\` before committing

### Pull Requests
- Create PR against \`main\`
- Require 1 approval
- Squash and merge
- Delete branch after merge

## Known Issues
- Prisma Studio sometimes locks DB (restart if issues)
- NextAuth session refresh can be slow (known Next.js issue)
- TailwindCSS IntelliSense needs restart after config changes

## Architecture Details
@./.claude/architecture.md
@./.claude/api-patterns.md
@./.claude/auth-flow.md
```

**Analysis**:
- Comprehensive but under 500 lines
- Immediately useful (setup, commands)
- Clear conventions
- Uses imports for detailed docs

### Example 2: Python Data Pipeline

**File**: `<project>/CLAUDE.md`

```markdown
# DataFlow ETL Pipeline

## Overview
Processes customer data from multiple sources, transforms it, and loads into data warehouse.

## Tech Stack
- Python 3.11
- Apache Airflow 2.8
- Pandas 2.1
- SQLAlchemy 2.0
- PostgreSQL (source) + Snowflake (warehouse)

## Project Structure
\`\`\`
dags/               # Airflow DAGs
  extractors/       # Data extraction logic
  transformers/     # Data transformation logic
  loaders/          # Data loading logic
utils/              # Shared utilities
tests/              # Test suite
config/             # Configuration files
\`\`\`

## Common Commands
\`\`\`bash
# Development
poetry install              # Install dependencies
poetry run pytest           # Run tests
poetry run black .          # Format code
poetry run mypy .           # Type checking

# Airflow
airflow db init            # Initialize database
airflow scheduler          # Start scheduler
airflow webserver          # Start web UI (localhost:8080)
airflow dags test <dag_id> # Test DAG
\`\`\`

## Code Conventions

### Python Style
- Black for formatting (line length: 100)
- Type hints required for all functions
- Docstrings for public functions (Google style)
- Use pathlib over os.path
- Use f-strings for formatting

### Airflow DAGs
- One DAG per data source
- Tasks use KubernetesPodOperator
- Set retries=2, retry_delay=5min
- Use XComs sparingly (pass data via storage)

### Data Transformation
- Use Pandas for in-memory transformations
- Switch to Dask for datasets >1GB
- Validate schema with Pandera
- Log row counts at each stage

### Testing
- Pytest for all tests
- Mock external APIs and databases
- Test DAGs with \`airflow dags test\`
- Coverage goal: 90%

## Configuration

### Environment Variables
- \`AIRFLOW__CORE__SQL_ALCHEMY_CONN\`: Airflow metadata DB
- \`AIRFLOW__CORE__EXECUTOR\`: Use KubernetesExecutor
- \`SNOWFLAKE_ACCOUNT\`: Snowflake account ID
- \`SNOWFLAKE_USER\`: Service account username
- \`SNOWFLAKE_PASSWORD\`: From secrets manager

### Secrets Management
- Use Airflow Secrets Backend (AWS Secrets Manager)
- Never commit credentials
- Rotate keys quarterly

## Development Workflow

1. Create feature branch
2. Write tests first
3. Implement feature
4. Run \`poetry run pytest\` and \`poetry run mypy\`
5. Test DAG locally
6. Create PR with description of data changes

## Known Issues
- Airflow scheduler sometimes stalls (restart if DAGs not triggering)
- Large Pandas operations can OOM (use chunking or switch to Dask)
- Snowflake connector has known SSL issue on macOS (ignore warning)

@./.claude/dag-patterns.md
@./.claude/data-schemas.md
```

**Analysis**:
- Different domain (data engineering)
- Clear setup and testing instructions
- Domain-specific conventions (Airflow, data processing)
- Appropriate imports for detailed schemas

## Module-Level Examples

### Example 1: Authentication Module

**File**: `<project>/features/auth/CLAUDE.md`

```markdown
# Authentication Module

## Purpose
Handles user authentication, session management, and role-based access control using NextAuth.js.

## Key Files
- \`auth-provider.tsx\`: React context for auth state
- \`auth-actions.ts\`: Server actions for login/logout/signup
- \`middleware.ts\`: Route protection middleware
- \`session.ts\`: Session utilities and helpers
- \`config.ts\`: NextAuth configuration

## Authentication Flow

1. User submits credentials via login form
2. \`signInAction()\` validates credentials
3. NextAuth creates session
4. Middleware protects subsequent requests
5. Session stored in encrypted JWT cookie

## Patterns

### Login/Logout
\`\`\`typescript
// Use server actions, not API routes
import { signInAction, signOutAction } from './auth-actions'

// In component
async function handleLogin(formData: FormData) {
  const result = await signInAction(formData)
  if (result.error) {
    // Handle error
  }
}
\`\`\`

### Protected Routes
\`\`\`typescript
// middleware.ts automatically protects /dashboard/*
// For programmatic checks:
import { requireAuth } from './session'

export async function myServerAction() {
  const session = await requireAuth() // throws if not authenticated
  // ...
}
\`\`\`

### Role-Based Access
\`\`\`typescript
import { requireRole } from './session'

export async function adminAction() {
  await requireRole('ADMIN') // throws if not admin
  // ...
}
\`\`\`

## Security

- Passwords hashed with bcrypt (salt rounds: 12)
- Sessions expire after 30 days
- CSRF protection via NextAuth
- Rate limiting on login endpoint (5 attempts/15min)

## Testing

Use \`createMockSession()\` helper:

\`\`\`typescript
import { createMockSession } from './test-utils'

test('protected action requires auth', async () => {
  const session = createMockSession({ role: 'USER' })
  // Test with session
})
\`\`\`

## Known Issues
- Session refresh can take 2-3 seconds (NextAuth limitation)
- SSR pages with auth check have network waterfall (use middleware)
```

**Analysis**:
- Tightly scoped to auth module
- Includes code examples
- Security considerations
- Testing guidance
- Under 100 lines

### Example 2: Database Module (Microservice)

**File**: `<project>/services/api/database/CLAUDE.md`

```markdown
# Database Layer

## Purpose
Provides data access layer for API service using Repository pattern with Prisma.

## Structure
\`\`\`
database/
  client.ts         # Prisma client singleton
  repositories/     # Repository classes
    UserRepository.ts
    PostRepository.ts
  migrations/       # Prisma migrations
  seed.ts          # Database seeding
\`\`\`

## Patterns

### Repository Pattern
All database access goes through repositories:

\`\`\`typescript
import { UserRepository } from './repositories/UserRepository'

const userRepo = new UserRepository()
const user = await userRepo.findById(userId)
\`\`\`

### Transactions
Use \`prisma.$transaction()\` for multi-model operations:

\`\`\`typescript
await prisma.$transaction([
  prisma.user.update({ ... }),
  prisma.post.create({ ... })
])
\`\`\`

### Query Optimization
Always select only needed fields:

\`\`\`typescript
// Bad
const user = await prisma.user.findUnique({ where: { id } })

// Good
const user = await prisma.user.findUnique({
  where: { id },
  select: { id: true, email: true, name: true }
})
\`\`\`

## Error Handling

\`\`\`typescript
import { Prisma } from '@prisma/client'

try {
  await userRepo.create(data)
} catch (error) {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') {
      // Unique constraint violation
    }
  }
  throw error
}
\`\`\`

## Testing

Use test database with seeded data:

\`\`\`bash
DATABASE_URL="postgresql://test:test@localhost:5433/test_db" bun test
\`\`\`

Reset DB between tests:
\`\`\`typescript
beforeEach(async () => {
  await prisma.$executeRaw\`TRUNCATE TABLE users CASCADE\`
})
\`\`\`
```

**Analysis**:
- Module-specific patterns (Repository)
- Concrete code examples
- Testing approach for this module
- Under 100 lines

## Import Chain Example

### Main File

**File**: `<project>/CLAUDE.md`

```markdown
# TaskFlow Project

## Overview
Project management application with Kanban boards, time tracking, and team collaboration.

## Quick Start
\`\`\`bash
bun install
cp .env.example .env
bun dev
\`\`\`

## Tech Stack
- Next.js 14, TypeScript, Tailwind CSS
- Prisma + PostgreSQL

## Detailed Documentation
@./.claude/architecture.md
@./.claude/conventions.md
```

### First-Level Import

**File**: `<project>/.claude/architecture.md`

```markdown
# Architecture

## Overview
3-tier architecture: UI → API Layer → Database

## Frontend
Next.js App Router with React Server Components
@./architecture/frontend.md

## Backend
Server Actions and API routes
@./architecture/backend.md

## Database
PostgreSQL with Prisma ORM
@./architecture/database.md
```

### Second-Level Imports

**File**: `<project>/.claude/architecture/frontend.md`

```markdown
# Frontend Architecture

## Component Structure
- Server Components for static content
- Client Components for interactivity
- Shared UI components in /components/ui

## State Management
- Server state: React Query
- Client state: Zustand
- Form state: React Hook Form

## Routing
App Router with parallel routes for modals

... detailed frontend docs ...
```

**Analysis**:
- Progressive disclosure (overview → details)
- Organized by domain (frontend/backend/database)
- Easy to navigate
- Each file stays focused

## Monorepo Example

**File**: `<monorepo>/CLAUDE.md`

```markdown
# Acme Monorepo

## Structure
- \`apps/web\`: Customer web app (Next.js)
- \`apps/admin\`: Internal admin panel (Next.js)
- \`apps/mobile\`: Mobile app (React Native)
- \`packages/ui\`: Shared UI components
- \`packages/api-client\`: API client library
- \`packages/database\`: Prisma schema and client

## Commands
\`\`\`bash
bun install          # Install all dependencies
bun dev              # Run all apps in dev mode
bun build            # Build all apps and packages
bun test             # Test all workspaces
\`\`\`

## Conventions
- TypeScript strict mode everywhere
- No cross-app imports (only import from packages)
- Shared components go in packages/ui
- Changesets for versioning
```

**File**: `<monorepo>/apps/web/CLAUDE.md`

```markdown
# Customer Web App

## Purpose
Public-facing web application for customers.

## Tech Stack
- Next.js 14 App Router
- TypeScript 5.3
- Tailwind CSS

## Commands
\`\`\`bash
bun dev              # Dev server (localhost:3000)
bun build            # Production build
bun test             # Run tests
\`\`\`

## Conventions
- Import UI from \`@acme/ui\`
- Import API client from \`@acme/api-client\`
- Use Server Components by default

## Environment Variables
- \`NEXT_PUBLIC_API_URL\`: API endpoint
- \`DATABASE_URL\`: From @acme/database package
```

**Analysis**:
- Monorepo root has shared conventions
- Each app has its own CLAUDE.md
- Clear separation of concerns
- Appropriate level of detail at each level
