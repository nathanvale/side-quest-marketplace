---
created: 2026-02-28
deepened: 2026-02-28
deepened-round-2: 2026-02-28
title: "Configurable Global Docs Storage with SessionStart Bootstrap"
type: plan
tags: [cortex, config, xdg, hooks, session-start, global-docs]
project: cortex-engineering
status: draft
---

> Origin: docs/brainstorms/2026-02-28-cortex-global-docs-storage.md

# feat: Configurable global docs storage with SessionStart bootstrap

## Enhancement Summary

**Deepened on:** 2026-02-28 (2 rounds, 16 agents total)

**Round 1 agents (11):** architecture-strategist, security-sentinel, code-simplicity-reviewer, kieran-typescript-reviewer, pattern-recognition-specialist, agent-native-reviewer, performance-oracle, best-practices-researcher, repo-research-analyst, agent-native-architecture-skill, claude-code-hooks-skill

**Round 2 agents (5):** bootstrap.ts-implementer, skill-diffs-generator, hooks-discovery-researcher, xdg-data-vs-config-researcher, sub-agent-context-researcher

### Key Improvements

1. **XDG-correct split** -- config at `~/.config/cortex/`, docs at `~/.local/share/cortex/docs/` (data belongs in `$XDG_DATA_HOME`, not `$XDG_CONFIG_HOME`)
2. **Fallback chain in skill prose** -- 3-step resolution (hook context, read config.yaml, default path) instead of relying solely on the hook
3. **Agent capabilities in hook output** -- tells the agent what it can *do*, not just what exists
4. **Security hardening** -- `docs_path` validation (single-line, under `$HOME`, path allowlist) prevents prompt injection
5. **Timer `.unref()`** -- prevents multi-second delay on every session start
6. **Matcher narrowed** -- `"startup|clear"` instead of `"*"` to skip compaction events
7. **Regex over YAML library** -- saves ~20ms, zero dependencies for single-field config
8. **Hooks auto-discovery** -- no `"hooks"` field needed in plugin.json (convention-based)
9. **Reference implementation** -- complete `bootstrap.ts` at `plugins/cortex/hooks/bootstrap.ts`
10. **Exact skill diffs** -- before/after for all 5 files in appendix
11. **Project repo path normalized** -- `~/code/<project>/docs/` changed to `./docs/` (relative, works in any checkout location)

### New Considerations from Round 2

- **XDG data/config split**: docs are user-generated data, not config. Atuin, chezmoi, direnv, zoxide all separate these. direnv even migrated state out of `~/.config/` after a bug report.
- **Hooks auto-discovery confirmed**: all 4 existing plugins with hooks (git, claude-code, enterprise, observability) use convention-based discovery -- no `"hooks"` in plugin.json
- **SubagentStart hook exists**: can inject `additionalContext` into spawned sub-agents, but prompt-based pattern is simpler for MVP
- **`bootstrap.ts` written and validated**: passes tsc and Biome lint, ~227 lines

---

## Overview

Replace all hardcoded `~/code/my-agent-cortex/docs/` references in the Cortex plugin with a configurable `docs_path` backed by `~/.config/cortex/config.yaml`. A SessionStart hook auto-bootstraps the config and data directories on first use and injects the resolved docs path into every session's context. Skills reference "the global docs path" from session context with an explicit default fallback.

## Problem Statement

Cortex moved from a standalone repo (`my-agent-cortex`) into side-quest-marketplace as a community plugin. 18 files reference the old hardcoded path (5 runtime skill/command files that need updating, plus 13 historical docs that keep original paths for provenance). Community users who install the plugin have nowhere for global docs to go. The plugin needs a configurable, XDG-compliant default that works out of the box.

## Proposed Solution

1. **SessionStart hook** bootstraps `~/.config/cortex/` (config) and `~/.local/share/cortex/docs/` (data) on first use, injects the resolved `docs_path` into Claude's context every session
2. **config.yaml** at `~/.config/cortex/config.yaml` with a single `docs_path` field (MVP scope)
3. **Update 5 skill/command files** to reference the session-injected docs path with explicit default fallback
4. **Update plugin.json** to fix the repository URL and bump version (no hooks field needed -- auto-discovered)

## Known Risk: SessionStart Hook Bug

[Issue #11509](https://github.com/anthropics/claude-code/issues/11509) -- SessionStart hooks may not fire for local file-based marketplace plugins. Still open as of Feb 2026. Workaround: clear `~/.claude/plugins/cache` and reinstall.

### Mitigation: Fallback Chain

Every skill includes a **zero-code fallback chain**:

1. Use the global docs path from session context (if injected by hook)
2. If not available, read `~/.config/cortex/config.yaml` (or `$XDG_CONFIG_HOME/cortex/config.yaml`)
3. If config doesn't exist, default to `~/.local/share/cortex/docs/`

This makes skills resilient to hook failure, compaction, and sub-agent contexts.

## Acceptance Criteria

- [ ] SessionStart hook creates `~/.config/cortex/config.yaml` and `~/.local/share/cortex/docs/` subdirectories on first session
- [ ] Hook respects `$XDG_CONFIG_HOME` and `$XDG_DATA_HOME` if set (validated as absolute)
- [ ] Hook is idempotent -- subsequent sessions do not overwrite existing config or docs
- [ ] Hook outputs the resolved `docs_path` to stdout (injected into Claude's context)
- [ ] Hook output includes agent capabilities section
- [ ] Hook includes self-destruct timer with `.unref()` (per project convention)
- [ ] 4 runtime files include fallback chain: session context > read config.yaml > default path (cortex-frontmatter, research, brainstorm, add)
- [ ] 1 runtime file gets project rename only: visualize/SKILL.md (no docs path reference to update)
- [ ] config.yaml supports `docs_path` field with tilde expansion
- [ ] `docs_path` is validated: single-line, path characters only, resolves under `$HOME`
- [ ] Users can change `docs_path` to any location under `$HOME`
- [ ] Malformed config warnings appear in stdout (not just stderr)
- [ ] No `"hooks"` field added to plugin.json (auto-discovered by convention)
- [ ] `bun run validate` passes after all changes

## Implementation Order

### Phase 1: Bootstrap Hook + Plugin Manifest

**File: `plugins/cortex/hooks/hooks.json`** (NEW)

```json
{
  "description": "Bootstrap Cortex knowledge system at session start",
  "hooks": {
    "SessionStart": [
      {
        "matcher": "startup|clear",
        "hooks": [
          {
            "type": "command",
            "command": "bun run \"${CLAUDE_PLUGIN_ROOT}/hooks/bootstrap.ts\"",
            "timeout": 10
          }
        ]
      }
    ]
  }
}
```

**Matcher:** `"startup|clear"` not `"*"`. The `|` acts as regex OR (Claude Code evaluates matchers as regex patterns against event names). Avoids running on resume (already has context) and compact (should preserve context).

**Timeout:** 10s. Comfortable headroom; hook completes in ~15ms normally.

**Discovery:** Claude Code auto-discovers `hooks/hooks.json` by convention. All 4 existing plugins with hooks (git, claude-code, enterprise, observability) use this approach -- none have a `"hooks"` field in plugin.json.

---

**File: `plugins/cortex/hooks/bootstrap.ts`** (NEW -- reference implementation already written)

The complete implementation is at `plugins/cortex/hooks/bootstrap.ts` (227 lines, passes tsc + Biome). Key design:

1. **Self-destruct timer (8s)** with `.unref()` -- first executable line
2. **XDG-correct paths**: config at `$XDG_CONFIG_HOME/cortex/` (default `~/.config/cortex/`), docs at `$XDG_DATA_HOME/cortex/docs/` (default `~/.local/share/cortex/docs/`)
3. **Atomic config creation** with `{ flag: 'wx', mode: 0o600 }`
4. **Regex YAML parsing** -- `/^docs_path:\s*(.+)$/m` (no library, saves ~20ms). Note: `.+` will capture trailing YAML comments (e.g., `docs_path: ~/foo # my note` captures `~/foo # my note`). The path validation step rejects `#` as a non-path character, so this is safe -- but the user won't get a helpful error. Acceptable for MVP; upgrade to comment-aware parsing if users report confusion.
5. **Security validation** -- single-line, path characters only, resolves under `$HOME`
6. **Tilde expansion** via `os.homedir()` (more robust than `process.env.HOME`)
7. **Enhanced stdout** with `CORTEX_DOCS_PATH`, `CORTEX_CONFIG`, and Agent Capabilities section
8. **Self-contained** -- duplicates ~15 lines of utility code instead of importing from `src/config.ts` (distributable plugin rationale documented in module JSDoc)

> **NOTE:** The reference implementation currently uses `~/.config/cortex/docs` as the default. It needs updating to `~/.local/share/cortex/docs` per the XDG split decision below. See "XDG Split: Required bootstrap.ts Changes" section.

---

**File: `plugins/cortex/.claude-plugin/plugin.json`** (EDIT)

- Do NOT add `"hooks"` field (auto-discovered)
- Update `"repository"` URL from `my-agent-cortex` to `side-quest-marketplace`
- Bump version to `0.3.0` (minor: new feature)

### Phase 2: Update Skills and Commands

Replace hardcoded `~/code/my-agent-cortex/docs/` references with the **fallback chain pattern**:

> Use the Cortex global docs path from session context. If no path was injected, read `~/.config/cortex/config.yaml`. If config doesn't exist, use the default: `~/.local/share/cortex/docs/<type>/`.

**Sub-agent context requirement** (add to skills that spawn Task agents):

> When spawning sub-agents via the Task tool, you MUST include the Cortex docs path in the Task prompt. Sub-agents do not inherit session context. Include: "The Cortex global docs path is: `<CORTEX_DOCS_PATH>`". If the path is not in your current context, read it from `~/.config/cortex/config.yaml` before dispatching.

See **Appendix A** for exact before/after diffs for all 5 files.

### Phase 3: Verify

Run `bun run validate` to confirm marketplace validation passes. The validation script only checks `marketplace.json` structure, not internal plugin contents.

## XDG Split: Config vs Data

### Decision: Split (data at `~/.local/share/cortex/docs/`)

**The XDG spec is clear:** `$XDG_CONFIG_HOME` is for configuration files, `$XDG_DATA_HOME` is for persistent user data. Cortex knowledge documents (research notes, brainstorms, plans) are unambiguously user-generated data.

**Real-world evidence:**

| Tool | Config | Data |
|------|--------|------|
| Atuin | `~/.config/atuin/` | `~/.local/share/atuin/` |
| chezmoi | `~/.config/chezmoi/` | `~/.local/share/chezmoi/` |
| direnv | `~/.config/direnv/` | `~/.local/share/direnv/` (migrated from config after bug report) |
| zoxide | N/A | `~/.local/share/zoxide/` |
| WeeChat | `~/.config/weechat/` | `~/.local/share/weechat/` |

**direnv precedent is directly relevant:** They stored state data in `~/.config/direnv/allow/`, a user filed a bug arguing it was data not config, maintainers agreed and migrated. Their reasoning: users syncing `~/.config/` across machines would inadvertently sync machine-specific data.

**Dotfile managers handle both paths identically:** Stow, chezmoi, and yadm all work with `~/.local/share/` the same as `~/.config/`.

### Resulting directory layout

```
~/.config/cortex/
  config.yaml                    # CONFIG (where to find docs)

~/.local/share/cortex/
  docs/                          # DATA (knowledge documents)
    research/
    brainstorms/
    plans/
    decisions/
    meetings/
    diagrams/
```

### Default config.yaml template

```yaml
# Cortex knowledge system configuration
# Generated automatically on first use

# Where to store global knowledge documents
# Default: ~/.local/share/cortex/docs
# Change to any path: ~/Dropbox/cortex, ~/code/my-knowledge/docs, etc.
docs_path: ~/.local/share/cortex/docs
```

### Required bootstrap.ts Changes

The reference implementation at `plugins/cortex/hooks/bootstrap.ts` needs these updates:

1. **Add `$XDG_DATA_HOME` resolution** for the default docs path:

```typescript
function resolveDefaultDocsDir(): string {
  const xdg = process.env.XDG_DATA_HOME
  if (xdg) {
    if (!xdg.startsWith('/')) {
      process.stderr.write(
        `[cortex] XDG_DATA_HOME is not absolute, using default\n`,
      )
      return resolve(homedir(), '.local', 'share', 'cortex', 'docs')
    }
    return resolve(xdg, 'cortex', 'docs')
  }
  return resolve(homedir(), '.local', 'share', 'cortex', 'docs')
}
```

2. **Update `DEFAULT_DOCS_PATH`** from `'~/.config/cortex/docs'` to `'~/.local/share/cortex/docs'`
3. **Update `DEFAULT_CONFIG`** template to show `docs_path: ~/.local/share/cortex/docs`
4. **Update fallback chain default** in all skill files

## Sub-agent Context Passing

### The Problem

Sub-agents spawned via Task do NOT inherit SessionStart-injected context. They get their own fresh 200k context window with only their system prompt, environment details (CLAUDE.md), and the delegation prompt.

### Recommended Pattern: Include path in Task prompt (MVP)

The parent agent already has `CORTEX_DOCS_PATH` in its context. Skills instruct the parent to include the path when spawning sub-agents:

> When spawning sub-agents via the Task tool, include this in the prompt: "The Cortex global docs path is: `<CORTEX_DOCS_PATH value>`"

### Alternative: SubagentStart hook (future)

Claude Code supports a `SubagentStart` hook that can inject `additionalContext` into spawned sub-agents:

```json
{
  "SubagentStart": [
    {
      "matcher": "*",
      "hooks": [{ "type": "command", "command": "bun run bootstrap.ts --subagent", "timeout": 5 }]
    }
  ]
}
```

This would automatically inject the docs path into every sub-agent. Deferred to future iteration -- the prompt-based pattern is simpler and sufficient for MVP.

## Files Changed Summary

| File | Change Type | Phase |
|------|------------|-------|
| `plugins/cortex/hooks/hooks.json` | NEW | 1 |
| `plugins/cortex/hooks/bootstrap.ts` | NEW (+ update for XDG split) | 1 |
| `plugins/cortex/.claude-plugin/plugin.json` | EDIT | 1 |
| `plugins/cortex/skills/cortex-frontmatter/SKILL.md` | EDIT | 2 |
| `plugins/cortex/skills/research/SKILL.md` | EDIT | 2 |
| `plugins/cortex/skills/brainstorm/SKILL.md` | EDIT | 2 |
| `plugins/cortex/skills/visualize/SKILL.md` | EDIT | 2 |
| `plugins/cortex/commands/add.md` | EDIT | 2 |

## Decisions Made

**From brainstorm (see: docs/brainstorms/2026-02-28-cortex-global-docs-storage.md):**
- Default location: `~/.config/cortex/` for config (XDG convention)
- Configurable via `docs_path` in config.yaml
- No lock-in -- users can point docs anywhere
- Plugin code and user knowledge are cleanly separated
- **Updated during deepening:** docs data split to `~/.local/share/cortex/docs/` per XDG spec (`$XDG_DATA_HOME` for user data, `$XDG_CONFIG_HOME` for config only)

**Resolved during planning:**
- **Init mechanism:** SessionStart hook only. Auto-bootstraps on first session.
- **How skills resolve the path:** Fallback chain -- hook context first, then read config.yaml, then default.
- **MVP scope:** `docs_path` only. Defer `sources` array, `viewer` config, scope detection.
- **No `cortex config` subcommand.** Agent capabilities in hook output cover config editing.
- **Migration:** Manual -- Nathan sets `docs_path` in config.yaml.

**Resolved during deepening (round 1):**
- **Fallback chain** over hard dependency on hook
- **Regex over YAML library** (~20ms savings, zero dependencies)
- **`timer.unref()` is mandatory** (prevents multi-second delay)
- **Matcher `startup|clear`** (skip resume/compact)
- **Hook timeout 10s** (comfortable headroom)
- **`{ flag: 'wx' }` for config creation** (atomic, no TOCTOU)
- **`docs_path` validation** (single-line, path chars, under `$HOME`)
- **`project: cortex`** not `cortex-plugin` (match plugin name)
- **Agent capabilities in hook output** (agent-native parity)

**Resolved during deepening (round 2):**
- **XDG split: docs at `~/.local/share/cortex/docs/`** -- data belongs in `$XDG_DATA_HOME`, not `$XDG_CONFIG_HOME`. Evidence: Atuin, chezmoi, direnv migration. Dotfile managers handle both paths identically.
- **No `"hooks"` field in plugin.json** -- Claude Code auto-discovers `hooks/hooks.json` by convention. All 4 existing hook-using plugins confirm this.
- **Sub-agent context via prompt injection** -- simplest pattern for MVP. SubagentStart hook deferred.
- **Reference implementation written** -- `bootstrap.ts` passes tsc + Biome, needs XDG data path update.

## Edge Cases Addressed

| Edge Case | Handling |
|-----------|----------|
| First session (no config) | Hook creates config.yaml atomically (`wx`), docs dirs, injects path |
| Subsequent sessions | Hook reads config, injects path, creates nothing |
| `$XDG_CONFIG_HOME` set | Hook uses it for config dir (validated as absolute) |
| `$XDG_DATA_HOME` set | Hook uses it for default docs dir (validated as absolute) |
| Symlinked `~/.config/` | Hook follows symlinks -- works with Stow/chezmoi |
| `docs_path` non-existent dir | Hook creates it (including subdirs) |
| Malformed config.yaml | Falls back to default, warns in stderr + stdout |
| `docs_path` contains newlines | Validation rejects, falls back to default |
| `docs_path` outside `$HOME` | Validation rejects, falls back to default |
| Fresh user install | Bootstraps their own config + data dirs |
| Hook doesn't fire (#11509) | Skills fallback chain: read config.yaml > default |
| Context lost in compaction | Backtick-wrapped key-value format + fallback chain |
| Sub-agent via Task | Parent passes resolved path in Task prompt |
| Self-destruct timer blocks | `.unref()` lets process exit naturally |

## Performance Profile

Benchmarked on M4 Pro with Bun 1.3.9:

| Operation | Time |
|-----------|------|
| Bun cold start | ~10ms |
| Full hook (regex parse, config exists) | ~13ms |
| Full hook (yaml library, first run) | ~31ms |
| `mkdirSync` x6 (existing dirs) | ~13ms |
| Human perception threshold | ~100ms |

**Verdict:** Hook adds 15-35ms to session startup. Imperceptible.

## What's NOT in This Plan

- `sources` array in config.yaml (future: multi-location search)
- `viewer` config (future: `cortex open` command)
- `cortex init` slash command (hook handles bootstrap)
- `cortex config` CLI subcommand (future: when CLI binary exists)
- `cortex init --git` (future: opt-in git init at docs_path)
- Automated migration from `~/code/my-agent-cortex/docs/` (manual config edit)
- "In a project repo" detection logic (keep current heuristic: `./docs/` exists)
- Historical doc updates (brainstorm/plan docs keep original paths)
- package.json name/URL changes (separate concern)
- PreCompact hook for path re-injection (future: if compaction drops path)
- `context.md` at docs root for accumulated agent knowledge (future)
- File count summary in hook output (future)
- SubagentStart hook for automatic context injection (future)
- `theme` field in config.yaml (future: lets users select a Mermaid theme config file for the visualize skill. Default: `default-theme.json` from the mermaid-diagrams skill. Custom themes would be JSON files in the same format, stored at a user-specified path. Prerequisite: this plan's config infrastructure must land first.)

## Verification

1. Delete `~/.config/cortex/` and `~/.local/share/cortex/` (if they exist)
2. Start a new Claude Code session with the Cortex plugin
3. Verify the hook fired (look for "Cortex Global Docs" and "Agent Capabilities" in session context)
4. Verify `~/.config/cortex/config.yaml` (mode 600) and `~/.local/share/cortex/docs/` with all subdirs (mode 700) exist
5. Run `/cortex:research "test topic"` -- verify it saves to `~/.local/share/cortex/docs/research/`
6. Edit `config.yaml` to set `docs_path: ~/tmp/cortex-test-docs` (must be under `$HOME` -- `/tmp/` would fail validation)
7. Start a new session -- verify the hook creates the custom path's subdirectories
8. Run `/cortex:research "test topic 2"` -- verify it saves to `~/tmp/cortex-test-docs/research/`
9. Test fallback: temporarily rename `hooks.json`, start session, verify skill resolves path via fallback chain
10. Test injection defense: set `docs_path` to a multiline value, verify hook rejects it
11. Test sub-agent: run a skill that spawns a Task agent, verify it receives the docs path
12. Run `bun run validate` -- verify all checks pass

## Sources

- **Origin brainstorm:** docs/brainstorms/2026-02-28-cortex-global-docs-storage.md
- **SessionStart hook bug:** [#11509](https://github.com/anthropics/claude-code/issues/11509)
- **XDG spec:** freedesktop.org/basedir -- `$XDG_CONFIG_HOME` for config, `$XDG_DATA_HOME` for data
- **XDG compliance evidence:** Atuin, chezmoi, direnv (migrated data out of config), zoxide, WeeChat
- **direnv migration precedent:** github.com/direnv/direnv/issues/406
- **Hooks auto-discovery:** 4/4 existing plugins (git, claude-code, enterprise, observability) use convention, none have `"hooks"` in plugin.json
- **SubagentStart hook:** Claude Code event reference -- can inject `additionalContext` into spawned sub-agents
- **Sub-agent isolation:** Each sub-agent gets own 200k context, no conversation history from parent
- **Repo research:** 18 files with hardcoded `my-agent-cortex` references; 5 runtime files need updating
- **Claude Code hooks guide:** SessionStart stdout = context injection; matcher values: startup/resume/clear/compact
- **Community research:** XDG convention (Raycast, Karabiner, Ghostty, Atuin); dotfiles managers handle `~/.local/share/` identically to `~/.config/`
- **Security:** YAML tag execution, docs_path prompt injection, TOCTOU on file creation
- **Performance:** M4 Pro benchmarks -- 13ms regex vs 31ms yaml; sync fs correct for fire-and-exit hooks
- **Agent-native architecture:** Action parity, dynamic context injection, shared workspace model

---

## Appendix A: Exact Skill File Diffs

### Edit 1: `plugins/cortex/skills/cortex-frontmatter/SKILL.md`

**Lines 192-198 (File Location table)**

BEFORE:
```markdown
## File Location

| Context | Location |
|---------|----------|
| No project context / global | `~/code/my-agent-cortex/docs/<type>/` |
| Working in a project repo | `~/code/<project>/docs/<type>/` |
```

AFTER:
```markdown
## File Location

| Context | Location |
|---------|----------|
| No project context / global | Use the Cortex global docs path from session context. If no path was injected, read `~/.config/cortex/config.yaml`. If config doesn't exist, use the default: `~/.local/share/cortex/docs/<type>/` |
| Working in a project repo | `./docs/<type>/` (changed from `~/code/<project>/docs/` to relative path) |
```

### Edit 2: `plugins/cortex/skills/research/SKILL.md`

**Edit 2a: Lines 37-39 (grep path)**

BEFORE:
```markdown
Or grep the docs folders directly:

```bash
grep -rl "<topic>" ~/code/my-agent-cortex/docs/ 2>/dev/null
```
```

AFTER:
```markdown
Or grep the global docs folder directly (resolve the path using the Cortex global docs path from session context; if no path was injected, read `~/.config/cortex/config.yaml`; if config doesn't exist, default to `~/.local/share/cortex/docs/`):

```bash
grep -rl "<topic>" <CORTEX_DOCS_PATH>/ 2>/dev/null
```
```

**Edit 2b: Lines 78-80 (save path)**

BEFORE:
```markdown
**File location:**
- If in a project repo: `./docs/research/YYYY-MM-DD-<slug>.md`
- If no project context: `~/code/my-agent-cortex/docs/research/YYYY-MM-DD-<slug>.md`
```

AFTER:
```markdown
**File location:**
- If in a project repo: `./docs/research/YYYY-MM-DD-<slug>.md`
- If no project context: `<CORTEX_DOCS_PATH>/research/YYYY-MM-DD-<slug>.md` (resolve using session context, then `~/.config/cortex/config.yaml`, then default `~/.local/share/cortex/docs/`)

**Sub-agent note:** When spawning sub-agents via Task (e.g., beat-reporter), include the resolved global docs path in the task prompt. Sub-agents do not inherit SessionStart-injected context.
```

**Edit 2c: Line 99 (example project)**

BEFORE: `project: my-agent-cortex`
AFTER: `project: cortex`

### Edit 3: `plugins/cortex/skills/brainstorm/SKILL.md`

**Edit 3a: Lines 35-37 (grep path)**

BEFORE:
```markdown
Or grep directly:

```bash
grep -rl "<topic>" ~/code/my-agent-cortex/docs/ 2>/dev/null
```
```

AFTER:
```markdown
Or grep the global docs folder directly (resolve the path using the Cortex global docs path from session context; if no path was injected, read `~/.config/cortex/config.yaml`; if config doesn't exist, default to `~/.local/share/cortex/docs/`):

```bash
grep -rl "<topic>" <CORTEX_DOCS_PATH>/ 2>/dev/null
```
```

**Edit 3b: Lines 81-83 (save path)**

BEFORE:
```markdown
**File location:**
- If in a project repo: `./docs/brainstorms/YYYY-MM-DD-<slug>.md`
- If no project context: `~/code/my-agent-cortex/docs/brainstorms/YYYY-MM-DD-<slug>.md`
```

AFTER:
```markdown
**File location:**
- If in a project repo: `./docs/brainstorms/YYYY-MM-DD-<slug>.md`
- If no project context: `<CORTEX_DOCS_PATH>/brainstorms/YYYY-MM-DD-<slug>.md` (resolve using session context, then `~/.config/cortex/config.yaml`, then default `~/.local/share/cortex/docs/`)

**Sub-agent note:** When spawning sub-agents via Task, include the resolved global docs path in the task prompt. Sub-agents do not inherit SessionStart-injected context.
```

**Edit 3c: Line 101 (example project)**

BEFORE: `project: my-agent-cortex`
AFTER: `project: cortex`

### Edit 4: `plugins/cortex/skills/visualize/SKILL.md`

**Line 131 (example project)**

BEFORE: `project: my-agent-cortex`
AFTER: `project: cortex`

### Edit 5: `plugins/cortex/commands/add.md`

**Lines 37-39 (save path)**

BEFORE:
```markdown
Save to the appropriate location:
- If in a project repo: `./docs/research/YYYY-MM-DD-<slug>.md`
- If no project context: `~/code/my-agent-cortex/docs/research/YYYY-MM-DD-<slug>.md`
```

AFTER:
```markdown
Save to the appropriate location:
- If in a project repo: `./docs/research/YYYY-MM-DD-<slug>.md`
- If no project context: `<CORTEX_DOCS_PATH>/research/YYYY-MM-DD-<slug>.md` (resolve using session context, then `~/.config/cortex/config.yaml`, then default `~/.local/share/cortex/docs/`)

**Sub-agent note:** When spawning sub-agents via Task, include the resolved global docs path in the task prompt. Sub-agents do not inherit SessionStart-injected context.
```

---

## Appendix B: bootstrap.ts Implementation Notes

The reference implementation is at `plugins/cortex/hooks/bootstrap.ts` (written during round 2 deepening). It needs the following updates before implementation:

1. **Change `DEFAULT_DOCS_PATH`** from `'~/.config/cortex/docs'` to `'~/.local/share/cortex/docs'`

2. **Add `resolveDefaultDocsDir()`** that respects `$XDG_DATA_HOME`:

```typescript
function resolveDefaultDocsDir(): string {
  const xdg = process.env.XDG_DATA_HOME
  if (xdg) {
    if (!xdg.startsWith('/')) {
      process.stderr.write(
        `[cortex] XDG_DATA_HOME is not absolute ("${xdg}"), using default\n`,
      )
      return resolve(homedir(), '.local', 'share', 'cortex', 'docs')
    }
    return resolve(xdg, 'cortex', 'docs')
  }
  return resolve(homedir(), '.local', 'share', 'cortex', 'docs')
}
```

3. **Update `DEFAULT_CONFIG`** template to show `docs_path: ~/.local/share/cortex/docs`

4. **Integration into `bootstrap()`** -- replace the existing fallback line:

```typescript
// BEFORE (current reference implementation):
resolvedDocsPath = resolve(expandTilde(DEFAULT_DOCS_PATH))

// AFTER:
resolvedDocsPath = resolveDefaultDocsDir()
```

This affects two call sites in `bootstrap()`: (a) the initial default when no config match is found, and (b) the fallback when `validateDocsPath()` rejects the config value. Both should call `resolveDefaultDocsDir()` instead of `resolve(expandTilde(DEFAULT_DOCS_PATH))`.

5. **Update hook output** to show the correct default in the Agent Capabilities section

The implementation is otherwise complete: self-destruct with `.unref()`, atomic config creation, regex parsing, security validation, enhanced stdout format, self-contained utilities with JSDoc.
