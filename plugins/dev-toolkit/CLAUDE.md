# dev-toolkit Plugin

Development skills for building CLI tools with Bun, runtime workflows, and developer experience patterns.

---

## Overview

**Type:** Skills-focused plugin
**Status:** Phase 1 (Foundation) — 3 core skills implemented
**Target Users:** Bun developers, CLI tool builders, teams improving DX
**Roadmap:** ROADMAP.md

---

## Skills (8 Total, 8 Implemented)

### ✅ Implemented Skills

#### 1. **Bun CLI Development**
- **SKILL.md:** `skills/bun-cli/SKILL.md` (progressively disclosed, ~470 lines)
- **Content:** Argument parsing patterns, dual output formats, error handling, subcommands, testing
- **Reference:** `skills/bun-cli/references/bun-cli-patterns.md`
  - Comprehensive 14-section CLI standard with patterns
  - Para Obsidian CLI case study (9/10 score)
  - Examples, checklist, anti-patterns, migration guide
- **Scripts:**
  - `skills/bun-cli/scripts/scaffold-cli.ts` — Generate CLI scaffolds
  - `skills/bun-cli/scripts/review-cli.ts` — Review against standard
- **Key Points:**
  - Manual argument parsing (not oclif/yargs)
  - Both markdown (default) and JSON output
  - Consistent error handling with context
  - Clear, scannable usage text with examples

#### 2. **Bun Runtime Workflows**
- **SKILL.md:** `skills/bun-runtime/SKILL.md`
- **Content:** bunx patterns, monorepo management, lockfile strategies, performance optimization, integration patterns
- **Covers:**
  - `bunx` for no-global-install workflows
  - Bun workspaces for monorepos
  - `bun.lockb` for reproducible builds
  - Built-in bundler and test runner
  - 4x faster startup than Node.js
- **Practical Examples:**
  - Monorepo setup with cross-workspace dependencies
  - Workflow: dev → test → build
  - Integration with Next.js, Vite, TypeScript
- **Key Points:**
  - Single binary: runtime + pkg manager + bundler + test runner
  - Faster than Node by design (Rust, JavaScriptCore)
  - Workspace protocol `workspace:*` for local deps

#### 3. **Bun Filesystem Helpers**
- **SKILL.md:** `skills/bun-fs-helpers/SKILL.md`
- **Content:** Pure Bun-native filesystem utilities from @side-quest/core/fs
- **Covers:**
  - File existence checks (pathExists, pathExistsSync)
  - Reading/writing files (text and JSON, async and sync)
  - Directory operations (ensureDir, readDir)
  - File operations (copy, move, rename, delete)
  - File stats and hashing (SHA256, xxHash64)
  - TOCTOU protection patterns
  - Migration guide from node:fs
- **Key Points:**
  - Zero node:fs dependencies
  - Command injection safe (array args only)
  - Token-efficient imports
  - Performance characteristics documented
  - Security guarantees (TOCTOU, atomic writes)

#### 4. **Developer Experience (DX) Patterns**
- **SKILL.md:** `skills/dx-patterns/SKILL.md`
- **Content:** DX Framework, feedback loops, cognitive load, flow state, ADHD-friendly patterns
- **Covers:**
  - Three pillars of DX (feedback, cognitive load, flow)
  - Progressive disclosure in UI/docs
  - Measurable skill matrices
  - ADHD-specific patterns (context switching, progress signals)
  - Practical metrics (time to first success, error clarity)
- **Key Points:**
  - Based on Greiler/Storey/Noda research
  - Applicable to tools, docs, code organization, workflows
  - ADHD-friendly patterns benefit everyone
  - Measurable improvements (< 10 min setup, < 5s feedback)

#### 5. **MCP Development**
- **SKILL.md:** `skills/mcp-development/SKILL.md`
- **Content:** Model Context Protocol server development patterns
- **Covers:**
  - MCP server architecture and tool naming conventions
  - Response format patterns (markdown/JSON)
  - Error handling and validation
  - Testing strategies for MCP tools

#### 6. **Inbox Processing Expert**
- **SKILL.md:** `skills/inbox-processing-expert/SKILL.md`
- **Content:** Security-hardened automation framework for processing inbox items
- **Covers:**
  - Engine/interface separation architecture
  - 7 P0 critical security patterns (TOCTOU, command injection, atomic writes)
  - Suggestion-based processing (never mutate directly)
  - Interactive CLI patterns
  - 23-error taxonomy across 7 categories
  - Structured logging with correlation IDs
- **Key Points:**
  - Production-grade security patterns
  - Idempotency with SHA256 registry
  - Confidence scoring (HIGH/MEDIUM/LOW)
  - 246 tests across 10 files

#### 7. **Observability** (NEW)
- **SKILL.md:** `skills/observability/SKILL.md`
- **Content:** Structured logging, correlation IDs, performance metrics, debugging workflows
- **Covers:**
  - Plugin logger factory pattern (@side-quest/core/logging)
  - Hierarchical subsystem loggers (plugin → subsystem → submodule)
  - Correlation ID patterns for request tracing
  - Log levels best practices (DEBUG/INFO/WARN/ERROR)
  - Automatic metrics collection (MetricsCollector)
  - JSONL log analysis (grep, jq queries)
  - Production debugging workflows
- **Key Points:**
  - LogTape + JSONL for machine-parseable logs
  - File rotation (1 MiB, 5 files default)
  - 8-character correlation IDs for tracing
  - Performance metrics aggregation (min/max/avg, error rates)
  - Centralized log location (~/.claude/logs/)
  - Real-world examples from para-obsidian, cinema-bandit, kit

### 📋 Planned Skills (Phase 2+)

See ROADMAP.md for:
- TypeScript CLI Best Practices
- MCP Server Development
- Monorepo Management
- Test-Driven Development (TDD)
- Plugin Validation & Quality
- Documentation Patterns
- Git Workflow Automation

---

## Directory Structure

```
plugins/dev-toolkit/
├── .claude-plugin/
│   └── plugin.json                 # Plugin metadata (4 skills registered)
├── package.json                    # Stub package (markdown-only)
├── ROADMAP.md                      # Future skills + consolidation notes
├── CLAUDE.md                       # This file
├── commands/
│   └── sample.md                   # Sample slash command (template)
├── skills/
│   ├── dev-toolkit/
│   │   └── SKILL.md               # Intro skill (overview)
│   ├── bun-cli/
│   │   ├── SKILL.md               # Lean skill (~470 lines) with TOC and progressive disclosure
│   │   ├── references/
│   │   │   └── bun-cli-patterns.md # Consolidated reference (patterns + Para Obsidian case study)
│   │   └── scripts/
│   │       ├── scaffold-cli.ts    # CLI scaffolder (stub)
│   │       └── review-cli.ts      # CLI reviewer (stub)
│   ├── bun-runtime/
│   │   └── SKILL.md               # Bun runtime workflows
│   ├── bun-fs-helpers/
│   │   └── SKILL.md               # Pure Bun-native filesystem utilities
│   └── dx-patterns/
│       └── SKILL.md               # Developer experience patterns
```

---

## Usage

### Accessing Skills

Skills are available in Claude Code context automatically:

```
When you need help with Bun CLI development:
  > I'm building a CLI tool with Bun, what patterns should I follow?
  → Claude will reference: Bun CLI Development skill

When optimizing workflows:
  > How do I set up a monorepo with Bun?
  → Claude will reference: Bun Runtime Workflows skill

When improving DX:
  > How can I make my tool more user-friendly?
  → Claude will reference: Developer Experience Patterns skill
```

### Skill Triggers

Each skill responds to natural language patterns:

**Bun CLI Development triggers:**
- "bun cli"
- "command line tool"
- "argument parsing"
- "cli development"
- "cli architecture"

**Bun Runtime Workflows triggers:**
- "bun runtime"
- "bunx"
- "monorepo"
- "bun workflows"
- "bun performance"

**Bun Filesystem Helpers triggers:**
- "bun fs"
- "filesystem helpers"
- "@side-quest/core/fs"
- "command injection safe"
- "node:fs alternative"
- "bun-native filesystem"

**DX Patterns triggers:**
- "developer experience"
- "dx patterns"
- "developer productivity"
- "adhd-friendly"
- "cognitive load"
- "workflow optimization"

**MCP Development triggers:**
- "mcp server"
- "model context protocol"
- "mcp tools"
- "mcp development"

**Inbox Processing Expert triggers:**
- "inbox processing"
- "security patterns"
- "TOCTOU"
- "command injection"
- "suggestion-based"
- "correlation ids"

**Observability triggers:**
- "logging"
- "observability"
- "correlation id"
- "structured logging"
- "performance metrics"
- "debugging"
- "logtape"
- "jsonl"
- "@side-quest/core/logging"

---

## Key Concepts

### Bun CLI Standard

Unified pattern across marketplace CLIs:
- **Entry point:** `src/cli.ts` with `#!/usr/bin/env bun` shebang
- **Arguments:** Three formats (`--flag value`, `--flag=value`, `--flag`)
- **Output:** Markdown (default) + JSON via `--format json`
- **Error handling:** Contextual messages, exit codes (0 = success, 1 = error)
- **Usage text:** Clear structure (Usage → Options → Examples)

### Bun Runtime Advantages

- **4x faster startup** than Node.js (0.08s vs 0.3s)
- **Single binary:** Runtime + bundler + test runner + package manager
- **workspace:* protocol** for zero-config monorepo management
- **bun.lockb** — Binary, deterministic lockfile
- **Native TypeScript** — No transpilation needed

### DX Framework (Three Pillars)

1. **Feedback Loops** — Quick validation (tests < 5s, errors instant)
2. **Cognitive Load** — Consistent patterns, clear naming, progressive disclosure
3. **Flow State** — Minimize context switching, remove blockers, visible progress

---

## Integration with Marketplace

### Related Plugins

- **para-obsidian** — CLI reference implementation (9/10 score)
- **git** — Conventional commits and automation

### Runner MCP Servers (Two-Repo Architecture)

| npm Package (side-quest-runners) | Plugin Wrapper (side-quest-plugins) |
|----------------------------------|-------------------------------------|
| `@side-quest/bun-runner` | `bun-runner` (.mcp.json + hooks) |
| `@side-quest/biome-runner` | `biome-runner` (.mcp.json + hooks) |
| `@side-quest/tsc-runner` | `tsc-runner` (.mcp.json + hooks) |

### Related Resources

- **BUN_CLI_STANDARD.md** (docs/) — Comprehensive 14-section standard
- **CLI_REVIEW.md** (plugins/para-obsidian/) — Reference analysis
- **PLUGIN_ARCHITECTURE.md** (docs/) — Plugin conventions
- **BUN_RUNNER_GUIDE.md** — Test runner patterns

---

## Future Directions

### Phase 2+ Skills
See ROADMAP.md for planned skills and timeline.

### MCP Tools (Phase 3+)
Consider adding MCP tools for direct Claude integration:
- `dev_scaffold_cli` — Generate CLI scaffolds
- `dev_review_against_standard` — Automated CLI review
- `dev_analyze_dx` — DX metrics analysis
- `dev_generate_skill` — Skill file generation

### Consolidation Opportunities
Evaluate merging development-related skills from `example-skills`:
- Potential for shared "development" category
- After both plugins stabilize (6+ months)
- Community feedback will guide decision

---

## Contributing

### Adding New Skills

1. Create `skills/{skill-name}/` directory
2. Write `SKILL.md` with progressive disclosure
3. Add references/ if applicable
4. Add scripts/ for utility tools (stubs ok)
5. Update plugin.json to register skill
6. Test with: "I need help with [skill-name]"
7. Update ROADMAP.md

### Improving Existing Skills

- Submit feedback through GitHub issues
- Reference real-world examples
- Suggest improvements to structure/clarity
- Share patterns you've discovered

---

## Quality Standards

All skills follow:
- ✅ Progressive disclosure (novice → expert)
- ✅ Real, copy-paste examples
- ✅ Clear table of contents
- ✅ FAQ section for common questions
- ✅ Related skills cross-references
- ✅ Token-efficient (< 10KB per skill)
- ✅ Marketplace validation (100% pass)

---

## Maintenance

**Last Updated:** 2025-12-11
**Phase:** 1 (Foundation)
**Next Review:** After all Phase 1 skills complete
**Status:** ✅ Production-ready

### Changelog

- **v1.3.0** (2025-12-11) — Added Observability skill
  - Added: Observability skill documenting @side-quest/core/logging
  - Content: Structured logging, correlation IDs, performance metrics, debugging
  - Covers: LogTape, JSONL, hierarchical loggers, MetricsCollector
  - Real-world examples: para-obsidian, cinema-bandit, kit logging patterns
  - Best practices: Log levels, grep/jq workflows, production debugging
- **v1.2.0** (2025-12-11) — Added Inbox Processing Expert skill
  - Added: Comprehensive inbox processing framework documentation
  - Security: 7 P0 critical patterns (TOCTOU, command injection, atomic writes)
  - Architecture: Engine/interface separation, suggestion-based processing
  - Includes: Implementation checklist, 246 test coverage, error taxonomy
- **v1.1.0** (2025-12-11) — Added Bun Filesystem Helpers
  - Added: Bun FS Helpers skill documenting @side-quest/core/fs
  - Content: Pure Bun-native filesystem utilities (zero node:fs)
  - Security: Command injection safe, TOCTOU protection patterns
  - Migration: Complete guide from node:fs to Bun-native
- **v1.0.0** (2025-12-05) — Phase 1 launch
  - Added: Bun CLI Development skill + references + scripts
  - Added: Bun Runtime Workflows skill
  - Added: DX Patterns skill
  - Added: ROADMAP.md for future work

---

## Quick Links

| Resource | Location |
|----------|----------|
| Bun CLI Skill | `skills/bun-cli/SKILL.md` |
| Bun Runtime Skill | `skills/bun-runtime/SKILL.md` |
| Bun FS Helpers Skill | `skills/bun-fs-helpers/SKILL.md` |
| DX Patterns Skill | `skills/dx-patterns/SKILL.md` |
| MCP Development Skill | `skills/mcp-development/SKILL.md` |
| Inbox Processing Expert Skill | `skills/inbox-processing-expert/SKILL.md` |
| Observability Skill | `skills/observability/SKILL.md` |
| CLI Patterns Reference | `skills/bun-cli/references/bun-cli-patterns.md` |
| Roadmap | `ROADMAP.md` |
| Plugin Config | `.claude-plugin/plugin.json` |

---

## FAQ

**Q: Can I use these skills before Phase 2 completes?**
A: Yes! Phase 1 skills (Bun CLI, Bun Runtime, DX Patterns) are production-ready.

**Q: Should I consolidate with example-skills?**
A: Not yet. Dev-toolkit is focused on development tooling. Evaluation after both stabilize.

**Q: Can I use MCP tools yet?**
A: Not in this version (markdown-only). Planned for Phase 3+.

**Q: How do I contribute new skills?**
A: Open an issue with your skill proposal. We'll discuss scope and implementation.

**Q: Is there a skill for [topic]?**
A: Check ROADMAP.md for planned skills. If not listed, open an issue to propose it.

---

## Contact

Questions or suggestions? Open an issue on GitHub or reach out to the maintainers.

---

**dev-toolkit v1.0.0** — Building better development experiences with Bun
