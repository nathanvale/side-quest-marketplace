---
description: Extract documentation into structured context, then invoke /create to generate CLAUDE.md
model: claude-sonnet-4-5-20250929
allowed-tools: Read, Glob, LS
argument-hint: [source-file] - e.g., README.md, CONTRIBUTING.md
---

# Import Documentation into CLAUDE.md

Extract relevant information from existing docs, then invoke `/create` with that context.

## Why Composable?

This command **extracts and structures** data, then delegates to `/create` which:
- Has the official templates for each level (user/project/module)
- Knows the token budgets and best practices
- Handles file writing and next steps

**Flow:**
```
/import-docs README.md
  → Extract: commands, conventions, structure
  → Output: structured context block
  → User runs: /create project (with context pre-filled)
```

## Instructions

### 1. Locate Source Documentation

If argument provided:
- Read the specified file

If no argument:
- Search for: README.md, CONTRIBUTING.md, docs/*.md, DEVELOPMENT.md, package.json
- List found files and ask which to convert

### 2. Extract Relevant Information

**High Value (extract):**
| Category | What to Look For |
|----------|------------------|
| Commands | Scripts in package.json, "Getting Started", "Development" sections |
| Tech Stack | Dependencies, frameworks, language versions |
| Structure | Directory explanations, architecture sections |
| Conventions | Code style, linting, formatting rules |
| Testing | Test commands, coverage requirements, test structure |
| Git Workflow | Branch naming, commit format, PR process |
| Environment | Required env vars, setup steps |

**Low Value (skip):**
- Marketing content, badges, logos
- License text (reference only)
- Detailed API docs (use @import)
- Screenshots, images
- Changelog, release notes
- Contributor lists

### 3. Transform to Structured Context

Output the extracted data in this format:

```markdown
## Extracted Context for /create

### Project Info
- **Name**: [from package.json or README title]
- **Description**: [one-line from README]
- **Tech Stack**: [detected languages, frameworks]

### Directory Structure
```
[extracted or generated tree]
```

### Commands
```bash
[extracted commands with comments]
```

### Key Files
- `[file]` — [purpose]

### Code Conventions
- [extracted conventions]

### Git Workflow
- Branch: [format]
- Commit: [format]

### Testing
- Command: `[test command]`
- [other testing info]

### Environment
- [required env vars]

### Source References
- @./README.md — Full project documentation
- @./CONTRIBUTING.md — Contribution guidelines
- @./docs/architecture.md — Detailed architecture
```

### 4. Conversion Rules

| Source Pattern | Extracted Format |
|----------------|------------------|
| "You should..." / "We recommend..." | Direct: "Use X" |
| Paragraphs of explanation | Bullet points |
| Multiple examples | Single canonical example |
| `npm run X` in prose | Extracted to Commands section |
| Directory explanations | File tree with annotations |
| Long detailed sections | @import reference |

### 5. Present Results and Next Steps

Output format:

```markdown
## Documentation Extracted

[Show the structured context block from step 3]

---

## Extraction Summary

| Category | Status | Lines |
|----------|--------|-------|
| Commands | ✅ Extracted | X |
| Structure | ✅ Extracted | X |
| Conventions | ⚠️ Not found | - |
| Testing | ✅ Extracted | X |

**Total extracted:** ~X lines
**Recommended imports:** [list any sections that were too long]

---

## Next Step

Run `/create project` and paste the extracted context above when prompted,
or copy this ready-to-use command:

\`\`\`
/create project
\`\`\`

The create command will:
1. Use the project-level template
2. Incorporate your extracted context
3. Generate a properly structured CLAUDE.md
4. Apply token budget guidelines (100-200 lines)

---

## Manual Adjustments Needed

After running /create, you may want to add:
- [ ] [specific thing not found in docs]
- [ ] [another gap identified]
```

### 6. Alternative: Direct Generation

If user says "just generate it" or wants immediate output:

```markdown
I've extracted the context above. You have two options:

**Option A: Use /create (recommended)**
Run `/create project` — uses official templates, consistent structure

**Option B: Direct output**
I can generate CLAUDE.md directly, but it won't use the standardized templates.
Want me to proceed with direct generation?
```

## Quick Extraction Templates

### From package.json

```javascript
// Extract these fields:
{
  "name": "→ Project name",
  "description": "→ One-liner",
  "scripts": {
    "dev": "→ Commands section",
    "build": "→ Commands section",
    "test": "→ Testing section",
    "lint": "→ Commands section"
  },
  "dependencies": "→ Tech stack",
  "devDependencies": "→ Tech stack (tooling)"
}
```

### From README.md

```markdown
# Title → Project name
First paragraph → Description

## Installation / Getting Started → Commands
## Development → Commands + Conventions
## Testing → Testing section
## Project Structure → Directory structure
## Contributing → Git workflow (or @import)
## Architecture → @import reference
```

### From CONTRIBUTING.md

```markdown
## Code Style → Conventions
## Commit Messages → Git workflow
## Pull Requests → Git workflow
## Testing Requirements → Testing
```

## Example Output

**Input:** README.md with 500 lines

**Output:**
```markdown
## Extracted Context for /create

### Project Info
- **Name**: my-awesome-api
- **Description**: REST API for user management with TypeScript and Express
- **Tech Stack**: TypeScript, Express, PostgreSQL, Jest

### Directory Structure
```
my-awesome-api/
├── src/
│   ├── controllers/    # Route handlers
│   ├── models/         # Database models
│   ├── middleware/     # Express middleware
│   └── index.ts        # Entry point
├── tests/              # Jest tests
└── docs/               # API documentation
```

### Commands
```bash
npm install            # Install dependencies
npm run dev            # Start dev server (port 3000)
npm run build          # Production build
npm test               # Run Jest tests
npm run lint           # ESLint check
```

### Key Files
- `src/index.ts` — Application entry point
- `src/config.ts` — Environment configuration
- `.env.example` — Required environment variables

### Code Conventions
- TypeScript strict mode
- ESLint + Prettier
- Functional style preferred

### Git Workflow
- Branch: `feature/[ticket]-[description]`
- Commit: `type(scope): subject`

### Testing
- Command: `npm test`
- Coverage minimum: 80%
- Tests mirror src/ structure

### Source References
- @./README.md — Full documentation
- @./docs/api.md — API reference

---

## Next Step

Run `/create project` to generate CLAUDE.md with this context.
```

Now extract documentation from: $ARGUMENTS
