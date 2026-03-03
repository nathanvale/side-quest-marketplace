# kb-mpe Knowledge Bank Plugin - Architecture Diagrams

Three diagrams visualizing the plan at `docs/plans/2026-03-03-feat-kb-mpe-knowledge-bank-plugin-plan.md`.

## Diagrams

### 1. Architecture (`kb-mpe-1-architecture`)

Plugin tier system and marketplace registry. Shows how `kb-mpe` fits as the first knowledge bank plugin alongside `cortex-engineering` (Core).

### 2. Progressive Disclosure (`kb-mpe-2-progressive-disclosure`)

Hub skill routing to 7 on-demand reference files. The SKILL.md hub includes inline quick reference for simple queries and routes to detailed references per query.

### 3. Token Budget (`kb-mpe-3-token-budget`)

Cost flow from description (~150 tokens, every session) through SKILL.md body (~3K tokens, when MPE detected) to references (~2-5K tokens, per query). Typical session: ~5-8K tokens.

## Preset

All diagrams use the **Classic** preset (Wong colorblind-safe palette, dagre layout, base theme).
