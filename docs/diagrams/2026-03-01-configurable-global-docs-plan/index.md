---
created: 2026-03-01
title: "Configurable Global Docs Storage Plan"
type: diagram
tags: [cortex, config, xdg, hooks, architecture, fallback-chain]
project: side-quest-marketplace
status: draft
source: docs/plans/2026-02-28-feat-cortex-configurable-global-docs-plan.md
---

# Configurable Global Docs Storage Plan

Implementation flow for the Cortex configurable global docs feature. Shows the 3-phase plan: bootstrap hook with XDG-compliant directory split, fallback chain for path resolution, skill/command updates, sub-agent context passing, and verification.

**Preset:** Classic (bold colors, clean lines)
**Paper:** A4 landscape

```mermaid
flowchart TD
    classDef primary fill:#0072B2,stroke:#005a8c,color:#fff,stroke-width:2px
    classDef info fill:#56B4E9,stroke:#2A8ABF,color:#000,stroke-width:2px
    classDef success fill:#009E73,stroke:#006B4F,color:#fff,stroke-width:2px
    classDef warning fill:#E69F00,stroke:#B37A00,color:#000,stroke-width:2px
    classDef danger fill:#D55E00,stroke:#A34800,color:#fff,stroke-width:2px
    classDef highlight fill:#F0E442,stroke:#8A8200,color:#000,stroke-width:3px
    classDef accent fill:#CC79A7,stroke:#A35E85,color:#000,stroke-width:2px

    subgraph P1["Phase 1: Bootstrap"]
        H1["hooks.json<br/>startup|clear"]:::primary
        H2["bootstrap.ts<br/>XDG + atomic config"]:::primary
        H3["plugin.json v0.3.0"]:::info
        H1 --> H2 --> H3
    end

    subgraph XDG["XDG Directory Split"]
        X1{"Config or Data?"}:::warning
        X2["Config<br/>~/.config/cortex/"]:::info
        X3["Data<br/>~/.local/share/cortex/docs/"]:::info
        X1 --> X2
        X1 --> X3
    end

    subgraph FC["Fallback Chain"]
        F1("1. Session context"):::success
        F2("2. Read config.yaml"):::warning
        F3("3. Default path"):::danger
        F1 -->|missing| F2 -->|missing| F3
    end

    subgraph P2["Phase 2: Update 5 Files"]
        S1["cortex-frontmatter"]:::accent
        S2["research"]:::accent
        S3["brainstorm"]:::accent
        S4["visualize"]:::accent
        S5["add command"]:::accent
    end

    subgraph SA["Sub-agent Context"]
        SA1["Parent passes path<br/>in Task prompt"]:::info
        SA2["Future: SubagentStart hook"]:::warning
        SA1 -.->|deferred| SA2
    end

    V1["Phase 3: bun run validate"]:::success

    P1 --> XDG --> FC --> P2 --> SA --> V1
```
