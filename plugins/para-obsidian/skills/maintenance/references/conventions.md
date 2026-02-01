# Para-Obsidian Convention Rules

Knowledge base for the maintenance audit skill. Update this file when conventions change — the audit auto-adapts.

---

## 1. Skill Frontmatter Requirements

Every `skills/*/SKILL.md` must have YAML frontmatter with these fields:

| Field | Required | Type | Notes |
|-------|----------|------|-------|
| `name` | Yes | string | Must match directory name |
| `description` | Yes | string | One-line purpose |
| `user-invocable` | Yes | boolean | Whether users can call directly |
| `allowed-tools` | Yes | string (CSV) | Tools the skill is permitted to use |
| `argument-hint` | If user-invocable | string | Usage hint shown in help |
| `context` | Optional | `fork` or `inherit` | Execution context |

**Validation rules:**
- `name` must exactly match the skill's directory name (e.g., `skills/clip/SKILL.md` → `name: clip`)
- `allowed-tools` must be a comma-separated list of tool names
- User-invocable skills should have `argument-hint` (warning if missing)

---

## 2. Plugin.json Registration

Every component on disk must have a matching entry in `.claude-plugin/plugin.json`:

| Component Type | Disk Pattern | plugin.json Array | Entry Format |
|----------------|-------------|-------------------|-------------|
| Skills | `skills/*/SKILL.md` | `skills` | `./skills/<name>` |
| Commands | `commands/*.md` | `commands` | `./commands/<name>.md` |
| Agents | `agents/*.md` | `agents` | `./agents/<name>.md` |

**Validation rules:**
- Every directory under `skills/` containing a `SKILL.md` must appear in `plugin.json.skills`
- Every `.md` file under `commands/` must appear in `plugin.json.commands`
- Every `.md` file under `agents/` must appear in `plugin.json.agents`
- No entries in plugin.json should reference non-existent paths (orphaned registrations)

---

## 3. SKILL_RESULT Completion Signal

User-invocable skills should emit a completion signal so the brain orchestrator can parse outcomes.

**Pattern:**
```
SKILL_RESULT:{"status":"ok|error|partial","skill":"<name>","summary":"<human-readable>"}
```

**Rules:**
- Required for user-invocable skills (warning if missing)
- Not required for non-user-invocable skills (they're internal)
- Must appear as literal text in the SKILL.md (so brain knows to expect it)
- Status values: `ok` (success), `error` (failure), `partial` (mixed results)

---

## 4. Allowed-Tools Accuracy

The `allowed-tools` frontmatter field declares which tools a skill is permitted to use. The audit checks that tools referenced in the skill body match this declaration.

**Tool reference patterns to detect:**
- MCP tools: `mcp__plugin_<plugin>_<server>__<tool>` or short names like `para_create`
- Built-in tools: `Read`, `Write`, `Edit`, `Glob`, `Grep`, `Bash`, `WebFetch`, `WebSearch`
- Meta tools: `AskUserQuestion`, `Skill`, `Task`, `EnterPlanMode`
- Tool calls in code blocks: `tool_name({...})` or `tool_name(...)` patterns

**Matching rules:**
- A tool referenced in the skill body but missing from `allowed-tools` → warning
- A tool in `allowed-tools` but never referenced in body → info (may be used implicitly)
- Tool references inside `<!-- comments -->` are ignored
- Tool references in "Rules" or "Do NOT use" sections are excluded (negative references)

---

## 5. Cross-Reference Integrity

Skills may reference other skills, commands, or files. These references must resolve.

**Reference patterns:**
- Skill invocations: `Skill({ skill: "para-obsidian:<name>" })` or `/para-obsidian:<name>`
- File references: `[text](references/<file>)` or `Read({ file: "..." })`
- Command references: `/para-obsidian:<command>`

**Validation rules:**
- Referenced skills must exist as `skills/<name>/SKILL.md`
- Referenced commands must exist as `commands/<name>.md`
- Referenced files in `references/` must exist on disk
- Wikilink references (`[[note]]`) are NOT validated (vault content, not plugin structure)

---

## 6. Brain Routing Table Coverage

The brain skill (`skills/brain/SKILL.md`) contains a routing table mapping intents to skills.

**Rules:**
- Every user-invocable skill should have at least one routing path in brain's routing table
- Commands referenced in the routing table must exist in `commands/`
- Skills referenced in the routing table must exist in `skills/`

---

## 7. References Directory Integrity

Skills with a `references/` subdirectory should actually reference those files from SKILL.md.

**Rules:**
- Every file in `skills/<name>/references/` should be referenced from `skills/<name>/SKILL.md`
- Unreferenced files in `references/` → warning (possible dead content)
- References to non-existent files in `references/` → error (broken reference)

---

## 8. Hook Conventions

PostToolUse hooks follow specific patterns.

**Exit codes:**
- `0` — Pass (continue execution)
- `2` — Block (hard error, stop execution)

**Output:**
- stdout messages are shown to the user
- Hooks should be fast (< 5s for PostToolUse)
- Async hooks (`"async": true`) run fire-and-forget

**Registration in hooks.json:**
- `matcher` uses pipe-separated tool names: `"Write|Edit"`
- `command` must use `${CLAUDE_PLUGIN_ROOT}` for portability
- `timeout` in seconds (recommended: 5 for sync, 10 for async)

---

## 9. Observability

Skills invoked through brain routing should have telemetry coverage.

**Rules:**
- The `brain-telemetry.ts` hook fires on all `Skill` tool PostToolUse events
- Skills that emit `SKILL_RESULT` get their status tracked automatically
- Skills without `SKILL_RESULT` show as `undefined` status in telemetry — acceptable but suboptimal
