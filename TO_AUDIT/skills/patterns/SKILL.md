---
name: agent-cli
description: >
  Patterns for building CLIs that serve both humans and AI agents. Covers tri-modal output
  (JSON/JSONL/human), typed exit codes, structured error contracts, zero-dependency arg parsing,
  topic-based help, service discovery, field projection, and auto agent-mode detection.
  Reference implementation: @side-quest/observability CLI.
  Use when: building a CLI, adding a command, CLI output format, agent-friendly CLI,
  machine-readable output, JSON CLI contract, exit codes, --json flag, NDJSON streaming,
  how should my CLI work with agents, CLI design patterns.
allowed-tools: Read, Glob, Grep
---

# Agent-Native CLI Patterns

Patterns for building CLIs that work for humans and AI agents, based on the @side-quest/observability reference implementation.

## Reference Implementation

**File:** `packages/server/src/cli/command.ts` (1634 lines)
**Tests:** `packages/server/src/cli/command.test.ts`
**Repo:** `~/code/side-quest-observability`

This is a production CLI that demonstrates every pattern documented here. When answering questions, read the relevant sections of `command.ts` to show real code -- not hypothetical examples.

## Classification

Route the user's question to the appropriate reference file based on their intent.

| Intent | Trigger Signals | Reference File |
|--------|----------------|----------------|
| Output format | JSON, JSONL, human output, --json, machine-readable, output contract | `references/output-contract.md` |
| Exit codes | exit code, return code, error code, process exit, status code | `references/exit-codes.md` |
| Error handling | error format, error contract, stderr, structured errors, error JSON | `references/error-handling.md` |
| Arg parsing | parse args, flags, commands, zero-dep, yargs alternative, commander | `references/arg-parsing.md` |
| Help system | --help, topic help, self-documenting, help text, usage | `references/help-system.md` |
| Service discovery | port file, pid file, find server, discovery, cache dir | `references/service-discovery.md` |
| Field projection | --fields, dot-path, minimal output, tokens, field selection | `references/field-projection.md` |
| Agent mode | non-TTY, headless, --non-interactive, pipe detection, automation | `references/agent-mode.md` |
| Community research | who's doing this, sources, references, prior art, standards | `references/community-sources.md` |

For questions that span multiple topics, read the primary reference first, then supplement from related references.

## Response Structure

When answering a question routed through this skill:

1. **Direct answer** - one line answering the specific question
2. **Pattern explanation** - describe the pattern with code from the reference implementation (read the actual file, don't invent code)
3. **Implementation checklist** - concrete steps to implement this pattern
4. **Community validation** - cite 1-2 community sources that validate this approach (from `references/community-sources.md`)

## Examples

### "How should I format my CLI output for agents?"

Route to: `references/output-contract.md`

Answer flow: Explain tri-modal output (human/JSON/JSONL) -> show `writeSuccess` from command.ts -> checklist for adding a new command -> cite joelclaw.com and Laminar.

### "What exit codes should my CLI use?"

Route to: `references/exit-codes.md`

Answer flow: Show the typed exit code table -> explain why typed codes matter for agents -> show the TypeScript type -> checklist -> note that no community standard exists yet.

### "Should I use commander or yargs?"

Route to: `references/arg-parsing.md`

Answer flow: Recommend zero-dep manual parsing -> show the discriminated union pattern -> explain agent compatibility -> cite @yacineMTB -> checklist.

### "How do I make my CLI work in CI/CD pipelines?"

Route to: `references/agent-mode.md`

Answer flow: Explain auto non-TTY detection -> show `shouldUseAutomaticMachineMode()` -> explain `--non-interactive` -> cite Laminar and @Douglance -> checklist.

## Core Principle

> Every CLI command has three audiences: humans at a terminal, agents parsing output, and agents piping to other tools. Design for all three simultaneously.

This means:
- **Human mode** (default): Prose output with prefixed lines, readable formatting
- **JSON mode** (`--json`): Structured envelope on stdout, parseable by agents
- **JSONL mode** (`--jsonl`): One JSON object per line, pipeable to `jq`, other CLIs, or agent chains
- **Auto mode**: When stdout is not a TTY, automatically switch to machine-friendly output

## What This Skill Does NOT Cover

- HTTP API design (that's a different pattern set)
- MCP server implementation (see MCP builder skill)
- General TypeScript patterns (future engineering skill)
- Testing patterns for CLIs (future engineering skill)
- Deployment or packaging (see bun-typescript-starter)
