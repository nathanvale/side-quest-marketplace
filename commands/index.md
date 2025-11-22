---
name: index
description: Create or update PROJECT_INDEX.json for the current project
---

# PROJECT_INDEX Command

This command creates or updates a PROJECT_INDEX.json file that gives Claude architectural awareness
of your codebase.

The indexer script is located at: `~/.claude-code-project-index/scripts/project_index.py`

## What it does

The PROJECT_INDEX creates a comprehensive map of your project including:

- Directory structure and file organization
- Function and class signatures with type annotations
- Call graphs showing what calls what
- Import dependencies
- Documentation structure
- Directory purposes

## Usage

Simply type `/index` in any project directory to create or update the index.

## About the Tool

**PROJECT_INDEX** is a community tool created by Eric Buess that helps Claude Code understand your
project structure better.

- **GitHub**: https://github.com/ericbuess/claude-code-project-index
- **Purpose**: Prevents code duplication, ensures proper file placement, maintains architectural
  consistency
- **Philosophy**: Fork and customize for your needs - Claude can modify it instantly

## How to Use the Index

After running `/index`, you can:

1. Reference it directly: `@PROJECT_INDEX.json what functions call authenticate_user?`
2. Use with -i flag: `refactor the auth system -i`
3. Add to CLAUDE.md for auto-loading: `@PROJECT_INDEX.json`

## Implementation

When you run `/index`, Claude will:

1. Check if PROJECT_INDEX is installed at ~/.claude-code-project-index
2. Run the indexer script at ~/.claude-code-project-index/scripts/project_index.py to create/update
   PROJECT_INDEX.json
3. Provide feedback on what was indexed
4. The index is then available as PROJECT_INDEX.json

## Troubleshooting

If the index is too large for your project, ask Claude: "The indexer creates too large an index.
Please modify it to only index src/ and lib/ directories"

For other issues, the tool is designed to be customized - just describe your problem to Claude!
