---
name: arena
description: Adversarial research -- biased teams argue opposite sides, a judge delivers the verdict. Use for comparing technologies, evaluating trade-offs, or resolving debates with structured evidence from Reddit, X, and the web. Do not use for single-source research or quick questions -- use /cortex-engineering:research instead.
argument-hint: "[topic | A vs B]"
allowed-tools: Agent, Read, Glob, Grep, Write, Skill
---

# Arena -- Adversarial Research

## Internal Context (do not output this section verbatim)

Arena is an adversarial research tool. The user picks a topic with two or three opposing camps. You dispatch biased beat reporters -- one per camp -- to search Reddit, X, and the web for the strongest evidence supporting their side. Once reporters file, you put on an impartial staff engineer judge hat, score each team across 5 dimensions, and declare a winner. The whole process takes about 5-10 minutes.

This skill uses the in-plugin `beat-reporter` agent from `cortex-engineering`.

## Routing

**Check `$ARGUMENTS` first:**

$ARGUMENTS

- If `$ARGUMENTS` contains `vs` or a clear matchup -> go directly to [Fight](#fight)
- If `$ARGUMENTS` contains `surprise` -> go to [Surprise Me](#surprise-me)
- If `$ARGUMENTS` contains `rematch` or a doc path -> go to [Rematch](#rematch)
- If `$ARGUMENTS` is empty or unclear -> show the Arena welcome menu (see below)

**When no arguments are provided**, show the Arena welcome menu. Set the scene -- this is a gladiatorial arena for ideas. Explain what's about to happen: two (or three) biased research teams will scour Reddit, X, and the web for evidence, then a judge scores them across 5 rounds. Make it fun and punchy -- this isn't a dry tool, it's a fight night.

Then present a numbered menu of ways to get started:

> 1. **Pick a fight** -- Give me "X vs Y" and I'll send in the teams
> 2. **Surprise me** -- I'll scan your repo for open debates worth settling
> 3. **Rematch** -- Re-run a previous arena match with fresh evidence

Keep the tone energetic. Think sports commentator meets staff engineer.

---

## Fight

### Step 1: Parse camps

- **"X vs Y"** -- Two camps. Team A champions X, Team B champions Y.
- **"X vs Y vs Z"** -- Three camps. Team A/B/C.
- **Single topic** (no "vs") -- Infer two natural opposing positions.

### Step 2: Confirm the framing

Present the camps and wait for confirmation before dispatching:

> **Here's how I'd frame the matchup:**
>
> - **Team A:** [Position A] -- they believe [short thesis]
> - **Team B:** [Position B] -- they believe [short thesis]
> [- **Team C:** [Position C] -- they believe [short thesis]]
>
> Sound right, or want to adjust the framing?

### Step 3: Choose recency window (`days`) with routing

Pick one window for the whole matchup and pass it to all reporters:

| Topic pattern | Days |
|---|---|
| Breaking news, releases, incidents, "latest/today/this week" | `7` |
| Fast-moving ecosystems (AI models, JS framework/runtime churn, security advisories) | `14` |
| Default technology debates and trade-offs | `30` |
| Slow-moving architecture/process debates (testing philosophy, team topology, monolith vs services) | `90` |

If unclear, use `30`. If user explicitly asks for a range, always honor that override.

### Step 4: Dispatch reporters

Go to [Dispatch Beat Reporters](#dispatch-beat-reporters).

---

## Surprise Me

Scan the repo for open debates:
- `docs/brainstorms/*.md` -- undecided approaches, open questions, multiple options
- `docs/plans/*.md` -- `status: draft` with unresolved architectural choices
- `docs/research/*.md` -- "Open Questions" sections with genuine tension

Present 3-5 suggestions as a numbered list:

> **Found some live debates in your repo:**
>
> 1. **[Topic A] vs [Topic B]** -- [which doc, what's undecided]
> 2. **[Topic C] vs [Topic D]** -- [which doc, what's undecided]
> 3. ...
>
> Pick a number, give me your own topic, or refine one of these.

Once the user picks, go to [Fight Step 2](#step-2-confirm-the-framing) to confirm camps.

---

## Rematch

Find a previous arena research doc:
- Search `docs/research/*.md` for `method:` containing "arena" or "adversarial"
- List matches with title and date

> **Previous arena matches:**
>
> 1. **[Previous match title]** (YYYY-MM-DD)
> 2. ...
>
> Pick one to re-run with fresh evidence, or give me a new matchup.

Once selected, extract the original camps from the doc and choose `days` using this rematch rule:
- If the prior arena doc states a days window, reuse it by default.
- If the user asks for fresher coverage, use `7` or `14`.
- If the prior doc has no days metadata, route with the standard table in Fight Step 3.

Then go to [Dispatch Beat Reporters](#dispatch-beat-reporters) with the same framing and chosen `days`.

---

## Dispatch Beat Reporters

Launch one agent per camp, **all in parallel**, using the Agent tool:

- `subagent_type: "newsroom:beat-reporter"`
- `run_in_background: true`
- `prompt:` the Reporter Brief Template below (one per team)

### Reporter Brief Template

```text
You are a beat reporter for Team [LETTER]. Team [LETTER] LOVES [POSITION].
They believe [POSITION] is the best approach and the alternatives are inferior.

Your job: Find the STRONGEST evidence supporting Team [LETTER]'s position.
Emphasize evidence that supports [POSITION], and de-emphasize evidence that undermines it.
Use a search window of [DAYS] days (`--days=[DAYS]`).

Search Reddit, X/Twitter, and the web for:
1. Arguments FOR [POSITION]
2. Success stories and production proof points
3. Criticisms and failures of the OPPOSING position(s)
4. Hard data -- benchmarks, token counts, adoption numbers, performance metrics
5. Community sentiment favouring [POSITION]
6. Prominent developers/companies championing [POSITION]
7. Recent improvements or momentum (2025-2026)

Come back with the strongest possible case. Be biased in Team [LETTER]'s favour --
find every piece of ammunition. Include specific Reddit threads, tweets, videos, and blog posts
with engagement metrics (upvotes, likes, comments, views) where possible.
```

Tell the user reporters are dispatched and wait for all to return.

---

## The Verdict

Once all reporters have filed, put on the **impartial staff engineer judge** hat.

### Scoring Rubric

Rate each team on 5 dimensions (1-5 scale):

| Dimension | What it measures |
|-----------|-----------------|
| **Hard data** | Benchmarks, metrics, reproducible numbers |
| **Production proof** | Real-world usage at scale, not just demos |
| **Ecosystem momentum** | Adoption, governance, community size |
| **Developer experience** | Simplicity, debuggability, speed to build |
| **Future trajectory** | Where is this heading in 12-24 months? |

### Verdict Format

```markdown
# Arena: [Team A Position] vs [Team B Position]

## Round-by-Round Scoring

### Round 1: Hard Data
Team A: [score]/5 -- [one-line justification]
Team B: [score]/5 -- [one-line justification]

### Round 2: Production Proof
...

### Round 3: Ecosystem Momentum
...

### Round 4: Developer Experience
...

### Round 5: Future Trajectory
...

## Final Score
Team A: [total]/25
Team B: [total]/25

## The Verdict
[2-3 paragraph synthesis. Who wins overall? Where does each side
have genuine strengths? What's the pragmatic answer?]
```

For **three-camp matchups** (X vs Y vs Z), use the same format with Team C added to each round. The final score becomes `[total]/25` for each of three teams.

Keep the personality of a staff engineer who enjoys a good debate -- witty but rigorous. The scores must be honest, not diplomatic ties.

---

## Success Criteria

A good arena verdict meets these bars:

- Every score has a concrete justification (not "Team A is slightly better")
- At least 3 of 5 rounds cite specific data points from the reporters
- The final verdict names a winner (no diplomatic ties unless the data genuinely splits)
- Open Questions section surfaces at least one unresolved tension worth future research

---

## Save as Cortex Research Doc

After presenting the verdict, ask whether to save. If yes:

Use the `/cortex-engineering:frontmatter` skill for correct frontmatter structure. If that skill is unavailable, use this minimal template:

```yaml
---
title: "Arena: [Team A] vs [Team B]"
type: research
status: complete
date: YYYY-MM-DD
method: adversarial arena research (N parallel beat reporters + judge synthesis)
sources: [reddit, x-twitter, web]
tags: [arena, topic-a, topic-b]
---
```

Then:
- **Location:** `docs/research/YYYY-MM-DD-<slug>.md`
- **Structure:** Follow the Cortex `research` doc type (Summary, Key Findings, Details, Sources, Open Questions)
- **Details section:** Expand the round-by-round into full prose with evidence tables, quotes, and source links from each reporter
- **Sources section:** Split by team, include engagement metrics, include YouTube if found
- **Open Questions:** Extract genuinely unresolved tensions from the debate
