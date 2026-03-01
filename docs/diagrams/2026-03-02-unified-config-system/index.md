---
created: 2026-03-02
title: "Unified Config System"
type: diagram
tags: [cortex, config, xdg, hooks, session-start, setup, architecture]
project: side-quest-marketplace
status: draft
source:
  - docs/plans/2026-03-02-feat-cortex-unified-config-system-plan.md
---

# Unified Config System

Shows the full lifecycle of the Cortex unified config system: SessionStart hook bootstrapping, config resolution with XDG compliance, the 3-step fallback chain, the `/cortex:setup` interactive skill, and how 5 consumer skills read resolved config values. Storage is split XDG-correctly between `~/.config/cortex/` (config) and `~/.local/share/cortex/docs/` (data).

## Flowchart

```mermaid
flowchart TD
    subgraph "Session Lifecycle"
        START([Session Start]):::primary
        HOOK[SessionStart Hook<br/>bootstrap.ts]:::primary
        PARSE[Parse config.yaml<br/>flat regex parser]:::info
        VALIDATE[Validate fields<br/>schema + enum check]:::info
        INJECT[Inject into<br/>session context]:::success
    end

    subgraph "Config Resolution"
        EXISTS{config.yaml<br/>exists?}:::warning
        CREATE[Atomic create<br/>flag: wx, mode: 0o600]:::accent
        DEFAULTS[Apply defaults<br/>from SCHEMA]:::info
        XDG_CONFIG[Resolve config dir<br/>XDG_CONFIG_HOME]:::info
        XDG_DATA[Resolve data dir<br/>XDG_DATA_HOME]:::info
        MKDIRS[Create data dirs<br/>7 subdirectories]:::success
    end

    subgraph "Fallback Chain"
        FC1[1. Session context<br/>injected by hook]:::success
        FC2[2. Read config.yaml<br/>direct file read]:::warning
        FC3[3. Hardcoded default<br/>~/.local/share/cortex/docs]:::danger
        FC1 -->|missing| FC2
        FC2 -->|missing| FC3
    end

    subgraph "Setup Skill"
        SETUP_CMD["cortex:setup skill"]:::accent
        READ_CFG[Read current config<br/>show effective values]:::info
        PROMPT[Walk through fields<br/>numbered lists]:::info
        EDIT_CFG[Edit config.yaml<br/>read-modify-write]:::warning
        NOTE[Note: new session<br/>for changes to take effect]:::danger
    end

    subgraph "Config Consumers"
        RESEARCH[research skill<br/>docs_path]:::primary
        BRAINSTORM[brainstorm skill<br/>docs_path]:::primary
        FRONTMATTER[frontmatter skill<br/>docs_path]:::primary
        ADD_CMD[add command<br/>docs_path]:::primary
        VISUALIZE[visualize skill<br/>docs_path +<br/>mermaid_theme]:::accent
    end

    subgraph "Storage Layout"
        CFG_FILE["~/.config/cortex/<br/>config.yaml"]:::warning
        DATA_DIR["~/.local/share/cortex/docs/<br/>research/ brainstorms/<br/>plans/ decisions/<br/>meetings/ diagrams/"]:::success
    end

    START --> HOOK
    HOOK --> XDG_CONFIG
    HOOK --> XDG_DATA
    XDG_CONFIG --> EXISTS
    EXISTS -->|yes| PARSE
    EXISTS -->|no| CREATE
    CREATE --> PARSE
    PARSE --> VALIDATE
    VALIDATE --> DEFAULTS
    DEFAULTS --> INJECT
    XDG_DATA --> MKDIRS
    INJECT --> FC1

    SETUP_CMD --> READ_CFG
    READ_CFG --> PROMPT
    PROMPT --> EDIT_CFG
    EDIT_CFG --> NOTE
    EDIT_CFG --> CFG_FILE

    FC1 -.->|consumed by| RESEARCH
    FC1 -.->|consumed by| BRAINSTORM
    FC1 -.->|consumed by| FRONTMATTER
    FC1 -.->|consumed by| ADD_CMD
    FC1 -.->|consumed by| VISUALIZE

    RESEARCH -.-> DATA_DIR
    BRAINSTORM -.-> DATA_DIR
    ADD_CMD -.-> DATA_DIR
    VISUALIZE -.-> DATA_DIR

    CFG_FILE -.->|fallback read| FC2

classDef primary fill:#0072B2,stroke:#005a8c,color:#fff,stroke-width:2px
classDef info fill:#56B4E9,stroke:#2A8ABF,color:#000,stroke-width:2px
classDef success fill:#009E73,stroke:#006B4F,color:#fff,stroke-width:2px
classDef warning fill:#E69F00,stroke:#B37A00,color:#000,stroke-width:2px
classDef danger fill:#D55E00,stroke:#A34800,color:#fff,stroke-width:2px
classDef highlight fill:#F0E442,stroke:#8A8200,color:#000,stroke-width:3px
classDef accent fill:#CC79A7,stroke:#A35E85,color:#000,stroke-width:2px
```

**Export:** Classic theme, A4 landscape.
