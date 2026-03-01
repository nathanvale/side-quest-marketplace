---
created: 2026-03-01
title: "Naming Conventions for Claude Code Plugins"
type: research
updated: 2026-03-01
tags: [claude-code, naming-conventions, skills, commands, agents, plugins, descriptions, context-budget, discoverability, cognitive-load]
project: cortex-engineering
status: draft
---

## Summary

Comprehensive research into naming conventions across the entire Claude Code plugin taxonomy -- plugins, skills, commands, agents, sub-agents, and argument hints. Naming is famously one of the two hard problems in computer science, and in LLM-routed multi-agent systems the stakes are higher: a poorly named agent doesn't just hurt readability, it affects routing correctness. The core finding: names serve humans (typing, recall), descriptions serve Claude (routing, auto-discovery), and each component type has a natural part of speech -- commands use verbs, agents use role-nouns, skills use either depending on whether they represent actions or knowledge.

## Key Findings

- Claude Code enforces lowercase + hyphens only, max 64 chars for skill/command names
- The `name` field directly becomes the `/slash-command` invocation
- Plugin components auto-namespace as `plugin-name:component-name` (similar to VS Code's `Category: Action` pattern)
- Claude routes via the **description field first**, not the name -- description writing is prompt engineering, not metadata tagging. Optimized descriptions improve activation from ~20% to ~50%; CLAUDE.md pointers and hooks push to 84%
- Same-name collisions resolve by priority: enterprise > personal > project
- **Commands/skills use verbs** ("do a thing"), **agents use role-nouns** ("delegate to someone")
- Never repeat the plugin name in component names -- the namespace already provides scope
- Treat published names as API contracts -- renaming is a semver-major breaking change
- In multi-agent systems, the agent name and its tool allowlist should be redundant -- naming is enforcement
- Argument hints should use `<required>` / `[optional]` POSIX conventions, under 30 chars

## Details

### Naming Patterns by Use Case

| Pattern | When to use | Examples |
|---------|-------------|---------|
| verb-noun | Action skills/commands (dominant) | `fix-issue`, `explain-code`, `deploy-staging` |
| noun-noun | Reference/knowledge content | `api-conventions`, `legacy-system-context` |
| single verb | High-frequency universal actions | `simplify`, `batch`, `deploy` |
| adjective-noun | Specialized variants | `deep-research`, `safe-reader` |
| platform-task | Domain-scoped tools | `youtube-research`, `spam-check` |

### Invocation Control Changes Naming Strategy

- **User-invoked skills/commands** (`disable-model-invocation: true`): optimize for human recall -- verb-noun, memorable, typable
- **Auto-triggered skills**: description is primary, name can be shorter/compressed
- **Commands**: always user-invoked, so typeability is the top priority

### Name Anti-Patterns

- **Overly generic**: `check`, `process`, `generate` -- too broad, fails both user recall and Claude auto-discovery
- **Missing domain context**: `check` vs `spam-check` -- the shorter form is ambiguous across workflows
- **Ambiguous siblings**: `update` vs `upgrade`, `check` vs `validate` -- users can't remember which is which
- **Abbreviation conflicts**: names so similar that prefix abbreviation collisions are likely
- **Arbitrary prefix shorthand**: e.g. `mycmd i` for `mycmd install` permanently blocks any new command starting with `i`

### Namespace Strategy

- **Global skills** (`~/.claude/skills/`): broader names, cross-project relevance
- **Project skills** (`.claude/skills/`): more specialized, project context baked in
- **Plugin skills**: auto-namespaced via `plugin:skill`, so the skill name itself can be shorter

### Discoverability

- Skill descriptions load into context at session start -- this is the primary discovery surface
- If many skills are installed, descriptions may be truncated at 2% of context window (~16K chars fallback)
- Names appear in `/` autocomplete; `argument-hint` adds hint text next to the name (e.g., `[issue-number]`)
- `disable-model-invocation: true` hides from Claude's context (only shows in user-typed `/` menu)
- `user-invocable: false` hides from `/` menu (only Claude sees them)

### Cross-Platform Parallels

- **VS Code**: `Category: Action` title case format maps to Claude's `plugin-name:skill-name` namespace
- **Slack**: name after the service/context when domain-specific; always provide a `help` sub-action
- **CLI (clig.dev)**: avoid abbreviations, don't sacrifice clarity for brevity, avoid ambiguous sibling names
- **Docker**: noun-verb at subcommand level (`container create`), but Claude's examples lean verb-noun

### The 2% Context Budget

The skill description budget is a critical constraint that shapes naming and description strategy at scale:

- **Mechanism**: at session start, all skill descriptions are injected into the system prompt. Budget is 2% of context window, with a 16,000 character fallback
- **Override**: set `SLASH_COMMAND_TOOL_CHAR_BUDGET` env var
- **Diagnostic**: run `/context` to see warnings about excluded skills
- **Budget-exempt**: skills with `disable-model-invocation: true` cost zero budget (descriptions not injected)

**Real-world data**: a user with 63 skills saw "Showing 42 of 63 skills" -- 33% were invisible to Claude. At 92 skills, 60% were hidden.

| Description length | Skills fitting ~16K budget | Status |
|---|---|---|
| 263 chars (observed average) | ~42 | Hits limit |
| 150 chars | ~60 | Workable |
| 130 chars (recommended) | ~67 | Optimal |
| 100 chars | ~75 | Maximum stretch |

Per-skill overhead beyond description text: ~109 characters of XML wrapper. Note: these lengths optimize for maximum skills-per-budget. The [Description Writing (Deep Dive)](#description-writing-deep-dive) section shows Anthropic's own skills use 170-610 chars, optimizing instead for activation quality. The right balance depends on how many skills compete for the budget.

### Skill Count Limits

Converging evidence from cognitive load research, CLI precedent, and the context budget:

- **Miller's Law**: humans hold 5-7 items in working memory
- **Hick's Law**: decision time increases logarithmically with options
- **CLI precedent**: git shows ~22 common commands (hides 140+ plumbing), Docker restructured flat commands into namespaced groups (`docker container`, `docker image`), kubectl's ~40+ commands are acknowledged as a usability problem

**Recommended limits per plugin:**

| Range | Assessment |
|-------|-----------|
| 5-12 skills | Optimal discoverability |
| 13-20 skills | Workable with good descriptions and invocation control |
| 20-30 skills | Budget pressure, consider splitting into focused plugins |
| 30+ skills | Real problems -- Docker-style restructuring needed |

The budget is per-session, not per-plugin. A user with 5 plugins at 10 skills each faces the same pressure as 1 plugin with 50.

### Naming Pattern Enforcement

**Recommend but don't enforce.** Evidence from marketplace ecosystems:

- **PowerShell** enforces an approved verb list (98 verbs) via PSScriptAnalyzer -- but cmdlets have uniform structure (all operate on resources)
- **Azure CLI** enforces `noun noun verb` ordering via review, not linting
- **VS Code, Slack, Figma** -- zero semantic naming enforcement, only structural constraints
- **Claude Code's own validator** enforces kebab-case and max 64 chars -- no semantic patterns

Skills are too diverse for a single naming pattern. Knowledge skills (`api-conventions`), task skills (`deploy`), and research workflows (`deep-research`) don't fit one mold. The right approach:

1. Validate structural rules (kebab-case, max length, no reserved prefixes)
2. Recommend verb-noun / gerund form in documentation
3. Consider lint warnings for vague names (`helper`, `utils`, `tools`) without failing validation

### Budget-Aware Description Strategy

As ecosystems grow, descriptions become a zero-sum game. See the [Description Writing (Deep Dive)](#description-writing-deep-dive) section for full guidance on patterns, length optimization, and activation rate data. Key budget-specific tactics:

- **Set `disable-model-invocation: true` liberally** -- zero budget cost for manual-only workflows
- **Front-load domain-specific nouns** -- "PDF", "GraphQL", "Kubernetes" trigger better than "process", "manage"
- **Use WHEN/WHEN NOT patterns** -- community reports these succeed where vague descriptions "failed completely"

### Marketplace Description Validation

Industry precedent for metadata size limits across plugin ecosystems:

| Marketplace | Field | Hard Limit | Soft/Lint Warning |
|---|---|---|---|
| Chrome Web Store | manifest description | 132 chars | N/A (enforced at publish) |
| WordPress Plugin Directory | short description | 150 chars | Encouraged shorter |
| Homebrew | formula `desc` | 80 chars (lint) | `brew audit` flags >80 |
| npm | package.json description | No formal limit | README truncated at 64KB |
| VS Code Marketplace | package.json description | No documented limit | 10 keyword max enforced |

The two-tier warn/error model is industry standard (Azure Bicep linter, GitLab CI, Homebrew `brew audit` vs `brew audit --strict`). VS Code tried to enforce a 10-keyword limit but discovered their own `vsce` toolchain auto-injects up to 34 additional tags beyond author-specified ones -- the enforcement was pulled.

**Recommended thresholds for this marketplace:**

| Level | Threshold | Message |
|-------|-----------|---------|
| warn | description > 300 chars | "Consider shortening for discovery" |
| error | description > 1,000 chars | "Exceeds per-plugin budget" |
| warn | total plugin metadata (all skill descriptions) > 3,000 chars | "May consume significant context budget" |
| error | total plugin metadata > 5,000 chars | "Will degrade discoverability for users with multiple plugins" |

Currently, `marketplace.json` validation checks plugin name format, source path, category, and deduplication -- but description length is entirely unchecked. A plugin author writing a 2,000-word description field would silently eat context budget from every session.

### Agent and Sub-Agent Naming

**Use role-nouns, not action-verbs, for agent names.** Agents are persistent entities with identity -- verbs describe what happens, nouns describe who does it.

Claude Code's built-in agents reveal the taxonomy:

| Agent | Name Style | Purpose |
|-------|-----------|---------|
| `Explore` | Verb (imperative) | Codebase search |
| `Plan` | Verb (imperative) | Research for planning |
| `general-purpose` | Adjective-noun | Fallback for complex tasks |

But the community has overwhelmingly converged on **role-nouns** for custom agents. From the VoltAgent awesome-claude-code-subagents collection (100+ agents):
- `code-reviewer`, `debugger`, `security-auditor`, `db-reader` -- role-noun (dominant)
- `build-error-resolver`, `doc-updater` -- action-noun compound
- Persona-based naming: effectively zero in the wild

**Why role-nouns work:** "I'll delegate this to the debugger" reads naturally. "I'll delegate this to the debug" does not. CrewAI explicitly uses "role" as the primary agent identity. The name-as-role pattern aligns with how all major frameworks design agents.

**Cross-framework comparison:**

| Framework | Naming Approach | Example Names | Routing Mechanism |
|-----------|----------------|---------------|-------------------|
| Claude Code | `name` (kebab-case) | `code-reviewer`, `Explore` | `description` field drives routing |
| CrewAI | `role` (natural language) | "Senior Data Researcher" | Role is part of system prompt |
| LangGraph | Node names | `run_query`, `get_schema` | Graph edges, not names |
| AutoGen | `name` (snake_case) | `math_expert`, `assistant` | Message addressing |
| Semantic Kernel | `Name` (PascalCase) | `ResearchAgent` | Orchestration dispatch |

**The builder-validator pattern** is the dominant architectural naming idiom. The names map directly to enforced tool restrictions (`disallowedTools`). The name is a contract -- you can't cheat the "validator" role by giving it Edit permissions. **Naming is enforcement.**

**Agent naming rules:**
1. Kebab-case, 1-3 words maximum
2. Don't repeat the plugin name -- users see `cortex-engineering:formatter`, not just `formatter`
3. Description is your routing contract -- include "Use when..." and optionally "Use proactively" triggers
4. Weaker models (Haiku) are more sensitive to description quality -- invest in descriptions when running cost-optimized agents

**Good agent names:** `code-reviewer`, `beat-reporter`, `db-reader`, `formatter`
**Avoid:** `review-code` (verb-object -- that's a task), `reviewing` (gerund -- ambiguous), `code-review-and-security-analysis-agent` (too long)

### Argument Hints

The `argument-hint` frontmatter field appears in Claude Code's `/` autocomplete menu next to the skill/command name.

**Use POSIX/GNU placeholder conventions:**

| Syntax | Meaning | Example |
|--------|---------|---------|
| `<name>` | Required argument | `<topic>` |
| `[name]` | Optional argument | `[format]` |
| `{a\|b}` | Mutually exclusive choices | `{json\|markdown}` |
| `...` | Repeatable | `<file>...` |

**Rules:**

1. **Under 30 characters** -- the hint competes for horizontal space in autocomplete
2. **Use lowercase, descriptive nouns** that match what the user would type
3. **Angle brackets for required, square brackets for optional**
4. **Drop surrounding quotes** -- `argument-hint: <topic>` not `argument-hint: "<topic>"`

**Good:**
```
<issue-number>
<file> [format]
[search-term]
<source> <target>
```

**Bad:**
```
<the topic you want to research in detail>   # Too long
topic                                          # No brackets, unclear if required
<input>                                        # Too generic
<arg>                                          # Meaningless
```

### The Naming Taxonomy

Each component type in a plugin has a natural part of speech. Consistency within a type creates a predictable mental model:

| Entity | Case | Part of Speech | Length | Examples |
|--------|------|---------------|--------|---------|
| Plugin | kebab-case | Noun/noun-compound | 1-3 words | `cortex-engineering`, `git-workflow` |
| Skill (action) | kebab-case | Verb or verb-phrase | 1-3 words | `research`, `deploy-staging` |
| Skill (knowledge) | kebab-case | Noun or noun-compound | 1-3 words | `api-conventions`, `frontmatter` |
| Command | kebab-case | Verb (imperative) | 1-2 words | `deploy`, `fix-issue` |
| Agent | kebab-case | Role-noun | 1-3 words | `debugger`, `code-reviewer` |
| argument-hint | POSIX brackets | Descriptive noun | <30 chars | `<topic>`, `[format]` |

This maps to natural language:
- "Run `/research` on this topic" -- verb, do a thing
- "Use the `debugger` to find this bug" -- noun, delegate to someone
- The plugin name is the domain, commands are actions, skills are knowledge, agents are specialists

### Plugin Hierarchy Coherence

The two-level namespace `plugin-name:component-name` means naming decisions cascade:

**Rule 1: Never repeat the plugin name in component names.**
```
# Bad -- stutters
cortex-engineering:cortex-engineering-frontmatter

# Good -- namespace provides context
cortex-engineering:frontmatter
```

**Rule 2: Match skill names to their command counterparts.** If `/research` delegates to a skill, the skill should also be named `research`, not `producing-research-documents`. Use the description for the long-form explanation.

**Rule 3: Use the description for AI routing, not the name.** The name is for humans (typing, remembering). The description is for Claude (routing, auto-discovery). Don't try to make the name do both jobs.

**Rule 4: Maintain part-of-speech consistency within a type.** Commands should all be verbs. Agents should all be role-nouns. Knowledge skills should all be nouns. Action skills should all be verbs.

**Rule 5: Treat published names as API contracts.** Plugin names are in `marketplace.json`. Skill names become `/slash-commands`. Agent names appear in permission rules. Renaming any of these is a semver-major change.

### The "Naming is Hard" Problem

In traditional software, a poorly named function affects readability. In LLM-routed multi-agent systems, a poorly named agent affects **correctness** -- the wrong agent gets called, or the right one gets skipped. The stakes on the naming problem have increased.

Plugin ecosystem names serve three audiences simultaneously:
- **Humans**: type them, read them in menus, build mental models
- **Claude**: parses descriptions for semantic matching and routing
- **The system**: uses names for namespacing, permissions, and API contracts

This creates tension between brevity (for typing), clarity (for understanding), and semantic richness (for routing). The resolution: **names serve humans, descriptions serve Claude, and the system enforces structure.**

### Plugin Names (Registry-Level)

The plugin name is the most permanent naming decision -- it becomes the namespace prefix for all skills, commands, and agents (`plugin-name:component-name`).

**How registries handle naming:**

| Registry | Format | Scoping | Squatting Policy |
|----------|--------|---------|------------------|
| npm | Lowercase, hyphens/dots/underscores, max 214 chars | `@org/name` scopes | Dispute resolution; moniker rules block punctuation-only variants |
| VS Code | Lowercase, no spaces, globally unique | `publisher.extension` ID | Publisher ID immutable once created |
| Homebrew | Lowercase with hyphens | `user/tap/formula` | Must be globally unique |
| PyPI | Case-insensitive, hyphens/underscores normalized | `org-` prefix convention | Manual review for disputes |
| crates.io | Lowercase with hyphens or underscores | No scoping (flat) | Active deletion of squatting |
| Claude Code | Kebab-case, max 64 chars | `plugin-name:component` | No `anthropic` or `claude` reserved words |

npm's 2018 moniker rule change was a direct response to typosquatting: you cannot publish a name that differs from an existing one only in punctuation (`react-native` blocks `reactnative`, `react_native`). Scoped packages (`@org/name`) are now the standard conflict-avoidance mechanism.

**Plugin naming rules:**
- Front-load the most distinctive word: `cortex-engineering` not `engineering-cortex`
- Keep under 30 chars for comfortable display in `/` autocomplete
- Don't include platform prefixes: `claude-code-cortex` is redundant (it's already a Claude Code plugin)
- Don't use author names when registry scoping handles identity
- Avoid generics: `helper`, `utils`, `tools`, `data`

**Well-named:** `prettier`, `eslint-plugin-react`, `ripgrep`, `cortex-engineering`
**Poorly-named:** `a`, `my-plugin`, `stuff`, `tools`

### Description Writing (Deep Dive)

The description field is the **sole input** to Claude's skill selection reasoning. There is no algorithmic routing, no embedding similarity, no keyword index. The decision happens entirely within Claude's forward pass through the transformer, treating descriptions as natural language in the system prompt. This makes description writing a form of **prompt engineering**, not metadata tagging.

#### The WHAT + WHEN + WHEN NOT Pattern

Every description must answer two or three questions:
1. **What does it do?** (capability statement)
2. **When should it be used?** (trigger conditions)
3. **When should it NOT be used?** (negative boundaries -- optional but critical for disambiguation)

This is confirmed by the [official Anthropic docs](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices), [Claude Code docs](https://code.claude.com/docs/en/skills), and the [Anthropic skills repo](https://github.com/anthropics/skills).

**Template from Anthropic's own skill-creator skill:**

```
[Verb-led capability statement, 1-2 sentences].
Use when [trigger 1], [trigger 2], or when user mentions [keyword1], [keyword2], [keyword3].
[Optional: even if they don't explicitly ask for X.]
[Optional: Do NOT use for [adjacent domain], [competing skill's territory].]
```

**Good:**
```
Extract text and tables from PDF files, fill forms, merge documents.
Use when working with PDF files or when the user mentions PDFs, forms,
or document extraction. Do NOT use for Word documents or spreadsheets.
```

**Bad:**
```
Helps with documents                    # No capabilities, no triggers
Processes data                          # Too generic
I can help you process files            # Wrong person (must be third person)
```

#### The "Pushy" Pattern (Anthropic's Own Recommendation)

Anthropic's `skill-creator` skill (line 67) explicitly addresses under-triggering:

> "Currently Claude has a tendency to 'undertrigger' skills -- to not use them when they'd be useful. To combat this, please make the skill descriptions a little bit 'pushy'. So for instance, instead of 'How to build a simple fast dashboard to display internal Anthropic data.', you might write 'How to build a simple fast dashboard to display internal Anthropic data. Make sure to use this skill whenever the user mentions dashboards, data visualization, internal metrics, or wants to display any kind of company data, even if they don't explicitly ask for a dashboard.'"

This is the authoritative source acknowledging that descriptions need to be assertive, not passive.

#### The Negative Scope Pattern

From Anthropic's official skills, the `docx` skill demonstrates explicit negative boundaries:

```yaml
description: "...Do NOT use for PDFs, spreadsheets, Google Docs, or general coding tasks
unrelated to document generation."
```

And `xlsx`:
```yaml
description: "...Do NOT trigger when the primary deliverable is a Word document, HTML report,
standalone Python script, database pipeline, or Google Sheets API integration,
even if tabular data is involved."
```

The WHEN NOT clause prevents false positive activations, especially critical when you have multiple skills with overlapping vocabulary (e.g., "document" could match docx, pdf, or pptx).

#### The Exhaustive Trigger Pattern

Anthropic's `pptx` skill demonstrates the "leave no gap" approach:

```yaml
description: "Use this skill any time a .pptx file is involved in any way -- as input, output,
or both. This includes: creating slide decks, pitch decks, or presentations;
reading, parsing, or extracting text from any .pptx file...
Trigger whenever the user mentions 'deck,' 'slides,' 'presentation,' or
references a .pptx filename, regardless of what they plan to do with the
content afterward."
```

This works because it explicitly lists synonyms, file extensions, and edge cases.

#### Third-Person POV is a Hard Rule

Descriptions are injected into the system prompt. Using first/second person ("I can help you...") confuses Claude's self-model. The official docs include a **Warning-level callout** mandating third person:

```
# Bad -- first person
I help you write code

# Bad -- second person
Helps you with documents

# Good -- third person
Processes Excel files and generates pivot tables
```

#### Activation Rate Data

From community testing and analysis:

| Approach | Activation Rate | What Changed |
|----------|----------------|-------------|
| No optimization (vague description) | ~20% | Baseline |
| Optimized description (WHAT + WHEN + keywords) | ~50% | Structured description with 5+ trigger keywords |
| Description + CLAUDE.md pointer | ~70-80% | Reinforcement in always-loaded context |
| LLM pre-eval hook (forced evaluation) | ~84% | System-level intervention, not description fix |
| Description + examples in body | 72-90% | Rich body content supplements routing |

The jump from 20% to 50% came from replacing vague descriptions with structured WHAT+WHEN descriptions containing 5+ trigger keywords. Beyond 50%, additional techniques (CLAUDE.md pointers, hooks) are needed.

**Critical insight from the skill-creator:** "Claude only consults skills for tasks it can't easily handle on its own -- simple, one-step queries like 'read this PDF' may not trigger a skill even if the description matches perfectly, because Claude can handle them directly with basic tools."

#### Skill Descriptions vs Sub-Agent Descriptions

Both use the same mechanism (Claude reads descriptions for routing), but the patterns differ:

| Aspect | Skill Description | Sub-Agent Description |
|--------|------------------|----------------------|
| **Lead with** | Capability verbs | Role identity |
| **Trigger phrase** | "Use when..." | "Use proactively..." |
| **Required** | Recommended | **Required** (name + description both required) |
| **Loading** | Description in system prompt, body on activation | Description in system prompt, body becomes agent's system prompt |

**Skill description template:**
```
[Verb-led capability statement]. Use when [triggers].
```

**Sub-agent description template:**
```
[Role identity]. [Proactive action directive]. Use proactively when [conditions].
```

Example sub-agent descriptions from the official docs:
```yaml
description: Expert code review specialist. Proactively reviews code for quality,
security, and maintainability. Use immediately after writing or modifying code.

description: Debugging specialist for errors, test failures, and unexpected behavior.
Use proactively when encountering any issues.
```

#### The "Use Proactively" Directive

From the [official sub-agents docs](https://code.claude.com/docs/en/sub-agents):

> "To encourage proactive delegation, include phrases like 'use proactively' in your subagent's description field."

Effective directive phrases:

| Phrase | Use Case | Source |
|--------|----------|--------|
| `Use proactively` | Encourage automatic delegation | Official docs |
| `Use immediately after` | Time-based trigger | Official examples |
| `Use when encountering` | Condition-based trigger | Official examples |
| `Make sure to use this skill whenever` | Pushy activation | Anthropic skill-creator |
| `even if they don't explicitly ask` | Edge case coverage | Anthropic skill-creator |

**Caution:** the community reports mixed results with "MUST BE USED" and "NON-NEGOTIABLE" language. The skill-creator recommends "pushy" but not coercive -- explain why, not just demand compliance.

#### Description Length Optimization

**Hard limits:** 1024 characters max (validation-enforced). Budget is 2% of context window (~16K chars fallback).

**Analysis of Anthropic's own 16 official skills:**

| Skill Category | Approximate Length | Why |
|---|---|---|
| Unique domain (brand-guidelines, slack-gif) | 170-210 chars | Low ambiguity, no competing skills |
| Document processing (docx, xlsx, pptx, pdf) | 440-610 chars | High ambiguity, needs WHEN NOT boundaries |

**Decision matrix for length:**

| Situation | Length | Include WHEN NOT | Pushy Language | CLAUDE.md Reinforcement |
|-----------|--------|------------------|----------------|------------------------|
| Unique skill, no competition | 150-250 chars | No | No | No |
| Multiple similar skills | 400-600 chars | Yes | Moderate | Recommended |
| Critical workflow skill | 300-500 chars | Optional | Yes ("Make sure to...") | Yes |
| Sub-agent | 100-200 chars | No | Yes ("Use proactively") | Optional |
| Background knowledge skill | 150-300 chars | No | No | N/A (`user-invocable: false`) |

The Anthropic API-level guidance suggests longer, more detailed descriptions outperform shorter ones:

> "Provide extremely detailed descriptions. This is by far the most important factor in tool performance... Aim for at least 3-4 sentences per tool description, more if the tool is complex."

The tension: API tools don't share a budget, but Claude Code skills do. Optimize for specificity within budget constraints.

#### Keyword Strategy

Claude reads descriptions as natural language but keywords anchor semantic matching:

- **Front-load capabilities:** "Extract text and tables from PDF files..." not "A tool that helps with..."
- **Include file extensions:** `.pdf`, `.docx`, `.xlsx`
- **Include user synonyms:** "deck" for presentations, "spreadsheet" for Excel
- **Include action verbs users say:** "create", "edit", "merge", "fill"
- **Include domain concepts:** "pivot tables", "tracked changes", "form filling"

```
# Good -- front-loaded with keywords
Extract text and tables from PDF files, fill forms, merge documents...

# Bad -- buried lede, no keywords
A comprehensive tool that can be used in various scenarios
to help with the extraction of text from PDF files...
```

#### The Three-Tier Activation Strategy

Description alone reaches ~50%. For higher activation rates:

1. **Tier 1 -- Description** (always loaded): primary routing signal. Must be self-sufficient.
2. **Tier 2 -- CLAUDE.md pointer** (always loaded): reinforcement for critical skills. Example:
   ```markdown
   ## Proactive Skill Matching
   When Nathan asks about [topic], invoke `/skill-name` immediately.
   ```
3. **Tier 3 -- Hooks** (system-level): forced evaluation for skills that still under-trigger.

Each auto-evaluated skill costs 50-200 tokens per turn for Claude to reason about. This is the hidden cost of having many auto-triggered skills.

#### Description Anti-Patterns

| Anti-Pattern | Why It Fails | Fix |
|-------------|-------------|-----|
| Too vague: "Helps with documents" | Matches everything or nothing | Add specific file types, actions, contexts |
| Too generic: "Processes data" | Claude can do this without skills | Specify what kind of data and processing |
| First/second person: "I can help you..." | Confuses Claude's self-model | Third person: "Processes Excel files..." |
| Missing WHEN clause | Tells what but not when | Add "Use when working with..." |
| Overlapping vocabulary | Claude can't disambiguate | Add WHEN NOT clauses |
| Too short (<50 chars) | Insufficient routing signal | Expand with capabilities and triggers |
| Body-only triggers | Body isn't loaded during routing | Move all trigger keywords into description |

#### Real Examples from Anthropic's Official Skills

**Best -- Exhaustive trigger + negative boundary (docx, 580 chars):**
```yaml
description: "Use this skill whenever the user wants to create, read, edit, or
manipulate Word documents (.docx files). Triggers include: any mention of
'Word doc', 'word document', '.docx', or requests to produce professional
documents with formatting like tables of contents, headings, page numbers...
Do NOT use for PDFs, spreadsheets, Google Docs, or general coding tasks
unrelated to document generation."
```

**Best -- Clean WHAT+WHEN (explain-code):**
```yaml
description: Explains code with visual diagrams and analogies. Use when
explaining how code works, teaching about a codebase, or when the user
asks "how does this work?"
```

**Best -- Sub-agent role + directive (code-reviewer):**
```yaml
description: Expert code review specialist. Proactively reviews code for
quality, security, and maintainability. Use immediately after writing
or modifying code.
```

#### Cross-Tool Comparison

| Platform | Description Guidance | Key Insight |
|----------|---------------------|-------------|
| Anthropic API | "at least 3-4 sentences" | Longer is better when budget isn't shared |
| OpenAI Functions | "extremely detailed descriptions... most important factor" | Same finding |
| Claude Code Skills | 150-600 chars depending on ambiguity | Budget constraint forces conciseness |
| CrewAI | `role` + `goal` + `backstory` (3 fields) | Richer than single description |
| Anthropic Engineering Blog | "describe as if onboarding a smart colleague" | Best mental model |

The Anthropic engineering blog's framing: "Think of how you would describe your tool to a new hire on your team" -- WHAT it does, WHEN to reach for it, WHEN NOT to.

### Keywords and Tags

Your `marketplace.json` uses `tags` and `plugin.json` uses `keywords`. Both affect search and discovery.

**Optimal count: 5-10.** Below 5 you miss discovery; above 10 you dilute relevance signal.

**Cross-ecosystem limits:**

| Registry | Keyword field | Limit |
|----------|--------------|-------|
| npm | `keywords` array | No formal limit |
| VS Code | `keywords` array | 30 max (enforced at publish) |
| PyPI | `classifiers` (structured) + `keywords` (free) | No limit |
| Claude Code marketplace | `tags` array | No limit currently |

**Tag naming conventions:**
- Singular form: `research` not `researches`
- Lowercase: `frontmatter` not `Frontmatter`
- Hyphens for multi-word: `second-brain` not `secondBrain`
- Include the plugin name itself as a keyword
- Include synonyms users might search for

**Hierarchy strategy:**
- Level 1 (category): domain -- `knowledge`, `productivity`
- Level 2 (capability): what it does -- `research`, `brainstorm`
- Level 3 (format/tech): how it works -- `frontmatter`, `yaml`, `markdown`

### Version Naming and Semver

The marketplace validator enforces version bumps tied to change type:

| Change Type | Required Bump | Example |
|-------------|---------------|---------|
| Plugin removed | Major | Removing a plugin breaks dependents |
| Plugin added | Minor | Additive, backward-compatible |
| Metadata changed (description, category, tags) | Patch | Discovery-affecting but not functional |

This is **stricter than industry norm** -- most registries (npm, VS Code, crates.io) don't enforce bumps for metadata-only changes. But it's defensible for a curated marketplace where metadata is the primary discovery mechanism.

The semver gray zone: documentation updates, refactors, and performance improvements aren't covered by the spec. Community consensus (semver issues #215, #831) leans toward patch bumps because "once released, any modification must be a new version."

For individual plugin versions (in `plugin.json`): major for breaking skill changes, minor for new skills/commands, patch for fixes.

### Hook Script Naming

Hook files in `hooks/*.ts` should be named to match the lifecycle event they handle, converted to kebab-case. This mirrors Git's convention where `pre-commit` handles the pre-commit event.

**Recommended:**
```
hooks/
  hooks.json
  session-start.ts        # Handles SessionStart
  pre-tool-use.ts         # Handles PreToolUse
  post-tool-use.ts        # Handles PostToolUse
  stop.ts                 # Handles Stop
```

**For multiple hooks per event, add a purpose suffix:**
```
hooks/
  session-start-bootstrap.ts    # SessionStart: bootstraps config
  pre-tool-use-guard.ts         # PreToolUse: safety guard
```

**Cross-ecosystem conventions:**

| Ecosystem | Convention | Example |
|-----------|-----------|---------|
| Git hooks | Exact event name, lowercase hyphens, no extension | `pre-commit`, `post-merge` |
| React hooks | `use` prefix + PascalCase | `useEffect` |
| WordPress | Snake_case matching action | `wp_enqueue_scripts` |
| Claude Code events | PascalCase | `SessionStart`, `PreToolUse` |

The `pre-` prefix means "runs before, can abort." The `post-` prefix means "notification only, cannot abort." Same semantic in both Git and Claude Code.

### Reference File Naming

Reference files in `skills/<name>/references/` are conditionally loaded by progressive disclosure. Claude navigates them like a filesystem -- the SKILL.md acts as a table of contents, and file names should be descriptive enough that Claude can decide whether to read them based on the name alone.

**Name by content topic (recommended for most cases):**
```
references/
  syntax-reference.md
  styling-patterns.md
  print-optimization.md
```

**Name by loading condition (when gated by flags/modes):**
```
references/
  deep-mode.md              # Only loaded with --deep flag
  when-git-detected.md      # Only loaded when git tools present
```

**Rules:**
- Kebab-case, under 30 characters
- Descriptive enough for Claude to decide read-or-skip from the name alone
- No numbered names (`ref-1.md`) or generics (`details.md`, `extra.md`)
- No dates (reference content should be evergreen)
- Consider UPPER-CASE for canonical references: `FORMS.md`, `REFERENCE.md` (following Anthropic examples)

### SKILL.md `name` vs Directory Name

When the `name` field in SKILL.md differs from the directory name, the `name` field wins for `/slash-command` invocation. The directory name is filesystem-only.

**How other systems handle this:**

| System | Internal ID | Display Name | Can diverge? |
|--------|------------|-------------|--------------|
| npm | `name` in package.json | Same | Yes -- folder can differ |
| VS Code | `publisher.name` (immutable) | `displayName` (mutable) | Yes |
| Homebrew | Formula filename | Same | No -- filename IS identity |
| Claude Code | `name` field (falls back to dir name) | Same | Yes |

**The divergence problem:** if directory is `research/` but `name: producing-research-documents`, someone browsing the filesystem sees `research/` but must type `/producing-research-documents` to invoke it.

**Recommendation: lean toward matching.** Maximum predictability, zero confusion, WYSIWYG. If the gerund form is too long for a directory name, abbreviate the directory but keep it recognizable. Or just use the short form for both -- the description handles the verbose explanation.

### Future: Embedding-Based Skill Discovery

**The API-level infrastructure already exists. Claude Code just hasn't adopted it for skills yet.**

Anthropic's Tool Search Tool (beta) provides two server-side variants:
- `tool_search_tool_regex_20251119` -- regex patterns
- `tool_search_tool_bm25_20251119` -- natural language queries

Tools marked `defer_loading: true` are not loaded into context. Claude discovers them on-demand. Supports up to 10,000 tools with 85% token reduction and accuracy improvements from 49% to 74% for Opus 4.

The official embeddings cookbook demonstrates custom implementations using `sentence-transformers/all-MiniLM-L6-v2` with cosine similarity search and `tool_reference` blocks for dynamic expansion.

**Claude Code's current gap:**
- MCP tools already get deferred loading when descriptions exceed 10% of context window (auto `MCPSearch` tool)
- Skills still use brute-force description injection with the 15K char budget
- Issue #19445 (proposing `AgentSearch` and `SkillSearch` tools) was closed NOT_PLANNED on 2026-02-28
- Issue #12836 (requesting `defer_loading` for Claude Code) has 124 upvotes, 71 comments, still open with no Anthropic response

**GitHub Copilot is already doing this:**
- Reduced from 40+ tools to 13 core tools using usage statistics
- Remaining tools discovered via embedding-guided routing with adaptive clustering
- Results: Tool Use Coverage jumped from 69% (static) to 87.5% (LLM-based) to 94.5% (embedding-based)
- 400ms average latency reduction

**Academic research converging:**
- Tool-to-Agent Retrieval (arxiv 2511.01854): +19.4% Recall@5 over prior SOTA by embedding tools and agents in shared vector space
- ACL 2025 benchmarking: embedding retrieval + reranking outperforms description injection at scale
- Production implementation (Elixir/pgvector): 60-80% token reduction, ~200ms latency improvement, $0.01/day cost

**Security concern:** ToolHijacker (arxiv 2504.19793) shows 99-100% attack success rates against embedding-based tool retrievers via injected malicious tool documents. Any future embedding-based skill routing should account for this attack surface.

**Predicted timeline:**

| Timeframe | Expected development |
|-----------|---------------------|
| Already shipped | API-level Tool Search Tool with regex + BM25 |
| Near-term (3-6 months) | Claude Code integrates Tool Search for MCP tools (issue #12836) |
| Medium-term (6-12 months) | Skills get deferred loading, likely BM25 first |
| Longer-term (12-18 months) | Full embedding-based discovery with local model |

**Implication for this marketplace:** enforce description quality now. Concise, keyword-rich descriptions serve both injection and retrieval mechanisms. The discipline of good descriptions is permanent even as the discovery mechanism evolves.

## Sources

### Naming Conventions
- [Official Claude Code Skills Docs](https://code.claude.com/docs/en/skills) -- canonical source for naming constraints, budget mechanism, and frontmatter fields
- [Official Claude Code Sub-Agents Docs](https://code.claude.com/docs/en/sub-agents) -- agent naming, description-based routing
- [Official Claude Code Plugins Reference](https://code.claude.com/docs/en/plugins-reference) -- namespace model, plugin-name:component-name
- [OneAway -- Claude Code Skills Guide](https://oneaway.io/blog/claude-code-skills-slash-commands) -- community patterns and real-world examples
- [OneAway -- Skill vs Command Best Practices](https://oneaway.io/blog/claude-skill-vs-command) -- organizational distinction
- [Block Engineering -- 3 Principles for Agent Skills](https://engineering.block.xyz/blog/3-principles-for-designing-agent-skills) -- treat naming like API design
- [CLIG.dev -- CLI Naming Guidelines](https://clig.dev/) -- established CLI naming standards
- [VS Code Command Palette UX](https://code.visualstudio.com/api/ux-guidelines/command-palette) -- category prefix pattern, `when` clause filtering
- [Slack Slash Commands Style Guide](https://medium.com/slack-developer-blog/slash-commands-style-guide-4e91272aa43a) -- platform naming patterns
- [Slack Marketplace Guidelines](https://docs.slack.dev/slack-marketplace/slack-marketplace-app-guidelines-and-requirements/) -- naming review criteria
- [PowerShell Approved Verbs](https://learn.microsoft.com/en-us/powershell/scripting/developer/cmdlet/approved-verbs-for-windows-powershell-commands?view=powershell-7.5) -- enforced naming standard
- [Azure CLI Command Guidelines](https://github.com/Azure/azure-cli/blob/dev/doc/command_guidelines.md) -- noun-noun-verb enforcement
- [Google Developer Documentation Style Guide -- Code Syntax](https://developers.google.com/style/code-syntax) -- CLI placeholder conventions

### Agents and Multi-Agent Naming
- [VoltAgent awesome-claude-code-subagents](https://github.com/VoltAgent/awesome-claude-code-subagents) -- 100+ community agents, naming patterns
- [Everything Claude Code](https://github.com/affaan-m/everything-claude-code) -- agent collection and examples
- [Claude Code Team Orchestration -- Builder-Validator Patterns](https://claudefa.st/blog/guide/agents/team-orchestration) -- naming as enforcement
- [CrewAI Agents Documentation](https://docs.crewai.com/en/concepts/agents) -- role-based agent identity
- [LangGraph Documentation](https://docs.langchain.com/oss/python/langgraph/sql-agent) -- graph-node naming
- [AutoGen Agents Tutorial](https://microsoft.github.io/autogen/stable//user-guide/agentchat-user-guide/tutorial/agents.html) -- conversational agent naming
- [Semantic Kernel Agent Orchestration](https://learn.microsoft.com/en-us/semantic-kernel/frameworks/agent/agent-orchestration/) -- orchestration dispatch patterns
- [Arize AI -- Best Practices for Agent Routing](https://arize.com/blog/best-practices-for-building-an-ai-agent-router/) -- description quality affects routing accuracy
- [Composio -- AI Agent Tool Calling Guide](https://composio.dev/blog/ai-agent-tool-calling-guide) -- semantic matching between requests and descriptions
- [O'Reilly -- Designing Effective Multi-Agent Architectures](https://www.oreilly.com/radar/designing-effective-multi-agent-architectures/) -- agent design patterns

### The Naming Problem
- [Naming Things -- namingthings.co](https://www.namingthings.co/) -- canonical resource on the hardest problem
- [Two Hard Things -- Martin Fowler](https://martinfowler.com/bliki/TwoHardThings.html) -- cache invalidation and naming things
- [Naming Convention (Programming) -- Wikipedia](https://en.wikipedia.org/wiki/Naming_convention_(programming)) -- names as API contracts

### Plugin and Registry Naming
- [npm Package Name Guidelines](https://docs.npmjs.com/package-name-guidelines/) -- naming rules and moniker policy
- [npm Blog: New Package Moniker Rules](https://blog.npmjs.org/post/168978377570/new-package-moniker-rules.html) -- typosquatting prevention
- [npm Threats and Mitigations](https://docs.npmjs.com/threats-and-mitigations/) -- scoped packages as security
- [VS Code Extension Manifest](https://code.visualstudio.com/api/references/extension-manifest) -- keyword limits, display name vs ID
- [Homebrew Formula Cookbook](https://docs.brew.sh/Formula-Cookbook) -- formula naming conventions
- [crates.io Policies](https://crates.io/policies) -- flat namespace, squatting policy
- [Terraform Plugin Naming](https://developer.hashicorp.com/terraform/plugin/best-practices/naming) -- prefix-based namespacing
- [WordPress Plugin Best Practices](https://developer.wordpress.org/plugins/plugin-basics/best-practices/) -- unique prefix convention

### Description Writing and Routing
- [Anthropic Skill Authoring Best Practices](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices) -- WHAT + WHEN pattern, max 1024 chars
- [Claude Code Skills Deep Dive -- Shilkov](https://mikhail.io/2025/10/claude-code-skills/) -- skill identifier from folder name, description as routing heuristic
- [Claude Skills Deep Dive -- Lee](https://leehanchung.github.io/blogs/2025/10/26/claude-skills-deep-dive/) -- activation rate data (20% to 90% with trigger keywords), no algorithmic routing
- [Stop Bloating Your CLAUDE.md](https://alexop.dev/posts/stop-bloating-your-claude-md-progressive-disclosure-ai-coding-tools/) -- auto-trigger succeeded only 44% without CLAUDE.md pointers
- [Building Effective AI Agents -- Anthropic](https://www.anthropic.com/research/building-effective-agents) -- description quality in tool selection
- [Function Calling with LLMs -- Prompt Engineering Guide](https://www.promptingguide.ai/applications/function_calling) -- tool description as routing signal
- [Writing Tools for Agents -- Anthropic Engineering](https://www.anthropic.com/engineering/writing-tools-for-agents) -- "describe as if onboarding a new hire"
- [Anthropic Skills Repository](https://github.com/anthropics/skills) -- official skill-creator skill, "pushy" description guidance
- [Claude Code Skills Structure and Usage Guide -- mellanon gist](https://gist.github.com/mellanon/50816550ecb5f3b239aa77eef7b8ed8d) -- three-tier activation strategy, 5+ trigger keywords
- [How to Make Claude Code Skills Activate Reliably -- Scott Spence](https://scottspence.com/posts/how-to-make-claude-code-skills-activate-reliably) -- activation rate data, forced eval hook pattern
- [How to Activate Claude Skills Automatically -- DEV Community](https://dev.to/oluwawunmiadesewa/claude-code-skills-not-triggering-2-fixes-for-100-activation-3b57) -- hook-based activation
- [Implement Tool Use -- Anthropic Platform Docs](https://platform.claude.com/docs/en/agents-and-tools/tool-use/implement-tool-use) -- "at least 3-4 sentences", detailed descriptions
- [Optimizing Tool Calling -- Paragon](https://www.useparagon.com/learn/rag-best-practices-optimizing-tool-calling/) -- semantic matching best practices
- [Awesome Claude Skills](https://github.com/travisvn/awesome-claude-skills) -- community skill collection and patterns

### Versioning
- [Semantic Versioning 2.0.0](https://semver.org/) -- the spec
- [SemVer: The Tricky Parts](https://thoughtspile.github.io/2021/11/08/semver-challenges/) -- gray zones for metadata-only changes
- [Andre Staltz on Patch Versions](https://staltz.com/i-wont-use-semver-patch-versions-anymore.html) -- argument against patch-level ambiguity

### Hooks and Progressive Disclosure
- [Git Hooks -- git-scm.com](https://git-scm.com/book/en/v2/Customizing-Git-Git-Hooks) -- event-name-based file naming
- [Git Hooks -- Atlassian](https://www.atlassian.com/git/tutorials/git-hooks) -- pre/post semantic split
- [Progressive Disclosure for AI Agents -- Medium](https://medium.com/@martia_es/progressive-disclosure-the-technique-that-helps-control-context-and-tokens-in-ai-agents-8d6108b09289) -- three-layer token-efficient architecture
- [Progressive Disclosure Pattern -- DeepWiki](https://deepwiki.com/daymade/claude-code-skills/3.3-progressive-disclosure-pattern) -- reference file navigation

### Discoverability and Cognitive Load
- [Claude Code Issue #13044](https://github.com/anthropics/claude-code/issues/13044) -- skill truncation at scale (92 skills, 60% hidden)
- [Skill Budget Research (gist)](https://gist.github.com/alexey-pelykh/faa3c304f731d6a962efc5fa2a43abe1) -- 63 skills, 33% invisible, description length analysis
- [Minimize Cognitive Load -- Nielsen Norman Group](https://www.nngroup.com/articles/minimize-cognitive-load/) -- Miller's Law, Hick's Law
- [Understanding Claude Code: Skills vs Commands vs Subagents vs Plugins](https://www.youngleaders.tech/p/claude-skills-commands-subagents-plugins) -- description quality drives auto-invocation
- [Kubernetes kubectl Issue #35226](https://github.com/kubernetes/kubernetes/issues/35226) -- too many subcommands proposal
- [SkillsMP](https://skillsmp.com) -- 1,342 skills across 315 plugins, marketplace-level discovery problem
- [VS Code Agent Skills Open Standard](https://code.visualstudio.com/docs/copilot/customization/agent-skills) -- cross-tool skill naming

### Marketplace Validation Precedents
- [Chrome Web Store Manifest Description](https://developer.chrome.com/docs/apps/manifest/description) -- 132-char hard limit
- [WordPress Plugin Directory Description Limits](https://meta.trac.wordpress.org/ticket/7477) -- 150-char short description
- [Homebrew Audit Description Rules (PR #2242)](https://github.com/Homebrew/brew/pull/2242) -- 80-char lint warning
- [VS Code Keyword Limit Discussion #426](https://github.com/microsoft/vscode-discussions/discussions/426) -- enforcement pulled after toolchain conflict

### Embedding-Based Discovery
- [Anthropic Tool Search Tool](https://platform.claude.com/docs/en/agents-and-tools/tool-use/tool-search-tool) -- API beta, regex + BM25
- [Anthropic Tool Search with Embeddings Cookbook](https://platform.claude.com/cookbook/tool-use-tool-search-with-embeddings) -- custom implementation guide
- [Introducing Advanced Tool Use -- Anthropic Engineering](https://www.anthropic.com/engineering/advanced-tool-use) -- 85% token reduction, accuracy improvements
- [GitHub Blog: Making Copilot Smarter with Fewer Tools](https://github.blog/ai-and-ml/github-copilot/how-were-making-github-copilot-smarter-with-fewer-tools/) -- embedding-guided tool routing
- [Claude Code Issue #12836](https://github.com/anthropics/claude-code/issues/12836) -- defer_loading support request (124 upvotes)
- [Claude Code Issue #19445](https://github.com/anthropics/claude-code/issues/19445) -- SkillSearch tool (closed NOT_PLANNED)
- [Claude Code Issue #12782](https://github.com/anthropics/claude-code/issues/12782) -- configurable skills budget
- [Claude Code Issue #11045](https://github.com/anthropics/claude-code/issues/11045) -- hidden skills / router priority
- [Claude Code Issue #19890](https://github.com/anthropics/claude-code/issues/19890) -- MCP auto-deferred loading
- [Tool-to-Agent Retrieval (arxiv 2511.01854)](https://arxiv.org/abs/2511.01854) -- +19.4% Recall@5
- [ACL 2025: Benchmarking Tool Retrieval for LLMs](https://aclanthology.org/2025.findings-acl.1258.pdf) -- embedding retrieval outperforms injection
- [ToolHijacker (arxiv 2504.19793)](https://arxiv.org/abs/2504.19793) -- 99-100% attack success against embedding retrievers
- [Embedding-Based Tool Selection -- BitByBit](https://bitbytebit.substack.com/p/embedding-based-tool-selection-for) -- production implementation, 60-80% token reduction
- [AWS: Optimize Agent Tool Selection with S3 Vectors](https://aws.amazon.com/blogs/storage/optimize-agent-tool-selection-using-s3-vectors-and-bedrock-knowledge-bases/) -- 82.3% accuracy at top-20

## Open Questions

All original questions have been answered. See the relevant sections:

- **Naming enforcement** -- See "Naming Pattern Enforcement" (recommend, don't enforce)
- **Skill count limits** -- See "Skill Count Limits" (5-12 optimal, 30+ needs restructuring)
- **Context budget impact** -- See "The 2% Context Budget" and "Description Writing (Deep Dive)"
- **Marketplace validation thresholds** -- See "Marketplace Description Validation" (two-tier warn/error model)
- **Embedding-based discovery** -- See "Future: Embedding-Based Skill Discovery" (API shipped, Claude Code skills not yet)

## Quick Reference -- Summary Decision Matrix

| Component | Case | Part of Speech | Max Length | Key Rule |
|-----------|------|---------------|-----------|----------|
| Plugin name | kebab-case | Noun compound | 64 chars (aim <30) | Must match directory; no `anthropic`/`claude`; front-load distinctive word |
| Skill (action) | kebab-case | Verb/verb-phrase | 64 chars | Match directory name; description drives routing |
| Skill (knowledge) | kebab-case | Noun/noun-compound | 64 chars | Background context; may be `user-invocable: false` |
| Command | kebab-case | Verb (imperative) | 64 chars | Always user-invoked; optimize for typeability |
| Agent | kebab-case | Role-noun | 64 chars | Don't repeat plugin name; naming is enforcement |
| Description | Third person prose | WHAT + WHEN + WHEN NOT | 1024 chars (150-600 depending on ambiguity) | Front-load keywords; sole LLM routing signal; be "pushy" per Anthropic |
| argument-hint | POSIX brackets | `<required>` / `[optional]` | <30 chars | Descriptive nouns; no surrounding quotes |
| Keywords/tags | Lowercase, singular | Domain terms | 5-10 items | Include synonyms; hyphenate multi-word |
| Hook files | kebab-case | Event name match | N/A | `session-start.ts` for `SessionStart` |
| Reference files | kebab-case | Content topic | <30 chars | Descriptive enough for Claude to decide read-or-skip |
| Versions | semver X.Y.Z | N/A | N/A | Major=removal, Minor=addition, Patch=metadata |
