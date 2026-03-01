# Syntax Reference

Complete syntax for all Mermaid diagram types. Each section shows the declaration keyword, minimal example, and key syntax rules.

## Flowchart

The workhorse. Handles processes, workflows, decisions, and most general-purpose diagrams.

```mermaid
flowchart TD
    A[Start] --> B{Decision?}
    B -->|Yes| C[Action 1]
    B -->|No| D[Action 2]
    C --> E[End]
    D --> E
```

**Direction:** `TD` (top-down), `LR` (left-right), `RL`, `BT` (bottom-up)

**Node shapes:**

| Syntax | Shape | Semantic |
|--------|-------|----------|
| `[text]` | Rectangle | Process |
| `(text)` | Rounded rectangle | Terminal |
| `([text])` | Stadium | Start/end |
| `{text}` | Diamond | Decision |
| `{{text}}` | Hexagon | Preparation |
| `((text))` | Circle | Connector |
| `[(text)]` | Cylinder | Database |
| `[/text/]` | Parallelogram | I/O |
| `[\text\]` | Parallelogram (reversed) | I/O |
| `[[text]]` | Subroutine | Function call |
| `[/text\]` | Trapezoid | Manual operation |
| `[\text/]` | Trapezoid (reversed) | Manual operation |
| `(((text)))` | Double circle | Emphasis |
| `>text]` | Asymmetric | Flag/signal |

**Edge types:**

| Syntax | Type |
|--------|------|
| `-->` | Arrow |
| `---` | Open link (no arrow) |
| `-.->`| Dotted arrow |
| `==>` | Thick arrow |
| `--x` | Cross end |
| `--o` | Circle end |
| `-->\|label\|` | Arrow with label |
| `-. label .->` | Dotted with label |
| `== label ==>` | Thick with label |

**Subgraphs:**

```mermaid
flowchart LR
    subgraph "Backend"
        A[API] --> B[Service]
        B --> C[(DB)]
    end
    subgraph "Frontend"
        D[App] --> E[Store]
    end
    D --> A
```

## Sequence Diagram

Interactions between actors/systems over time.

```mermaid
sequenceDiagram
    actor User
    participant API
    participant DB as Database

    User->>API: POST /login
    activate API
    API->>DB: SELECT user
    DB-->>API: user record
    API-->>User: 200 JWT token
    deactivate API
```

**Arrow types:**

| Syntax | Meaning |
|--------|---------|
| `->>` | Solid with arrowhead (request) |
| `-->>` | Dashed with arrowhead (response) |
| `-)` | Solid with open arrow (async) |
| `--)` | Dashed with open arrow (async response) |
| `-x` | Solid with cross (failure) |
| `--x` | Dashed with cross |

**Features:**
- `activate`/`deactivate` for lifelines
- `Note over A,B: text` for annotations
- `alt`/`else`/`end` for conditionals
- `loop`/`end` for repetition
- `par`/`and`/`end` for parallel execution
- `critical`/`option`/`end` for critical sections
- `rect rgb(200, 220, 240)` for background highlights

## Mind Map

Hierarchical ideas, brainstorms, topic exploration.

```mermaid
mindmap
    root((Central Topic))
        Branch A
            Detail A1
            Detail A2
        Branch B
            Detail B1
            Detail B2
        Branch C
            Detail C1
```

**Rules:**
- Indentation defines hierarchy (use consistent spacing)
- Root node uses `(( ))` for circle emphasis
- Keep to 3-5 main branches
- 2-3 details per branch max for print readability
- Node shapes: `[square]`, `(rounded)`, `((circle))`, `)cloud(`, `{{hexagon}}`

## Class Diagram

Object models, type systems, interface hierarchies.

```mermaid
classDiagram
    class Animal {
        +String name
        +int age
        +makeSound() void
    }
    class Dog {
        +fetch() void
    }
    Animal <|-- Dog : extends
```

**Relationships:**

| Syntax | Meaning |
|--------|---------|
| `<\|--` | Inheritance |
| `*--` | Composition |
| `o--` | Aggregation |
| `-->` | Association |
| `..>` | Dependency |
| `..\|>` | Realization |

**Visibility:** `+` public, `-` private, `#` protected, `~` package

## State Diagram

Lifecycles, state machines, status flows.

```mermaid
stateDiagram-v2
    [*] --> Draft
    Draft --> Review: submit
    Review --> Approved: approve
    Review --> Draft: reject
    Approved --> Published: publish
    Published --> [*]
```

**Features:**
- `[*]` for start/end states
- `state "Description" as s1` for aliases
- `state fork_state <<fork>>` for fork/join
- `state if_state <<choice>>` for conditional
- Nested states with `state "Group" { ... }`

## Entity Relationship Diagram

Data models, database schemas.

```mermaid
erDiagram
    CUSTOMER ||--o{ ORDER : places
    ORDER ||--|{ LINE_ITEM : contains
    PRODUCT ||--o{ LINE_ITEM : "included in"
```

**Cardinality notation:**

| Symbol | Meaning |
|--------|---------|
| `\|\|` | Exactly one |
| `\|o` | Zero or one |
| `}\|` | One or more |
| `}o` | Zero or more |

**Line types:** `--` solid (identifying), `..` dashed (non-identifying)

**Entity attributes:**

```mermaid
erDiagram
    CUSTOMER {
        int id PK
        string name
        string email UK
    }
```

## Gantt Chart

Timelines, project schedules.

```mermaid
gantt
    title Project Timeline
    dateFormat YYYY-MM-DD
    section Phase 1
        Research     :a1, 2026-01-01, 14d
        Design       :a2, after a1, 7d
    section Phase 2
        Build        :a3, after a2, 21d
        Test         :a4, after a3, 7d
```

**Task modifiers:** `done`, `active`, `crit` (critical path), `milestone`

## Pie Chart

Simple proportions and distributions.

```mermaid
pie title Browser Market Share
    "Chrome" : 65
    "Safari" : 19
    "Firefox" : 4
    "Edge" : 4
    "Other" : 8
```

Values must be positive. Slices render clockwise in order.

## Timeline

Chronological events.

```mermaid
timeline
    title Product History
    2023 : MVP launch
         : First 100 users
    2024 : Series A
         : Team grows to 20
    2025 : Enterprise launch
```

## Architecture Diagram

System components and connections (beta).

```mermaid
architecture-beta
    group api(cloud)[API Layer]
    group data(database)[Data Layer]

    service gateway(server)[Gateway] in api
    service auth(lock)[Auth] in api
    service db(database)[PostgreSQL] in data

    gateway:R --> L:auth
    auth:B --> T:db
```

**Components:** `group`, `service`, `junction`
**Icons:** `cloud`, `database`, `disk`, `server`, `internet`, `lock`
**Edges:** Specify ports with `:T` (top), `:B` (bottom), `:L` (left), `:R` (right)

## Block Diagram

Layout-driven generic blocks (beta).

```mermaid
block-beta
    columns 3
    A["Component A"]:2 B["Component B"]
    C["Component C"] D["Component D"] E["Component E"]
```

**Features:** `columns N` for grid layout, `:N` for column span, `space` for empty cells.

## Quadrant Chart

2x2 priority matrices.

```mermaid
quadrantChart
    title Priority Matrix
    x-axis Low Effort --> High Effort
    y-axis Low Impact --> High Impact
    quadrant-1 Do First
    quadrant-2 Schedule
    quadrant-3 Delegate
    quadrant-4 Eliminate
    Task A: [0.8, 0.9]
    Task B: [0.2, 0.3]
```

Coordinates are 0-1 range. Quadrants numbered 1 (top-right) to 4 (bottom-left).

## Sankey Diagram

Flow volumes between nodes (beta).

```mermaid
sankey-beta
    Source A,Target X,50
    Source A,Target Y,30
    Source B,Target X,20
    Source B,Target Y,40
```

CSV-like syntax: `source,target,value` per line.

## XY Chart

Line and bar charts (beta).

```mermaid
xychart-beta
    title "Monthly Revenue"
    x-axis [Jan, Feb, Mar, Apr, May]
    y-axis "Revenue ($K)" 0 --> 100
    bar [30, 45, 60, 55, 80]
    line [30, 45, 60, 55, 80]
```

## User Journey

Task completion across actors.

```mermaid
journey
    title User Onboarding
    section Sign Up
        Visit site: 5: User
        Fill form: 3: User
        Verify email: 2: User, System
    section First Use
        Complete tutorial: 4: User
        Create first item: 5: User
```

Score is 1-5 (1 = frustrating, 5 = delightful).

## Treemap

Hierarchical data as nested rectangles (beta).

```mermaid
treemap-beta
    "Engineering"
        "Frontend": 8
        "Backend": 12
        "Infra": 5
    "Design"
        "Product": 4
        "Brand": 3
```

Section nodes contain child nodes. Leaf nodes have `: value` for sizing.

## Kanban

Board-style task tracking.

```mermaid
kanban
    Todo
        task1[Design API]
        task2[Write tests]
    In Progress
        task3[Build endpoints]
    Done
        task4[Setup CI]
```

## Requirement Diagram

Requirements traceability.

```mermaid
requirementDiagram
    requirement test_req {
        id: 1
        text: System shall do X
        risk: high
        verifymethod: test
    }
    element test_entity {
        type: simulation
    }
    test_entity - satisfies -> test_req
```
