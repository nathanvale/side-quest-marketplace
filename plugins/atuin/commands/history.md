---
description: Search bash command history using Atuin
argument-hint: [search-query]
---

# Search Bash History

Search through your bash command history using Atuin. This command helps you find previously executed commands with their exit codes and timestamps.

## Your Task

Search the bash history for commands matching: $ARGUMENTS

Use the `mcp__bash-history__search_history` tool to search for matching commands. If no search query is provided, use `mcp__bash-history__get_recent_history` to show recent commands.

Display the results clearly, showing:
- The command that was executed
- Whether it succeeded or failed (exit code)
- When it was run

If the user is looking for a specific workflow or pattern, help them identify the relevant commands and explain what they do.
