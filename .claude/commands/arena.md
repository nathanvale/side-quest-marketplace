---
name: arena
description: Adversarial research -- biased teams argue opposite sides, a judge delivers the verdict
argument-hint: "[topic or A vs B [vs C]]"
---

# Arena -- Adversarial Research

Welcome to the Arena. Here's how it works:

- You pick a topic with two (or three) opposing camps
- I dispatch biased beat reporters -- one per camp -- to search Reddit, X, and the web for the strongest evidence supporting their side
- Once the reporters file their stories, I put on my impartial staff engineer judge hat
- I score each team across 5 dimensions, deliver a round-by-round verdict, and declare a winner
- The result is a rigorous, balanced research article born from structured conflict

The whole thing takes about 5-10 minutes. Let's go.

## What Would You Like To Do?

1. **[Fight](#fight)** -- "React vs Svelte", "Monorepo vs Polyrepo" -- you bring the matchup
2. **[Surprise me](#surprise-me)** -- scan the repo for live debates worth having
3. **[Rematch](#rematch)** -- re-run a previous arena with fresh evidence

**Routing keywords:** `vs` or clear matchup -> 1, `surprise` -> 2, `rematch` or doc path -> 3

If `$ARGUMENTS` matches a keyword or menu item, route directly. Otherwise, present this menu and ask:

> Pick a number, give me a matchup (e.g. "TDD vs Ship-first"), or say "surprise me".

$ARGUMENTS

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

### Step 3: Dispatch reporters

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
> 1. **CLI skills vs MCP tools** (2026-03-04)
> 2. ...
>
> Pick one to re-run with fresh evidence, or give me a new matchup.

Once selected, extract the original camps from the doc and go to [Dispatch Beat Reporters](#dispatch-beat-reporters) with the same framing.

---

## Dispatch Beat Reporters

Launch one `newsroom:beat-reporter` agent per camp, **all in parallel** using the Agent tool with `run_in_background: true`.

### Reporter Brief Template

```
You are a beat reporter for Team [LETTER]. Team [LETTER] LOVES [POSITION].
They believe [POSITION] is the best approach and the alternatives are inferior.

Your job: Find the STRONGEST evidence supporting Team [LETTER]'s position.

Search Reddit, X/Twitter, and the web for:
1. Arguments FOR [POSITION]
2. Success stories and production proof points
3. Criticisms and failures of the OPPOSING position(s)
4. Hard data -- benchmarks, token counts, adoption numbers, performance metrics
5. Community sentiment favouring [POSITION]
6. Prominent developers/companies championing [POSITION]
7. Recent improvements or momentum (2025-2026)

Come back with the strongest possible case. Be biased in Team [LETTER]'s favour --
find every piece of ammunition. Include specific Reddit threads, tweets, blog posts
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

```
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

Keep the personality of a staff engineer who enjoys a good debate -- witty but rigorous. The scores must be honest, not diplomatic ties.

---

## Save as Cortex Research Doc

After presenting the verdict, ask whether to save. If yes:

Use the `/cortex-engineering:frontmatter` skill for correct frontmatter structure, then:
- **Location:** `docs/research/YYYY-MM-DD-<slug>.md`
- **Frontmatter extras:** Include `method: adversarial arena research (N parallel beat reporters + judge synthesis)` and `sources: [reddit, x-twitter, web]`
- **Structure:** Follow the Cortex `research` doc type (Summary, Key Findings, Details, Sources, Open Questions)
- **Details section:** Expand the round-by-round into full prose with evidence tables, quotes, and source links from each reporter
- **Sources section:** Split by team, include engagement metrics, include YouTube if found
- **Open Questions:** Extract genuinely unresolved tensions from the debate
