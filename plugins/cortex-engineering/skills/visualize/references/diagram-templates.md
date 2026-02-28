# Diagram Templates

Mermaid syntax templates for each diagram type. Use these as starting points when generating diagrams.

## Mind Map

Best for brainstorms and research -- shows how topics connect.

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

**Tips:**
- Root node uses `(( ))` for emphasis
- Keep to 3-5 main branches
- 2-3 details per branch max for readability at print scale

## Architecture (C4 Component)

Best for plans and system designs -- shows component structure.

```mermaid
graph TB
    subgraph "System Name"
        A[Component A] --> B[Component B]
        A --> C[Component C]
        B --> D[(Database)]
        C --> E[External Service]
    end

    style A fill:#4a90d9,color:#fff
    style B fill:#4a90d9,color:#fff
    style C fill:#4a90d9,color:#fff
```

**Tips:**
- Use `TB` (top-bottom) for hierarchical systems
- Use `LR` (left-right) for pipelines and flows
- Group related components with `subgraph`
- Use `[( )]` for databases, `{{ }}` for decisions

## Flowchart

Best for processes and workflows -- shows step-by-step flow.

```mermaid
flowchart TD
    A[Start] --> B{Decision?}
    B -->|Yes| C[Action 1]
    B -->|No| D[Action 2]
    C --> E[Result]
    D --> E
```

**Tips:**
- Use `{ }` for decision points
- Label edges with `|text|` for clarity
- Keep linear paths vertical, branches horizontal
- End with a single terminal node when possible

## Sequence Diagram

Best for interactions between components or actors.

```mermaid
sequenceDiagram
    actor User
    participant Skill
    participant MCP as MCP Server

    User->>Skill: /cortex-engineering:visualize
    Skill->>Skill: Detect context
    Skill->>MCP: create_workflow_diagram
    MCP-->>Skill: Mermaid source
    Skill->>MCP: validate_diagram_syntax
    MCP-->>Skill: Valid
    Skill->>MCP: export_diagram_formats
    MCP-->>Skill: SVG + PDF
    Skill-->>User: File paths + print suggestion
```

**Tips:**
- Use `actor` for people, `participant` for systems
- Use `->>` for requests, `-->>` for responses
- Alias long names: `participant MCP as MCP Server`
- Keep to 5-8 interactions for print readability
