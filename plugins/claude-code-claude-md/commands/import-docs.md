---
description: Convert existing documentation (README, CONTRIBUTING) into CLAUDE.md format
model: claude-sonnet-4-5-20250929
allowed-tools: Read, Write, Glob, LS
argument-hint: [source-file] - e.g., README.md, CONTRIBUTING.md
---

# Import Documentation into CLAUDE.md

Convert existing documentation into CLAUDE.md format, extracting the most relevant information.

## Instructions

You are a documentation conversion specialist. Transform existing docs into optimized CLAUDE.md content.

### Arguments

- **Source file**: Path to the documentation file to import
- If no argument: Search for common docs (README.md, CONTRIBUTING.md, docs/*)

Examples:
- `/import-docs README.md` → Convert README.md
- `/import-docs CONTRIBUTING.md` → Convert contribution guidelines
- `/import-docs` → Find and offer to convert available docs

### Workflow

1. **Locate source documentation**:
   If argument provided:
   - Read the specified file

   If no argument:
   - Search for: README.md, CONTRIBUTING.md, docs/*.md, DEVELOPMENT.md
   - List found files and ask which to convert

2. **Analyze the source document**:
   Identify sections that are relevant for CLAUDE.md:

   **Extract** (high value for Claude):
   - Project setup/installation commands
   - Development commands (build, test, lint)
   - Code conventions and style guides
   - Architecture overview
   - Testing instructions
   - Common workflows
   - Environment variables
   - Key file locations

   **Skip** (low value, keep in original doc):
   - Marketing content / badges
   - License text
   - Detailed API documentation (use imports instead)
   - Screenshots / images
   - Long prose explanations
   - Changelog / release notes
   - Contributor lists

3. **Transform content**:

   **Before** (verbose README style):
   ```markdown
   ## Getting Started

   Welcome to our project! We're excited to have you here.
   To get started with development, you'll need to follow
   these steps carefully...

   First, make sure you have Node.js installed (version 18
   or higher is recommended). Then, clone the repository
   and run the following commands:
   ```

   **After** (concise CLAUDE.md style):
   ```markdown
   ## Setup
   - Node.js 18+
   ```bash
   git clone <repo> && cd <project>
   npm install
   npm run dev
   ```
   ```

4. **Generate CLAUDE.md content**:

   Structure the output as:
   ```markdown
   # [Project Name]

   [One-line description extracted from README]

   ## Tech Stack
   [Extracted from README or package.json]

   ## Commands
   ```bash
   [Extracted commands]
   ```

   ## Code Conventions
   [Extracted style guidelines]

   ## Project Structure
   [Extracted or summarized]

   ## Testing
   [Extracted testing info]

   ## Detailed Docs
   @./README.md
   @./CONTRIBUTING.md
   ```

5. **Present the result**:
   - Show the generated CLAUDE.md content
   - Ask if user wants to:
     a) Write to ./CLAUDE.md (new file)
     b) Append to existing CLAUDE.md
     c) Copy to clipboard (show content only)
   - Warn if it exceeds recommended token budget

### Conversion Rules

| Source Pattern | CLAUDE.md Format |
|---------------|------------------|
| "You should..." / "We recommend..." | Direct imperative: "Use..." |
| Paragraphs of explanation | Bullet points |
| Detailed API docs | Import reference: `@./docs/api.md` |
| Multiple code examples | Single canonical example |
| Optional/advanced content | Omit or import |

### Important

- NEVER lose critical setup information during conversion
- Preserve exact command syntax (don't paraphrase shell commands)
- Keep the original documentation files intact
- Use imports (@path) for detailed sections rather than duplicating
- Target 100-200 lines for the converted content
- If source is very long, prioritize: commands > conventions > architecture

### Output

After conversion, provide:
1. The converted CLAUDE.md content
2. Summary of what was extracted vs. skipped
3. Recommendations for imports if content was too long
4. Next steps (write file, review, customize)

Now import documentation from: $ARGUMENTS
