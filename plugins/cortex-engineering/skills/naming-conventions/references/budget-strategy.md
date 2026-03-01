# Context Budget Strategy

Skill descriptions are injected into the system prompt at session start. The budget is 2% of the context window, with a 16,000 character fallback. This is a zero-sum game -- every character you use is a character another skill can't.

## The Budget Mechanism

- At session start, all skill descriptions are injected into the system prompt
- Budget: 2% of context window, 16,000 character fallback
- Override: set `SLASH_COMMAND_TOOL_CHAR_BUDGET` env var
- Diagnostic: run `/context` to see warnings about excluded skills
- Skills with `disable-model-invocation: true` cost zero budget (descriptions not injected)
- Skills with `user-invocable: false` still cost budget (Claude needs the description for auto-discovery)

## Real-World Budget Data

A user with 63 skills saw "Showing 42 of 63 skills" -- 33% were invisible to Claude. At 92 skills, 60% were hidden.

| Description length | Skills fitting ~16K budget | Status |
|---|---|---|
| 263 chars (observed average) | ~42 | Hits limit |
| 150 chars | ~60 | Workable |
| 130 chars (recommended) | ~67 | Optimal |
| 100 chars | ~75 | Maximum stretch |

Per-skill overhead beyond description text: ~109 characters of XML wrapper.

## Recommended Skill Count Limits Per Plugin

| Range | Assessment |
|-------|-----------|
| 5-12 skills | Optimal discoverability |
| 13-20 skills | Workable with good descriptions and invocation control |
| 20-30 skills | Budget pressure, consider splitting into focused plugins |
| 30+ skills | Real problems -- restructuring needed |

The budget is per-session, not per-plugin. A user with 5 plugins at 10 skills each faces the same pressure as 1 plugin with 50.

## Budget-Aware Description Strategy

### Use `disable-model-invocation: true` Liberally

Any manual-only workflow (`/deploy`, `/commit`, `/triage-prs`) should set this flag. Zero budget cost, still appears in the `/` autocomplete menu.

### Length vs Quality Tradeoff

Anthropic's own 16 official skills use varying lengths:

| Skill Category | Approximate Length | Why |
|---|---|---|
| Unique domain (brand-guidelines, slack-gif) | 170-210 chars | Low ambiguity, no competing skills |
| Document processing (docx, xlsx, pptx, pdf) | 440-610 chars | High ambiguity, needs WHEN NOT boundaries |

### Decision Matrix

| Situation | Length | Include WHEN NOT |
|-----------|--------|------------------|
| Unique skill, no competition | 150-250 chars | No |
| Multiple similar skills | 400-600 chars | Yes |
| Critical workflow skill | 300-500 chars | Optional |
| Sub-agent | 100-200 chars | No |
| Background knowledge skill | 150-300 chars | No |

### Front-Load Domain-Specific Nouns

"PDF", "GraphQL", "Kubernetes" trigger better than "process", "manage".

### Use WHEN/WHEN NOT Patterns

Community reports these succeed where vague descriptions "failed completely".

## Marketplace Description Validation Thresholds

| Level | Threshold | Message |
|-------|-----------|---------|
| warn | description > 300 chars | "Consider shortening for discovery" |
| error | description > 1,000 chars | "Exceeds per-plugin budget" |
| warn | total plugin metadata > 3,000 chars | "May consume significant context budget" |
| error | total plugin metadata > 5,000 chars | "Will degrade discoverability" |

## Cognitive Load Research

- **Miller's Law**: humans hold 5-7 items in working memory
- **Hick's Law**: decision time increases logarithmically with options
- **CLI precedent**: git shows ~22 common commands (hides 140+ plumbing)

These converge on 5-12 skills per plugin as the sweet spot.
