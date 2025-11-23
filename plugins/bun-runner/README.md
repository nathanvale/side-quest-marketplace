# Bun Runner Plugin

This plugin provides a safe and structured way to run Bun tests and Biome linting within Claude Code sessions.

## Features

- **Smart Test Runner**: Runs `bun test` with timeouts and CI mode to prevent hanging sessions.
- **Structured Output**: Returns concise summaries of test failures and linting errors.
- **Token Efficient**: Avoids dumping massive logs into the context unless necessary.

## MCP Servers

- `bun-runner`: Provides `run_tests` and `lint_check` tools.
