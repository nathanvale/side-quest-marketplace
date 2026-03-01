# Styling Patterns

How to make Mermaid diagrams look intentional, consistent, and professional. Covers themes, classDef, inline styles, and reusable patterns.

## Init Directive

The `%%{init:}%%` directive controls theme and variables. Place it on the first line of any diagram.

```
%%{init: {'theme': 'neutral'}}%%
flowchart TD
    A --> B
```

### Theme + custom variables

```
%%{init: {
    'theme': 'base',
    'themeVariables': {
        'primaryColor': '#0072B2',
        'primaryTextColor': '#ffffff',
        'primaryBorderColor': '#005a8c',
        'lineColor': '#333333',
        'secondaryColor': '#f0f4f8',
        'tertiaryColor': '#e8e8e8',
        'fontSize': '16px',
        'fontFamily': 'Helvetica, Arial, sans-serif'
    }
}}%%
```

**Important:** Mermaid only recognizes hex colors (`#4a90d9`). Color names (`blue`, `red`) are silently ignored.

## Theme Reference

### base (visualize skill default)

Best for: Custom palettes with `themeVariables`. This is the only modifiable theme.
- Blank slate -- all colors come from `themeVariables`
- Used by `default-theme.json` with the Wong colorblind-safe palette
- **Required for the visualize skill's curated visual identity** (all 3 presets use `base`)

**Important:** The `neutral` theme silently ignores `themeVariables` (GitHub #4264). If you need custom colors, you must use `base`.

### neutral

Best for: B&W printing, documentation, black-and-white output.
- Black lines, white backgrounds
- No colored fills on nodes
- Maximum contrast at any paper size
- Saves ink
- **Does NOT support custom `themeVariables`**

### default

Best for: Screen viewing, presentations, web embedding.
- Blue primary palette
- Colored fills on nodes
- Good contrast on light backgrounds

### dark

Best for: Dark-mode UIs, dark slide decks.
- Light text on dark backgrounds
- Inverted color scheme

### forest

Best for: Nature/environmental themes, organic topics.
- Green primary palette
- Earthy tones

## classDef and Class Assignment

Define reusable style classes, then apply them to nodes. This is the preferred approach over inline styles.

### Define a class

```
classDef primary fill:#0072B2,color:#fff,stroke:#005a8c,stroke-width:2px
classDef info fill:#56B4E9,color:#000,stroke:#2A8ABF,stroke-width:2px
classDef success fill:#009E73,color:#fff,stroke:#006B4F,stroke-width:2px
classDef warning fill:#E69F00,color:#000,stroke:#B37A00,stroke-width:2px
classDef danger fill:#D55E00,color:#fff,stroke:#A34800,stroke-width:2px
classDef highlight fill:#F0E442,color:#000,stroke:#8A8200,stroke-width:3px
classDef accent fill:#CC79A7,color:#000,stroke:#A35E85,stroke-width:2px
```

These are the Wong colorblind-safe palette from [default-theme.md](default-theme.md). Use these exact values for consistency.

### Apply to nodes

**Inline syntax (preferred for single nodes):**

```
A[Start]:::primary --> B{Check}:::warning
```

**Bulk assignment:**

```
class A,C,E primary
class B,D warning
```

### Apply to edges

Edge styling uses `linkStyle` with a zero-based index:

```
flowchart LR
    A --> B --> C
    linkStyle 0 stroke:#2c5f8a,stroke-width:3px
    linkStyle 1 stroke:#a63d40,stroke-width:2px,stroke-dasharray:5
```

**Tip:** Count edges from top to bottom, left to right, starting at 0.

## Print-Safe Color Palette

Based on the Wong palette (Nature Methods, 2011) -- the standard for colorblind-safe visualization. Works for deuteranopia, protanopia, and tritanopia.

### Primary palette

| Name | Hex | Fill | Text | Border | Use for |
|------|-----|------|------|--------|---------|
| Primary | `#0072B2` | Yes | `#fff` | `#005a8c` | Main flow, primary nodes |
| Secondary | `#009E73` | Yes | `#fff` | `#007a5a` | Success, completed states |
| Accent | `#E69F00` | Yes | `#000` | `#b87d00` | Warnings, decisions |
| Error | `#D55E00` | Yes | `#fff` | `#a64900` | Failures, error states |
| Info | `#56B4E9` | Yes | `#000` | `#3a8abf` | Notes, information |
| Neutral | `#666666` | Yes | `#fff` | `#444444` | Inactive, disabled |
| Highlight | `#F0E442` | Yes | `#000` | `#8a8200` | Emphasis, callouts |
| Tertiary | `#CC79A7` | Yes | `#000` | `#a35d85` | Tertiary accent |

### Light fills (for backgrounds/subgraphs)

| Name | Hex | Text | Use for |
|------|-----|------|---------|
| Light blue | `#dce8f5` | `#333` | Default subgraph |
| Light green | `#d5ede4` | `#333` | Success group |
| Light orange | `#fae8d0` | `#333` | Warning group |
| Light gray | `#f0f0f0` | `#333` | Neutral group |

### Full classDef block (copy-paste ready)

This is the canonical block from [default-theme.md](default-theme.md). Use these exact values:

```
classDef primary fill:#0072B2,stroke:#005a8c,color:#fff,stroke-width:2px
classDef info fill:#56B4E9,stroke:#2A8ABF,color:#000,stroke-width:2px
classDef success fill:#009E73,stroke:#006B4F,color:#fff,stroke-width:2px
classDef warning fill:#E69F00,stroke:#B37A00,color:#000,stroke-width:2px
classDef danger fill:#D55E00,stroke:#A34800,color:#fff,stroke-width:2px
classDef highlight fill:#F0E442,stroke:#8A8200,color:#000,stroke-width:3px
classDef accent fill:#CC79A7,stroke:#A35E85,color:#000,stroke-width:2px
```

## Sequence Diagram Styling

Sequence diagrams use different styling mechanisms.

### Participant box colors

```
%%{init: {'theme': 'base', 'themeVariables': {
    'actorBkg': '#0072B2',
    'actorTextColor': '#ffffff',
    'actorBorder': '#005a8c',
    'activationBorderColor': '#333',
    'activationBkgColor': '#dce8f5',
    'signalColor': '#333',
    'signalTextColor': '#333',
    'noteBkgColor': '#fff3cd',
    'noteTextColor': '#333',
    'noteBorderColor': '#ffc107'
}}}%%
```

### Background highlights

Use `rect` to highlight regions:

```
rect rgb(220, 232, 245)
    User->>API: Request
    API-->>User: Response
end
```

## Mind Map Styling

Mind maps have limited styling. Use node shapes for differentiation:

```
mindmap
    root((Central Topic))
        [Square Branch]
            Detail 1
            Detail 2
        (Rounded Branch)
            Detail 3
        ))Cloud Branch((
            Detail 4
```

## Consistent Style Patterns

**Note:** The patterns below use `%%{init:}%%` directives for standalone use (e.g., quick sketches, documentation, or non-visualize contexts). When using the **visualize skill**, omit the init directive and pass the selected preset config (`default-theme.json`, `sketch-theme.json`, or `blueprint-theme.json`) via the `-c` flag instead.

### Pattern: Status flow

```
%%{init: {'theme': 'neutral'}}%%
flowchart LR
    classDef pending fill:#f5f5f5,color:#666,stroke:#999
    classDef active fill:#0072B2,color:#fff,stroke:#005a8c
    classDef done fill:#009E73,color:#fff,stroke:#007a5a
    classDef failed fill:#D55E00,color:#fff,stroke:#a64900

    A[Draft]:::pending --> B[In Review]:::active
    B --> C[Approved]:::done
    B --> D[Rejected]:::failed
```

### Pattern: System architecture

```
%%{init: {'theme': 'neutral'}}%%
flowchart TB
    classDef external fill:#f0f4f8,color:#333,stroke:#999,stroke-dasharray:5
    classDef internal fill:#0072B2,color:#fff,stroke:#005a8c
    classDef data fill:#009E73,color:#fff,stroke:#007a5a

    subgraph "External"
        A[Client App]:::external
        B[Third Party API]:::external
    end
    subgraph "Internal Services"
        C[API Gateway]:::internal
        D[Auth Service]:::internal
        E[Core Service]:::internal
    end
    subgraph "Data"
        F[(PostgreSQL)]:::data
        G[(Redis)]:::data
    end

    A --> C
    B --> C
    C --> D
    C --> E
    E --> F
    E --> G
```

### Pattern: Decision tree

```
%%{init: {'theme': 'neutral'}}%%
flowchart TD
    classDef question fill:#E69F00,color:#000,stroke:#b87d00
    classDef answer fill:#0072B2,color:#fff,stroke:#005a8c
    classDef terminal fill:#009E73,color:#fff,stroke:#007a5a

    A{Need real-time?}:::question
    A -->|Yes| B{How many users?}:::question
    A -->|No| C[REST API]:::terminal
    B -->|< 1000| D[SSE]:::terminal
    B -->|> 1000| E[WebSocket]:::terminal
```

## Inline Style (Escape Hatch)

Use `style` for one-off overrides. Prefer `classDef` for anything reusable.

```
flowchart TD
    A[Node] --> B[Styled Node]
    style B fill:#D55E00,color:#fff,stroke:#a64900,stroke-width:3px
```

## Tips

- **Consistency over creativity.** Pick one palette and stick with it across all diagrams in a project.
- **Shape + color together.** Don't rely on color alone (accessibility). Databases get cylinders AND green. Decisions get diamonds AND amber.
- **White space is free.** Don't cram nodes together. Let the layout engine breathe.
- **Test at target size.** A diagram that looks good at 800px wide may be unreadable at A3. Always preview at intended output size.
