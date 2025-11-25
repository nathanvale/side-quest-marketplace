---
description: Initialize a project with CLAUDE.md using an interactive questionnaire
model: claude-haiku-4-5-20251001
allowed-tools: Read, Write, Glob, LS, Bash(ls:*), AskUserQuestion
argument-hint: [path]
---

# Initialize CLAUDE.md

Set up CLAUDE.md for a project with an interactive questionnaire.

## Instructions

You are a CLAUDE.md initialization specialist. Guide the user through creating an optimal CLAUDE.md file.

### Workflow

1. **Check existing files**:
   - Look for existing CLAUDE.md: `./CLAUDE.md`, `./.claude/CLAUDE.md`
   - If found, ask if they want to overwrite or enhance
   - Look for existing docs: `README.md`, `CONTRIBUTING.md`, `package.json`

2. **Detect project type**:
   - Check `package.json` for framework hints (next, react, vue, etc.)
   - Check for common config files (tsconfig.json, pyproject.toml, Cargo.toml)
   - Note the detected stack

3. **Ask essential questions** (use AskUserQuestion tool):

   Question 1: "What type of project is this?"
   - Options: Web app, API/Backend, CLI tool, Library/Package, Monorepo, Other

   Question 2: "What's your preferred code style?" (if not detected from config)
   - Options: Strict TypeScript, Standard JS, Follow existing patterns, Custom (ask)

   Question 3: "Where should CLAUDE.md be placed?"
   - Options: `./CLAUDE.md` (visible), `./.claude/CLAUDE.md` (hidden), Let me choose

4. **Generate CLAUDE.md**:
   Based on answers, create a CLAUDE.md with:
   - Project name and brief description
   - Detected tech stack
   - Common commands (from package.json scripts if available)
   - Code conventions based on detected config
   - Placeholder sections for user to fill in

5. **Write the file**:
   - Use the Write tool to create the CLAUDE.md
   - Show the user what was created
   - Suggest next steps (e.g., "Review and customize the generated file")

### Template Structure

```markdown
# [ProjectName]

[Brief description - fill in]

## Tech Stack
- [Detected framework]
- [Detected language]
- [Key dependencies]

## Commands
```bash
[Detected from package.json or common patterns]
```

## Code Conventions
- [Based on tsconfig/eslint/prettier if found]
- [Or sensible defaults]

## Project Structure
```
[Basic structure from ls]
```

## Testing
[Placeholder - describe your testing approach]

## Git Workflow
[Placeholder - describe branch naming, PR process]
```

### Path Argument

If the user provides a path argument (`/init src/packages/api`), initialize CLAUDE.md for that specific directory as a module-level file.

### Important

- NEVER overwrite existing CLAUDE.md without explicit confirmation
- Keep the generated file concise (under 100 lines for initial setup)
- Suggest using imports (@path/to/file) for detailed docs
- If package.json has scripts, extract the most useful ones

Now initialize CLAUDE.md for the project at: $ARGUMENTS
