---
created: 2026-03-02
title: "Config Fallback Chain"
type: diagram
tags: [config, fallback, xdg, cortex, architecture]
project: side-quest-marketplace
status: draft
source: docs/plans/2026-03-02-feat-cortex-unified-config-system-plan.md
---

# Config Fallback Chain

How the Cortex unified config system resolves values -- where config is written, how it flows through the SessionStart hook into session context, and the 3-step fallback chain that skills use to read values.

```mermaid
flowchart TD
    classDef primary fill:#0072B2,stroke:#005a8c,color:#fff,stroke-width:2px
    classDef info fill:#56B4E9,stroke:#2A8ABF,color:#000,stroke-width:2px
    classDef success fill:#009E73,stroke:#006B4F,color:#fff,stroke-width:2px
    classDef warning fill:#E69F00,stroke:#B37A00,color:#000,stroke-width:2px
    classDef danger fill:#D55E00,stroke:#A34800,color:#fff,stroke-width:2px
    classDef highlight fill:#F0E442,stroke:#8A8200,color:#000,stroke-width:3px
    classDef accent fill:#CC79A7,stroke:#A35E85,color:#000,stroke-width:2px

    subgraph WRITERS ["Config Writers"]
        direction LR
        W1["Bootstrap hook<br/>auto-creates on<br/>first session"]:::success
        W2["/cortex:setup<br/>interactive config"]:::highlight
        W3["Manual edit<br/>open config.yaml"]:::info
    end

    W1 & W2 & W3 --> CFG

    CFG[("~/.config/cortex/<br/>config.yaml<br/>flat YAML")]:::primary

    CFG -->|"SessionStart hook<br/>reads + validates +<br/>injects to stdout"| CTX["Session Context<br/>CORTEX_DOCS_PATH<br/>CORTEX_MERMAID_THEME<br/>CORTEX_CONFIG"]:::primary

    subgraph FALLBACK ["3-Step Fallback Chain"]
        direction TB
        F1{"1. Session<br/>context?"}:::warning
        F1 -->|"available"| OK1["Use injected value"]:::success
        F1 -->|"missing"| F2{"2. Read<br/>config.yaml?"}:::warning
        F2 -->|"readable"| OK2["Parse + validate"]:::success
        F2 -->|"missing"| F3["3. Hardcoded default"]:::danger
    end

    CTX --> F1

    subgraph CONSUMERS ["Skills That Read Config"]
        direction LR
        C1["research"]:::accent
        C2["brainstorm"]:::accent
        C3["frontmatter"]:::accent
        C4["visualize"]:::accent
        C5["add"]:::accent
    end

    OK1 & OK2 & F3 --> CONSUMERS

    subgraph FIELDS ["Config Fields"]
        direction LR
        FD1["docs_path<br/>default: ~/.local/share/<br/>cortex/docs/"]:::info
        FD2["mermaid_theme<br/>default | sketch |<br/>blueprint"]:::info
    end

    CONSUMERS -->|"docs_path"| SAVE[("Data Storage<br/>~/.local/share/<br/>cortex/docs/")]:::success
    CONSUMERS -->|"mermaid_theme"| THEME["Diagram Export<br/>preset selection"]:::info

    subgraph XDG ["XDG Resolution"]
        direction LR
        X1["$XDG_CONFIG_HOME<br/>-> config dir"]:::warning
        X2["$XDG_DATA_HOME<br/>-> data dir"]:::warning
    end

    XDG -.->|"overrides<br/>default paths"| CFG
    XDG -.->|"overrides<br/>default paths"| SAVE
```
